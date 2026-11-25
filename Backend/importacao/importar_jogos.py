"""
Importador de jogos via RAWG (e o jogo da loja da Steam, que entra pela mesma gravação).
"""
from __future__ import annotations

import html
import re
from datetime import date
from threading import local
from urllib.parse import urlsplit

from importacao import cursor
from importacao.config import RAWG_API_KEY, RAWG_BASE_URL
from importacao.db import salvar_jogo
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


def _obter_sessao_rawg_worker():
    session = getattr(RAWG_THREAD_LOCAL, 'session', None)
    if session is None:
        session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
        RAWG_THREAD_LOCAL.session = session
    return session


def processar_e_inserir_jogo(basico: dict, detalhe: dict):
    """Processa um jogo do RAWG e grava no banco (uma transação por Mídia)."""
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
        'steam_appid': appid_da_steam(detalhe, basico),
        'trailer_url': None,
    }
    generos = [GENERO_MAP.get(genero['name'], genero['name']) for genero in basico.get('genres', [])]

    result = salvar_jogo(dados, generos)
    logger.info("Jogo importado: %s (%s)", dados['titulo_original'], result['id_midia'])
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

    def buscar_paginas(inicio: int):
        """Páginas da listagem da RAWG; `next` nulo é o fim da fonte."""
        for pagina in range(inicio, inicio + paginas):
            try:
                rate_limiter.wait()
                response = session.get(
                    f'{RAWG_BASE_URL}/games',
                    params={
                        'key': RAWG_API_KEY,
                        'ordering': '-rating',
                        'page': pagina,
                        'page_size': 40,
                        'metacritic': '60,100',
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
        return {'detalhe': buscar_detalhe_jogo(jogo_basico['slug'], worker_session, rate_limiter)}

    def importar_pagina(pagina: dict):
        for jogo_basico, detalhe_result, detalhe_exc in executar_em_paralelo(
            pagina['itens'],
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

                result = processar_e_inserir_jogo(jogo_basico, detalhe)
                stats.registrar_sucesso(ja_existia=result['ja_existia'])
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

    try:
        cursor.importar_paginas('jogo', 'RAWG', stats, buscar_paginas, importar_pagina, do_inicio)

        logger.info('Importação de jogos concluída. %s', stats.to_dict())
        if stats.falhas:
            logger.warning('Falhas de importação registradas em %s', ERROR_LOG_PATH)
        return stats
    finally:
        session.close()
