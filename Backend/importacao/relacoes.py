"""
Relações de anime e mangá vindas do AniList, e a Mesma série dos jogos vinda do RAWG
(CONTEXT.md, Relação; spec `relacoes`).

- `da_obra`: as Relações de um item do AniList, validadas antes de gravar (ADR 0015).
- `da_serie`, `contagem_da_serie`, `precisa_da_serie`: a série de um jogo (`game-series`), que só
  é buscada quando o `game_series_count` do detalhe é maior que zero e mudou.
- `gravar_da_pagina`: as Relações das Mídias de uma página da Importação, num comando só; a
  reimportação troca as da Mídia.
- `carregar`: a carga única, que percorre os `anilist_id` do Catálogo em lotes de 50 (`id_in`)
  e grava só as Relações (`run_import --so-relacoes`), a ~30 consultas por minuto.
"""
from __future__ import annotations

import re
from datetime import date
from urllib.parse import urlsplit

from banco import Indisponivel, autocommit, consultar
from importacao import anilist
from importacao.db import salvar_relacoes
from importacao.utils import (
    ImportStats,
    RateLimiter,
    criar_sessao_http,
    logger,
    registrar_falha_importacao,
    truncar,
)

#: Obras por consulta da carga única (o máximo de uma página do AniList).
LOTE = 50
#: Intervalo entre as consultas da carga única: ~30 por minuto, o limite da API pública.
INTERVALO_CARGA = 2.0
#: Teto do título da obra relacionada.
TETO_TITULO = 300

_CODIGO = re.compile(r'^[A-Z_]{1,40}$')
_TIPOS = {'ANIME': 'anime', 'MANGA': 'manga'}
_TABELAS = {'anime': 'animes', 'manga': 'mangas'}
#: Host das capas do AniList (`s4.anilist.co`); capa fora dele fica nula.
HOST_DE_CAPA = 'anilist.co'
#: Host das capas do RAWG (`media.rawg.io`).
HOST_DE_CAPA_RAWG = 'media.rawg.io'
#: Jogos por página do `/games/<slug>/game-series` e páginas lidas no máximo (80 jogos).
SERIE_POR_PAGINA = 40
SERIE_PAGINAS = 2
_SLUG = re.compile(r'^[a-z0-9][a-z0-9-]{0,199}$')


def _capa(url, host_da_fonte: str = HOST_DE_CAPA) -> str | None:
    if not isinstance(url, str):
        return None
    try:
        partes = urlsplit(url.strip())
    except ValueError:
        return None
    host = (partes.hostname or '').lower()
    if partes.scheme != 'https' or partes.username or partes.password:
        return None
    return url.strip() if host == host_da_fonte or host.endswith(f'.{host_da_fonte}') else None


def _estreia(start_date) -> date | None:
    if not isinstance(start_date, dict):
        return None
    ano, mes, dia = (start_date.get(c) for c in ('year', 'month', 'day'))
    if not isinstance(ano, int) or isinstance(ano, bool):
        return None
    try:
        return date(ano, mes if isinstance(mes, int) else 1, dia if isinstance(dia, int) else 1)
    except (ValueError, TypeError):
        return None


def _titulo(titulos) -> str | None:
    if not isinstance(titulos, dict):
        return None
    for chave in ('romaji', 'english', 'native'):
        valor = titulos.get(chave)
        if isinstance(valor, str) and valor.strip():
            return truncar(valor.strip(), TETO_TITULO)
    return None


def da_obra(obra: dict) -> list[dict]:
    """As Relações de um item do AniList como `relacoes_midia` as guarda (sem o `id_midia`).

    Aresta com código, Tipo, id ou título fora do esperado fica de fora; o mesmo destino duas
    vezes vale a primeira. Os códigos que a leitura não mostra (`CHARACTER`, `OTHER`) são gravados.
    """
    relacoes, vistos = [], set()
    for aresta in ((obra.get('relations') or {}).get('edges') or []):
        if not isinstance(aresta, dict):
            continue
        codigo, no = aresta.get('relationType'), aresta.get('node')
        if not isinstance(codigo, str) or not _CODIGO.match(codigo) or not isinstance(no, dict):
            continue
        tipo, anilist_id, titulo = _TIPOS.get(no.get('type')), no.get('id'), _titulo(no.get('title'))
        if tipo is None or not isinstance(anilist_id, int) or isinstance(anilist_id, bool) \
                or not 0 < anilist_id < 2**31 or titulo is None or (tipo, anilist_id) in vistos:
            continue
        vistos.add((tipo, anilist_id))
        formato = no.get('format')
        estreia = _estreia(no.get('startDate'))
        relacoes.append({
            'relacao': codigo,
            'fonte': 'AniList',
            'tipo_destino': tipo,
            'destino_anilist_id': anilist_id,
            'destino_rawg_slug': None,
            'titulo': titulo,
            'formato': formato if isinstance(formato, str) and _CODIGO.match(formato) else None,
            'data_lancamento': estreia.isoformat() if estreia else None,
            'adulto': no.get('isAdult') is True,
            'poster_url': _capa((no.get('coverImage') or {}).get('large')),
        })
    return relacoes


