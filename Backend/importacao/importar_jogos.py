"""
Importador de jogos via RAWG (e o jogo da loja da Steam, que entra pela mesma gravação).

A listagem vem por popularidade (`ordering=-added`), sem filtro na fonte: o `/games` não filtra
por capa, então jogo sem capa (`background_image`) ou sem data (`released`) é pulado aqui, antes
do detalhe, e contado à parte (`pulados`). Jogo do RAWG com o mesmo título normalizado e ano de
um jogo criado pela loja da Steam (sem `rawg_slug`) tem a appid confirmada em
`/games/<slug>/stores` e vira a mesma Mídia (ticket 40).

A Mesma série (spec `relacoes`): o detalhe traz o `game_series_count`, que a Mídia guarda, e
`/games/<slug>/game-series` (até 80 jogos) só é chamado quando a contagem é maior que zero e
diferente da gravada (o jogo novo não tem). As séries de uma página vão num comando só. Os jogos
de antes disso são cobertos pela passada lenta (`importacao.serie_jogos`).
"""
from __future__ import annotations

import html
import re
import unicodedata
from datetime import date
from threading import local
from urllib.parse import quote, urlsplit

from banco import Indisponivel, autocommit, consultar
from importacao import cursor, relacoes
from importacao.config import RAWG_API_KEY, RAWG_BASE_URL
from importacao.db import salvar_jogo, salvar_relacoes
from importacao.utils import (
    ERROR_LOG_PATH,
    ImportStats,
    RateLimiter,
    criar_sessao_http,
    executar_em_paralelo,
    logger,
    nota_fonte_rawg,
    registrar_falha_importacao,
    truncar,
)

PLATAFORMAS_MAP = {
    'PC': 'PC',
    'PlayStation 4': 'PS4',
    'PlayStation 5': 'PS5',
    'Xbox One': 'Xbox One',
    'Xbox Series S/X': 'Xbox Series',
    'Nintendo Switch': 'Switch',
    'iOS': 'iOS',
    'Android': 'Android',
}

GENERO_MAP = {
    'Role-Playing Games (RPG)': 'RPG',
    'RPG': 'RPG',
    'Shooter': 'FPS',
    'Strategy': 'Estratégia',
    'Platformer': 'Plataforma',
    'Battle Royale': 'Battle Royale',
    'Simulation': 'Simulação',
    'Puzzle': 'Puzzle',
    'Survival': 'Survival',
    'MOBA': 'MOBA',
    'Action': 'Ação',
    'Adventure': 'Aventura',
}

RAWG_THREAD_LOCAL = local()

#: `store.steampowered.com/app/<appid>` nas lojas do RAWG.
_LOJA_STEAM = re.compile(r'store\.steampowered\.com/app/(\d+)', re.IGNORECASE)

#: Gêneros da loja da Steam pelo id (o nome muda com o idioma), com o nome que o RAWG dá, para a
#: Mídia da loja ganhar os mesmos gêneros da Importação. Fora daqui (Grátis para Jogar, Acesso
#: Antecipado, os de software) não é gênero de jogo.
GENEROS_STEAM = {
    '1': 'Action', '2': 'Strategy', '3': 'RPG', '4': 'Casual', '9': 'Racing', '18': 'Sports',
    '23': 'Indie', '25': 'Adventure', '28': 'Simulation', '29': 'Massively Multiplayer',
}
#: Plataformas da loja (`platforms`), com o nome que a Importação do RAWG grava.
PLATAFORMAS_STEAM = {'windows': 'PC', 'mac': 'macOS', 'linux': 'Linux'}
#: Categorias da loja: Single-player e as de multijogador (online, local, cooperativo, PvP, MMO).
CATEGORIA_SINGLE = 2
CATEGORIAS_MULTI = frozenset({1, 9, 20, 24, 27, 36, 37, 38, 39, 47, 48, 49})
#: Meses de `release_date.date` (`l=portuguese`; o inglês por garantia).
MESES = {nome: numero for numero, nomes in enumerate((
    ('jan',), ('fev', 'feb'), ('mar',), ('abr', 'apr'), ('mai', 'may'), ('jun',), ('jul',),
    ('ago', 'aug'), ('set', 'sep'), ('out', 'oct'), ('nov',), ('dez', 'dec'),
), start=1) for nome in nomes}
_DIA_MES_ANO = re.compile(r'^(\d{1,2})\s+(?:de\s+)?([a-z]+)\.?,?\s+(?:de\s+)?(\d{4})$')
_MES_DIA_ANO = re.compile(r'^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$')
#: Hosts das imagens da loja (CDNs da Steam); capa fora deles fica nula.
HOSTS_DE_IMAGEM_STEAM = ('.steamstatic.com', '.akamaihd.net')
#: Teto do nome, da desenvolvedora e da publicadora vindos da loja.
TETO_TEXTO_LOJA = 300


