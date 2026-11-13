"""
Importador de animes via AniList.
"""
from __future__ import annotations

from importacao.anilist import importar_do_anilist
from importacao.db import salvar_anime
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
    'Mecha': 'Mecha',
    'Music': 'Música',
    'Psychological': 'Drama',
    'Thriller': 'Mistério',
}

STATUS_MAP = {
    'RELEASING': 'em_exibicao',
    'FINISHED': 'finalizado',
    'NOT_YET_RELEASED': 'aguardando',
    'CANCELLED': 'cancelado',
    'HIATUS': 'aguardando',
}

SOURCE_MAP = {
    'MANGA': 'Manga',
    'LIGHT_NOVEL': 'Light Novel',
    'NOVEL': 'Novel',
    'VISUAL_NOVEL': 'Visual Novel',
    'VIDEO_GAME': 'Video Game',
    'ORIGINAL': 'Original',
    'ANIME': 'Anime',
    'OTHER': 'Outro',
}


def processar_e_inserir_anime(anime: dict):
    """Processa um item do AniList e grava no banco (uma transação por Mídia)."""
    trailer_url = None
    if anime.get('trailer') and anime['trailer'].get('site', '').lower() == 'youtube':
        trailer_url = f"https://www.youtube.com/watch?v={anime['trailer']['id']}"

    dados = {
        'titulo_original': anime['title'].get('native') or anime['title'].get('romaji'),
        'titulo_ingles': anime['title'].get('english'),
        'titulo_portugues': anime['title'].get('romaji') or anime['title'].get('english'),
        'sinopse': truncar(remover_html(anime.get('description')), 1000),
        'data_lancamento': formatar_data_anilist(anime.get('startDate')),
        'status_anime': STATUS_MAP.get(anime.get('status'), 'aguardando'),
        'numero_episodios': anime.get('episodes'),
        'duracao_episodio': anime.get('duration'),
        'classificacao_etaria': '18' if anime.get('isAdult') else None,
        'nota_fonte': nota_fonte_anilist(anime.get('meanScore')),
        'poster_url': anime.get('coverImage', {}).get('large'),
        'banner_url': anime.get('bannerImage'),
        'estudio': (anime.get('studios', {}).get('nodes') or [{}])[0].get('name'),
        'fonte_original': SOURCE_MAP.get(anime.get('source')),
        'trailer_url': trailer_url,
        'anilist_id': anime.get('id'),
    }
    generos = [GENERO_MAP.get(genero, genero) for genero in anime.get('genres', [])]

    result = salvar_anime(dados, generos)
    logger.info("Anime importado: %s (%s)", dados['titulo_original'], result['id_midia'])
    return result


def importar_animes(paginas: int = 20):
    """Executa a importação em lote de animes."""
    stats = ImportStats(tipo_midia='anime', origem='AniList')
    session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
    rate_limiter = RateLimiter(0.35)

    try:
        for pagina in importar_do_anilist('ANIME', paginas, session=session, rate_limiter=rate_limiter):
            if pagina.get('erro'):
                stats.registrar_falha_pagina(pagina['pagina'])
                registrar_falha_importacao(
                    tipo_midia='anime',
                    origem='AniList',
                    exc=pagina['erro'],
                    identificador=f"pagina-{pagina['pagina']}",
                    payload=pagina.get('payload'),
                    extra={'pagina': pagina['pagina'], 'etapa': 'listar_pagina'},
                )
                continue

            for item in pagina['itens']:
                try:
                    result = processar_e_inserir_anime(item)
                    stats.registrar_sucesso(ja_existia=result['ja_existia'])
                except Exception as exc:
                    stats.registrar_falha()
                    registrar_falha_importacao(
                        tipo_midia='anime',
                        origem='AniList',
                        exc=exc,
                        identificador=item.get('id'),
                        titulo=(item.get('title') or {}).get('romaji'),
                        payload=item,
                        extra={'pagina': pagina['pagina']},
                    )

        logger.info('Importação de animes concluída. %s', stats.to_dict())
        if stats.falhas:
            logger.warning('Falhas de importação registradas em %s', ERROR_LOG_PATH)
        return stats
    finally:
        session.close()