def contagem_da_serie(detalhe: dict | None) -> int | None:
    """O `game_series_count` do detalhe do RAWG; None se não veio ou não é um inteiro >= 0."""
    contagem = (detalhe or {}).get('game_series_count')
    if not isinstance(contagem, int) or isinstance(contagem, bool) or not 0 <= contagem < 2**31:
        return None
    return contagem


def precisa_da_serie(contagem: int | None, gravada: int | None) -> bool:
    """`game-series` só é chamado com contagem maior que zero e diferente da gravada (nula no jogo novo)."""
    return bool(contagem) and contagem != gravada


def da_serie(jogos, slug_proprio: str | None = None) -> list[dict]:
    """Os jogos do `/games/<slug>/game-series` como Relações `MESMA_SERIE` (sem o `id_midia`).

    Jogo com slug ou título fora do esperado, o próprio jogo e o repetido ficam de fora. Adulto é o
    ESRB `adults-only`.
    """
    relacoes, vistos = [], {slug_proprio}
    for jogo in jogos or []:
        if not isinstance(jogo, dict):
            continue
        slug, titulo = jogo.get('slug'), jogo.get('name')
        if not isinstance(slug, str) or not _SLUG.match(slug) or slug in vistos \
                or not isinstance(titulo, str) or not titulo.strip():
            continue
        vistos.add(slug)
        try:
            lancamento = date.fromisoformat(jogo.get('released')) if isinstance(jogo.get('released'), str) else None
        except ValueError:
            lancamento = None
        relacoes.append({
            'relacao': 'MESMA_SERIE',
            'fonte': 'RAWG',
            'tipo_destino': 'jogo',
            'destino_anilist_id': None,
            'destino_rawg_slug': slug,
            'titulo': truncar(titulo.strip(), TETO_TITULO),
            'formato': None,
            'data_lancamento': lancamento.isoformat() if lancamento else None,
            'adulto': ((jogo.get('esrb_rating') or {}).get('slug') == 'adults-only'),
            'poster_url': _capa(jogo.get('background_image'), HOST_DE_CAPA_RAWG),
        })
    return relacoes


def gravar_da_pagina(t, tipo_midia: str, relacoes_por_midia: dict[str, list[dict]], pagina: int,
                     origem: str = 'AniList') -> bool:
    """Grava as Relações de uma página; a falha fica no log da Importação e não derruba a página."""
    try:
        salvar_relacoes(t, relacoes_por_midia)
        return True
    except Indisponivel:
        raise
    except Exception as exc:
        registrar_falha_importacao(
            tipo_midia=tipo_midia, origem=origem, exc=exc, identificador=f'relacoes-pagina-{pagina}',
            extra={'pagina': pagina, 'etapa': 'relacoes'},
        )
        return False


def _midias_do_catalogo(tipo_midia: str) -> list[tuple[int, str]]:
    tabela = _TABELAS[tipo_midia]
    return [(linha['anilist_id'], linha['id_midia']) for linha in consultar(
        f'SELECT anilist_id, id_midia FROM {tabela} WHERE anilist_id IS NOT NULL ORDER BY anilist_id'
    )]


def carregar(tipo_midia: str) -> ImportStats:
    """Carga única: grava só as Relações de todos os animes ou mangás do Catálogo.

    Lote com falha fica no log (`paginas_com_falha`, numerados de 1) e a carga segue; rodar de
    novo refaz tudo. A obra que o AniList não devolve fica com as Relações que tinha.
    """
    stats = ImportStats(tipo_midia=tipo_midia, origem='AniList')
    session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
    rate_limiter = RateLimiter(INTERVALO_CARGA)
    try:
        midias = _midias_do_catalogo(tipo_midia)
        id_midia = dict(midias)
        lotes = [midias[i:i + LOTE] for i in range(0, len(midias), LOTE)]
        logger.info('Carga das Relações de %s: %s obras em %s lotes', tipo_midia, len(midias), len(lotes))
        for numero, lote in enumerate(lotes, start=1):
            resposta = anilist.buscar_relacoes(session, rate_limiter, tipo_midia.upper(), [a for a, _ in lote])
            if resposta['erro'] is not None:
                stats.registrar_falha_pagina(numero)
                registrar_falha_importacao(
                    tipo_midia=tipo_midia, origem='AniList', exc=resposta['erro'],
                    identificador=f'relacoes-lote-{numero}',
                    payload=resposta['payload'], extra={'pagina': numero, 'etapa': 'carga_relacoes'},
                )
                continue
            por_midia = {id_midia[obra['id']]: da_obra(obra) for obra in resposta['itens']
                         if isinstance(obra, dict) and obra.get('id') in id_midia}
            with autocommit() as t:
                if gravar_da_pagina(t, tipo_midia, por_midia, numero):
                    for _ in por_midia:
                        stats.registrar_sucesso(ja_existia=True)
                else:
                    stats.registrar_falha_pagina(numero)
        logger.info('Carga das Relações de %s concluída. %s', tipo_midia, stats.to_dict())
        return stats
    finally:
        session.close()