#: Marcas que a loja põe no nome ("Portal™") e o NFKD viraria letras ("TM").
_MARCAS = str.maketrans('', '', '™®©℠')


def titulo_normalizado(titulo: str | None) -> str:
    """O título sem caixa, acento, pontuação, espaços nem marcas: 'Pórtal™ 2!' → 'portal2'."""
    decomposto = unicodedata.normalize('NFKD', (titulo or '').translate(_MARCAS))
    return ''.join(c for c in decomposto.casefold() if c.isalnum())


def _ano(data) -> int | None:
    if isinstance(data, date):
        return data.year
    achado = re.match(r'(\d{4})-', str(data or ''))
    return int(achado.group(1)) if achado else None


def jogos_da_loja() -> dict[tuple[str, int], set[int]]:
    """As appids dos jogos criados pela loja da Steam (sem `rawg_slug`), por (título normalizado, ano).

    Lidos uma vez por execução: são só os que a sincronização da Steam criou (poucos; 4 em
    produção em 2026-11-25), e a comparação com cada jogo da listagem fica em memória.
    """
    linhas = consultar(
        'SELECT j.steam_appid, m.titulo_original, m.data_lancamento FROM jogos j JOIN midias m USING (id_midia) '
        'WHERE j.steam_appid IS NOT NULL AND j.rawg_slug IS NULL AND m.data_lancamento IS NOT NULL'
    )
    loja: dict[tuple[str, int], set[int]] = {}
    for linha in linhas:
        loja.setdefault((titulo_normalizado(linha['titulo_original']), linha['data_lancamento'].year), set()).add(
            linha['steam_appid'])
    return loja


def chave_na_loja(basico: dict) -> tuple[str, int | None]:
    return titulo_normalizado(basico.get('name')), _ano(basico.get('released'))


def com_capa_e_data(basico: dict) -> bool:
    return bool(basico.get('background_image') and basico.get('released'))


def normalizar_plataformas(plataformas_rawg: list) -> list[str]:
    nomes = [PLATAFORMAS_MAP.get(p['platform']['name'], p['platform']['name']) for p in plataformas_rawg]
    return nomes[:6]


def buscar_detalhe_jogo(slug: str, session, rate_limiter: RateLimiter) -> dict | None:
    if not RAWG_API_KEY:
        raise RuntimeError('RAWG_API_KEY não configurada')

    rate_limiter.wait()
    response = session.get(
        f'{RAWG_BASE_URL}/games/{slug}',
        params={'key': RAWG_API_KEY},
        timeout=30,
    )
    if response.status_code == 404:
        logger.warning('Detalhe do jogo não encontrado no RAWG: %s', slug)
        return None
    if response.status_code == 200:
        return response.json()
    response.raise_for_status()
    return None


def buscar_appids_steam(slug: str, session, rate_limiter: RateLimiter) -> set[int]:
    """As appids da Steam em `GET /games/<slug>/stores` (o detalhe traz as URLs vazias)."""
    rate_limiter.wait()
    response = session.get(
        f"{RAWG_BASE_URL}/games/{quote(str(slug), safe='')}/stores",
        params={'key': RAWG_API_KEY},
        timeout=30,
    )
    if response.status_code == 404:
        return set()
    response.raise_for_status()
    return {
        int(achada.group(1))
        for loja in (response.json() or {}).get('results') or []
        if (achada := _LOJA_STEAM.search(str((loja or {}).get('url') or '')))
    }


def buscar_serie_jogo(slug: str, session, rate_limiter: RateLimiter) -> list[dict]:
    """Os jogos de `GET /games/<slug>/game-series`, no máximo 2 páginas de 40 (80 jogos)."""
    jogos: list[dict] = []
    for pagina in range(1, relacoes.SERIE_PAGINAS + 1):
        rate_limiter.wait()
        response = session.get(
            f"{RAWG_BASE_URL}/games/{quote(str(slug), safe='')}/game-series",
            params={'key': RAWG_API_KEY, 'page': pagina, 'page_size': relacoes.SERIE_POR_PAGINA},
            timeout=30,
        )
        if response.status_code == 404:
            break
        response.raise_for_status()
        corpo = response.json() or {}
        jogos.extend(corpo.get('results') or [])
        if not corpo.get('next'):
            break
    return jogos


