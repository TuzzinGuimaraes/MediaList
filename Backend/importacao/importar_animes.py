"""
Importador de animes via AniList.
"""
from __future__ import annotations

from datetime import date

from banco import Indisponivel, autocommit
from importacao import anilist, cursor
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

#: `MediaSeason` do AniList → estação da Temporada.
ESTACAO_MAP = {'WINTER': 'inverno', 'SPRING': 'primavera', 'SUMMER': 'verao', 'FALL': 'outono'}
#: Estações na ordem do ano, um trimestre cada (a divisão do AniList).
ESTACOES_DO_ANO = ('inverno', 'primavera', 'verao', 'outono')
#: `MediaFormat` de anime que o Catálogo guarda; outro vira desconhecido (nulo).
FORMATOS = {'TV', 'TV_SHORT', 'ONA', 'MOVIE', 'SPECIAL', 'OVA', 'MUSIC'}

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


def hoje() -> date:
    """O dia da execução, que diz qual é a Temporada atual (os testes trocam)."""
    return date.today()


def _inteiro(valor) -> int | None:
    return valor if isinstance(valor, int) and not isinstance(valor, bool) else None


def temporada_do_anime(anime: dict) -> tuple[str | None, int | None, bool]:
    """(estação, ano, estimada): a Temporada do AniList ou, sem ela, a do mês de estreia.

    Sem nenhuma das duas (estreia sem mês), sem Temporada.
    """
    estacao, ano = ESTACAO_MAP.get(anime.get('season')), _inteiro(anime.get('seasonYear'))
    if estacao and ano:
        return estacao, ano, False
    estreia = anime.get('startDate') or {}
    ano, mes = _inteiro(estreia.get('year')), _inteiro(estreia.get('month'))
    if ano and mes and 1 <= mes <= 12:
        return ESTACOES_DO_ANO[(mes - 1) // 3], ano, True
    return None, None, False


def processar_e_inserir_anime(anime: dict, t=None):
    """Processa um item do AniList e grava no banco (um comando por Mídia; `t`: a conexão da página)."""
    trailer_url = None
    if anime.get('trailer') and anime['trailer'].get('site', '').lower() == 'youtube':
        trailer_url = f"https://www.youtube.com/watch?v={anime['trailer']['id']}"

    estacao, ano, estimada = temporada_do_anime(anime)
    popularidade = _inteiro(anime.get('popularity'))
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
        'temporada_estacao': estacao,
        'temporada_ano': ano,
        'temporada_estimada': estimada,
        'formato': anime.get('format') if anime.get('format') in FORMATOS else None,
        'popularidade_fonte': popularidade if popularidade is not None and popularidade >= 0 else None,
    }
    generos = [GENERO_MAP.get(genero, genero) for genero in anime.get('genres', [])]

    result = salvar_anime(dados, generos, t)
    logger.info("Anime importado: %s (%s)", dados['titulo_original'], result['id_midia'])
    return result


def importar_animes(
    paginas: int = 20, do_inicio: bool = False, paginas_atualizacao: int = anilist.PAGINAS_ATUALIZACAO,
    temporadas: int = anilist.TEMPORADAS,
):
    """Importação de animes: `paginas` do crescimento, `paginas_atualizacao` das populares e,
    inteiras, as `temporadas` a partir da atual (0 desliga).

    A passada das Temporadas roda mesmo depois de falha nas outras, e uma Temporada que falha não
    impede as seguintes; nenhuma mexe no cursor.
    """
    stats = ImportStats(tipo_midia='anime', origem='AniList')
    session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
    rate_limiter = RateLimiter(0.35)

    def importar_pagina(pagina: dict):
        if not pagina['itens']:
            return
        # Uma conexão por página; cada Mídia é um comando (a sua transação).
        with autocommit() as t:
            for item in pagina['itens']:
                try:
                    result = processar_e_inserir_anime(item, t)
                    stats.registrar_sucesso(ja_existia=result['ja_existia'])
                except Indisponivel:
                    # Sem banco não é falha do item: encerra o Tipo sem avançar o cursor.
                    raise
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

    def buscar(pagina, sort, filtros):
        return anilist.buscar_pagina(session, rate_limiter, 'ANIME', pagina, sort, filtros)

    try:
        cursor.importar_anilist('anime', stats, buscar, importar_pagina, paginas, paginas_atualizacao, do_inicio)
        for estacao, ano in anilist.temporadas_a_frente(hoje(), temporadas):
            cursor.importar(
                'anime', 'AniList', stats, anilist.temporada(buscar, estacao, ano), importar_pagina,
                lambda pagina: None,
            )

        logger.info('Importação de animes concluída. %s', stats.to_dict())
        if stats.falhas:
            logger.warning('Falhas de importação registradas em %s', ERROR_LOG_PATH)
        return stats
    finally:
        session.close()
