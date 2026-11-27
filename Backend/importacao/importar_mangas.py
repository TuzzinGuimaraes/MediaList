"""
Importador de mangás via AniList.
"""
from __future__ import annotations

from banco import Indisponivel, autocommit
from importacao import anilist, cursor, relacoes
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


def processar_e_inserir_manga(manga: dict, t=None):
    """Processa um item do AniList e grava no banco (um comando por Mídia; `t`: a conexão da página)."""
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
        'adulto': manga.get('isAdult') is True,
        'anilist_id': manga.get('id'),
    }

    result = salvar_manga(dados, generos, t)
    logger.info("Mangá importado: %s (%s)", dados['titulo_original'], result['id_midia'])
    return result


def importar_mangas(
    paginas: int = 20, do_inicio: bool = False, paginas_atualizacao: int = anilist.PAGINAS_ATUALIZACAO,
):
    """Importação de mangás: `paginas` do crescimento e `paginas_atualizacao` das populares."""
    stats = ImportStats(tipo_midia='manga', origem='AniList')
    session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
    rate_limiter = RateLimiter(0.35)

    def importar_pagina(pagina: dict):
        if not pagina['itens']:
            return
        # Uma conexão por página; cada Mídia é um comando (a sua transação), e as Relações da
        # página, mais uma.
        with autocommit() as t:
            relacoes_por_midia = {}
            for item in pagina['itens']:
                try:
                    result = processar_e_inserir_manga(item, t)
                    stats.registrar_sucesso(ja_existia=result['ja_existia'])
                    relacoes_por_midia[result['id_midia']] = relacoes.da_obra(item)
                except Indisponivel:
                    # Sem banco não é falha do item: encerra o Tipo sem avançar o cursor.
                    raise
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
            relacoes.gravar_da_pagina(t, 'manga', relacoes_por_midia, pagina['pagina'])

    try:
        cursor.importar_anilist(
            'manga', stats,
            lambda pagina, sort, filtros: anilist.buscar_pagina(
                session, rate_limiter, 'MANGA', pagina, sort, filtros
            ),
            importar_pagina, paginas, paginas_atualizacao, do_inicio,
        )

        logger.info('Importação de mangás concluída. %s', stats.to_dict())
        if stats.falhas:
            logger.warning('Falhas de importação registradas em %s', ERROR_LOG_PATH)
        return stats
    finally:
        session.close()