def contagens_gravadas(slugs: list[str]) -> dict[str, int | None]:
    """O `game_series_count` gravado de cada slug que já está no Catálogo."""
    return {linha['rawg_slug']: linha['game_series_count'] for linha in consultar(
        'SELECT rawg_slug, game_series_count FROM jogos WHERE rawg_slug = ANY(%s)', (slugs,))}


def serie_a_gravar(detalhe: dict, gravada: int | None, serie: list[dict] | None) -> list[dict] | None:
    """As Relações `MESMA_SERIE` que o jogo passa a ter, ou None para não mexer nas que ele tem.

    Com a série buscada, ela; com a contagem zerada e uma série gravada antes, nenhuma.
    """
    if serie is not None:
        return relacoes.da_serie(serie, detalhe.get('slug'))
    if relacoes.contagem_da_serie(detalhe) == 0 and gravada:
        return []
    return None


def _obter_sessao_rawg_worker():
    session = getattr(RAWG_THREAD_LOCAL, 'session', None)
    if session is None:
        session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
        RAWG_THREAD_LOCAL.session = session
    return session


def processar_e_inserir_jogo(basico: dict, detalhe: dict, t=None, steam_appid: int | None = None):
    """Processa um jogo do RAWG e grava no banco (um comando por Mídia; `t`: a conexão da página).

    `steam_appid`: a appid confirmada de um jogo da loja; o upsert acha essa Mídia por ela.
    """
    tags = [tag['name'].lower().replace('-', '').replace(' ', '') for tag in detalhe.get('tags', [])]
    if 'singleplayer' in tags and 'multiplayer' in tags:
        modo_jogo = 'ambos'
    elif 'multiplayer' in tags:
        modo_jogo = 'multi'
    else:
        modo_jogo = 'single'

    esrb = (basico.get('esrb_rating') or {}).get('name')
    dados = {
        'titulo_original': basico['name'],
        'titulo_portugues': basico.get('name'),
        'sinopse': truncar(detalhe.get('description_raw'), 1000),
        'data_lancamento': basico.get('released'),
        'nota_fonte': nota_fonte_rawg(basico.get('rating')),
        'poster_url': basico.get('background_image'),
        'desenvolvedor': (detalhe.get('developers') or [{}])[0].get('name'),
        'publicadora': (detalhe.get('publishers') or [{}])[0].get('name'),
        'plataformas': normalizar_plataformas(basico.get('platforms') or []),
        'status_jogo': 'lancado' if basico.get('released') else 'em_desenvolvimento',
        'modo_jogo': modo_jogo,
        'classificacao': f'ESRB: {esrb}' if esrb else None,
        'rawg_slug': basico.get('slug'),
        'steam_appid': steam_appid or appid_da_steam(detalhe, basico),
        'trailer_url': None,
        'game_series_count': relacoes.contagem_da_serie(detalhe),
    }
    generos = [GENERO_MAP.get(genero['name'], genero['name']) for genero in basico.get('genres', [])]

    result = salvar_jogo(dados, generos, t)
    logger.info("Jogo importado: %s (%s)", dados['titulo_original'], result['id_midia'])
    return result


def processar_e_inserir_jogo_do_detalhe(detalhe: dict) -> dict:
    """O jogo que uma Integração traz pelo RAWG (`GET /games/<slug>`, o básico e o resto).

    `game_series`, se veio, é a série que a Integração buscou (`integracoes.rawg.Rawg.serie`, pela
    regra de `relacoes.precisa_da_serie`): o jogo é gravado e ganha as Relações `MESMA_SERIE`.
    """
    result = processar_e_inserir_jogo(detalhe, detalhe)
    if detalhe.get('game_series') is not None:
        with autocommit() as t:
            salvar_relacoes(t, {result['id_midia']: relacoes.da_serie(detalhe['game_series'], detalhe.get('slug'))})
    return result


def appid_da_steam(*jogos: dict) -> int | None:
    """A appid de `store.steampowered.com/app/<appid>` nas lojas (`stores[].url`) do jogo do RAWG.

    O jogo com essa appid que já veio da loja da Steam é atualizado em vez de duplicado.
    """
    for jogo in jogos:
        for loja in (jogo or {}).get('stores') or []:
            achada = _LOJA_STEAM.search(str((loja or {}).get('url') or ''))
            if achada:
                return int(achada.group(1))
    return None


def _data_da_loja(texto: str | None) -> date | None:
    """`release_date.date` da loja ('21 ago. 2012', '21 Aug, 2012'); só a data completa, senão None."""
    texto = (texto or '').strip().lower()
    achada = _DIA_MES_ANO.match(texto)
    if achada:
        dia, mes, ano = achada.groups()
    else:
        achada = _MES_DIA_ANO.match(texto)
        if not achada:
            return None
        mes, dia, ano = achada.groups()
    if mes[:3] not in MESES:
        return None
    try:
        return date(int(ano), MESES[mes[:3]], int(dia))
    except ValueError:
        return None


