"""
Importador de mangás via AniList.
"""
from __future__ import annotations

from importacao.anilist import importar_do_anilist
from importacao.db import salvar_manga
from importacao.utils import (
    ERROR_LOG_PATH,
    ImportStats,
    RateLimiter,
    criar_sessao_http,
    formatar_data_anilist,
    logger,
    nota_fonte_anilist,
    registrar_falha_importacao,
    remover_html,
    truncar,
)

GENERO_MAP = {
    'Action': 'Ação',
    'Adventure': 'Aventura',
    'Comedy': 'Comédia',
    'Drama': 'Drama',
    'Fantasy': 'Fantasia',
    'Sci-Fi': 'Ficção Científica',
    'Romance': 'Romance',
    'Slice of Life': 'Slice of Life',
    'Supernatural': 'Sobrenatural',
    'Mystery': 'Mistério',
    'Horror': 'Terror',
    'Sports': 'Esportes',
}

STATUS_MAP = {
    'RELEASING': 'em_publicacao',
    'FINISHED': 'finalizado',
    'NOT_YET_RELEASED': 'aguardando',
    'CANCELLED': 'cancelado',
    'HIATUS': 'hiato',
}

DEMOGRAFIA_MAP = {
    'Shounen': 'shounen',
    'Shoujo': 'shoujo',
    'Seinen': 'seinen',
    'Josei': 'josei',
}


def _extrair_autoria(staff: dict | None) -> tuple[str | None, str | None]:
    autor = None
    artista = None

    for edge in (staff or {}).get('edges', []):
        role = edge.get('role', '')
        nome = edge.get('node', {}).get('name', {}).get('full')
        if not nome:
            continue
        if 'Story & Art' in role:
            return nome, nome
        if 'Story' in role and not autor:
            autor = nome
        if 'Art' in role and not artista:
            artista = nome

    return autor, artista or autor


def processar_e_inserir_manga(manga: dict):
    """Processa um item do AniList e grava no banco (uma transação por Mídia)."""
    autor, artista = _extrair_autoria(manga.get('staff'))
    demografia = None
    generos = []

    for genero in manga.get('genres', []):
        if genero in DEMOGRAFIA_MAP and not demografia:
            demografia = DEMOGRAFIA_MAP[genero]
        else:
            generos.append(GENERO_MAP.get(genero, genero))

    dados = {
        'titulo_original': manga['title'].get('native') or manga['title'].get('romaji'),
        'titulo_ingles': manga['title'].get('english'),
        'titulo_portugues': manga['title'].get('romaji') or manga['title'].get('english'),
        'sinopse': truncar(remover_html(manga.get('description')), 1000),
        'data_lancamento': formatar_data_anilist(manga.get('startDate')),
        'nota_fonte': nota_fonte_anilist(manga.get('meanScore')),
        'poster_url': manga.get('coverImage', {}).get('large'),
        'banner_url': manga.get('bannerImage'),
        'status_manga': STATUS_MAP.get(manga.get('status'), 'aguardando'),
        'numero_capitulos': manga.get('chapters'),
        'numero_volumes': manga.get('volumes'),
        'autor': autor,
        'artista': artista,
        'demografia': demografia,
        'anilist_id': manga.get('id'),
    }

    result = salvar_manga(dados, generos)
    logger.info("Mangá importado: %s (%s)", dados['titulo_original'], result['id_midia'])
    return result


def importar_mangas(paginas: int = 20):
    """Executa a importação em lote de mangás."""
    stats = ImportStats(tipo_midia='manga', origem='AniList')
    session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
    rate_limiter = RateLimiter(0.35)

    try:
        for pagina in importar_do_anilist('MANGA', paginas, session=session, rate_limiter=rate_limiter):
            if pagina.get('erro'):
                stats.registrar_falha_pagina(pagina['pagina'])
                registrar_falha_importacao(
                    tipo_midia='manga',
                    origem='AniList',
                    exc=pagina['erro'],
                    identificador=f"pagina-{pagina['pagina']}",
                    payload=pagina.get('payload'),
                    extra={'pagina': pagina['pagina'], 'etapa': 'listar_pagina'},
                )
                continue

            for item in pagina['itens']:
                try:
                    result = processar_e_inserir_manga(item)
                    stats.registrar_sucesso(ja_existia=result['ja_existia'])
                except Exception as exc:
                    stats.registrar_falha()
                    registrar_falha_importacao(
                        tipo_midia='manga',
                        origem='AniList',
                        exc=exc,
                        identificador=item.get('id'),
                        titulo=(item.get('title') or {}).get('romaji'),
                        payload=item,
                        extra={'pagina': pagina['pagina']},
                    )

        logger.info('Importação de mangás concluída. %s', stats.to_dict())
        if stats.falhas:
            logger.warning('Falhas de importação registradas em %s', ERROR_LOG_PATH)
        return stats
    finally:
        session.close()