def _texto_da_loja(texto: str | None) -> str | None:
    """`short_description` sem as tags e as entidades HTML que a loja às vezes manda."""
    if not texto or not isinstance(texto, str):
        return None
    return truncar(html.unescape(re.sub(r'<[^>]+>', '', texto)).strip(), 1000) or None


def _curto_da_loja(valor) -> str | None:
    """Nome, desenvolvedora ou publicadora da loja: só texto, sem espaços nas pontas, até o teto."""
    if not isinstance(valor, str):
        return None
    return valor.strip()[:TETO_TEXTO_LOJA] or None


def _primeiro(lista) -> str | None:
    return _curto_da_loja(lista[0]) if isinstance(lista, list) and lista else None


def imagem_da_steam(url) -> str | None:
    """A URL, se for `https://` de um host de imagem da Steam; senão None (a loja é dado de fora)."""
    if not isinstance(url, str):
        return None
    try:
        partes = urlsplit(url.strip())
    except ValueError:
        return None
    host = (partes.hostname or '').lower()
    if partes.scheme != 'https' or partes.username or partes.password or not host.endswith(HOSTS_DE_IMAGEM_STEAM):
        return None
    return url.strip()


def dados_do_jogo_steam(loja: dict) -> tuple[dict, list[str]]:
    """O `data` do `appdetails` no formato de `salvar_jogo`: (dados, gêneros).

    Sem Nota da fonte (a loja não tem) e sem `rawg_slug`: a Mídia é achada pelo `steam_appid`,
    e a Importação do RAWG que trouxer a mesma appid a atualiza. A capa vertical
    (`capa_vertical`, que a sincronização só põe depois de confirmar que existe) vira o poster e
    a `header_image` o banner; sem ela, a `header_image` é as duas. Imagens só dos hosts da Steam.
    """
    lancamento = loja.get('release_date') or {}
    categorias = {c.get('id') for c in loja.get('categories') or [] if isinstance(c, dict)}
    single, multi = CATEGORIA_SINGLE in categorias, bool(categorias & CATEGORIAS_MULTI)
    plataformas = loja.get('platforms') or {}
    nome = _curto_da_loja(loja.get('name'))
    horizontal = imagem_da_steam(loja.get('header_image'))
    dados = {
        'titulo_original': nome,
        'titulo_portugues': nome,
        'sinopse': _texto_da_loja(loja.get('short_description')),
        'data_lancamento': _data_da_loja(lancamento.get('date')),
        'nota_fonte': None,
        'poster_url': imagem_da_steam(loja.get('capa_vertical')) or horizontal,
        'banner_url': horizontal,
        'desenvolvedor': _primeiro(loja.get('developers')),
        'publicadora': _primeiro(loja.get('publishers')),
        'plataformas': [rotulo for chave, rotulo in PLATAFORMAS_STEAM.items() if plataformas.get(chave)],
        'status_jogo': 'em_desenvolvimento' if lancamento.get('coming_soon') else 'lancado',
        'modo_jogo': 'ambos' if single and multi else 'multi' if multi else 'single',
        'classificacao': None,
        'rawg_slug': None,
        'steam_appid': int(loja['steam_appid']),
        'trailer_url': None,
    }
    generos = [
        GENERO_MAP.get(GENEROS_STEAM[str(g.get('id'))], GENEROS_STEAM[str(g.get('id'))])
        for g in loja.get('genres') or [] if isinstance(g, dict) and str(g.get('id')) in GENEROS_STEAM
    ]
    return dados, generos


def processar_e_inserir_jogo_steam(loja: dict) -> dict:
    """Grava o jogo da loja da Steam pela mesma rotina do RAWG (`salvar_jogo`, upsert)."""
    dados, generos = dados_do_jogo_steam(loja)
    result = salvar_jogo(dados, generos)
    logger.info('Jogo importado da loja da Steam: %s (%s)', dados['titulo_original'], result['id_midia'])
    return result


def importar_jogos(paginas: int = 25, workers: int = 4, do_inicio: bool = False):
    """Executa a importação em lote de jogos. Sem RAWG_API_KEY, pula com aviso."""
    stats = ImportStats(tipo_midia='jogo', origem='RAWG')
    if not RAWG_API_KEY:
        stats.pulado = 'RAWG_API_KEY não configurada'
        logger.warning('Importação de jogos pulada: RAWG_API_KEY não configurada.')
        return stats

    session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
    rate_limiter = RateLimiter(0.25)
    loja: dict[tuple[str, int], set[int]] = {}
    loja_lida = False
    gravadas: dict[str, int | None] = {}

    def buscar_paginas(inicio: int):
        """Páginas da listagem da RAWG; `next` nulo é o fim da fonte."""
        for pagina in range(inicio, inicio + paginas):
            try:
                rate_limiter.wait()
                response = session.get(
                    f'{RAWG_BASE_URL}/games',
                    params={
                        'key': RAWG_API_KEY,
                        'ordering': '-added',
                        'page': pagina,
                        'page_size': 40,
                    },
                    timeout=30,
                )
                response.raise_for_status()
                data = response.json()
            except Exception as exc:
                yield {'pagina': pagina, 'itens': [], 'erro': exc, 'payload': {'pagina': pagina}}
                return
            yield {'pagina': pagina, 'itens': data.get('results', []), 'erro': None, 'fim': not data.get('next')}

    def carregar_detalhe(jogo_basico: dict):
        worker_session = _obter_sessao_rawg_worker()
        detalhe = buscar_detalhe_jogo(jogo_basico['slug'], worker_session, rate_limiter)
        candidatas = loja.get(chave_na_loja(jogo_basico))  # lido em importar_pagina; só leitura aqui
        appid = None
        if detalhe and candidatas:
            confirmadas = buscar_appids_steam(jogo_basico['slug'], worker_session, rate_limiter) & candidatas
            appid = min(confirmadas, default=None)
        serie = None
        contagem = relacoes.contagem_da_serie(detalhe)
        if detalhe and relacoes.precisa_da_serie(contagem, gravadas.get(jogo_basico['slug'])):
            serie = buscar_serie_jogo(jogo_basico['slug'], worker_session, rate_limiter)
        return {'detalhe': detalhe, 'steam_appid': appid, 'serie': serie}

    def importar_pagina(pagina: dict):
        nonlocal loja_lida
        itens = [jogo for jogo in pagina['itens'] if com_capa_e_data(jogo)]
        stats.registrar_pulados(len(pagina['itens']) - len(itens))
        if not itens:
            return
        if not loja_lida:
            # Uma vez por execução, na primeira página com jogos.
            loja.update(jogos_da_loja())
            loja_lida = True
        # A contagem da série gravada de cada jogo da página (só leitura nos workers).
        gravadas.clear()
        gravadas.update(contagens_gravadas([jogo['slug'] for jogo in itens]))
        series: dict[str, list[dict]] = {}
        # Uma conexão por página; cada Mídia é um comando (a sua transação), e as séries da página, um só.
        with autocommit() as t:
            for jogo_basico, detalhe_result, detalhe_exc in executar_em_paralelo(
                itens,
                carregar_detalhe,
                max_workers=workers,
            ):
                detalhe = None
                try:
                    if detalhe_exc:
                        raise detalhe_exc

                    detalhe = (detalhe_result or {}).get('detalhe')
                    if not detalhe:
                        raise LookupError('Detalhes do jogo não retornados pela API')

                    appid = detalhe_result.get('steam_appid')
                    result = processar_e_inserir_jogo(jogo_basico, detalhe, t, appid)
                    if appid:
                        # O jogo da loja ganhou o `rawg_slug`: não é mais candidato.
                        loja[chave_na_loja(jogo_basico)].discard(appid)
                    serie = serie_a_gravar(detalhe, gravadas.get(jogo_basico['slug']), detalhe_result.get('serie'))
                    if serie is not None:
                        series[result['id_midia']] = serie
                    stats.registrar_sucesso(ja_existia=result['ja_existia'])
                except Indisponivel:
                    # Sem banco não é falha do item: encerra o Tipo sem avançar o cursor.
                    raise
                except Exception as exc:
                    stats.registrar_falha()
                    registrar_falha_importacao(
                        tipo_midia='jogo',
                        origem='RAWG',
                        exc=exc,
                        identificador=jogo_basico.get('slug'),
                        titulo=jogo_basico.get('name'),
                        payload={'basico': jogo_basico, 'detalhe': detalhe},
                        extra={'pagina': pagina['pagina']},
                    )
            relacoes.gravar_da_pagina(t, 'jogo', series, pagina['pagina'], origem='RAWG')

    try:
        cursor.importar_paginas('jogo', 'RAWG', stats, buscar_paginas, importar_pagina, do_inicio)

        logger.info('Importação de jogos concluída. %s', stats.to_dict())
        if stats.falhas:
            logger.warning('Falhas de importação registradas em %s', ERROR_LOG_PATH)
        return stats
    finally:
        session.close()
