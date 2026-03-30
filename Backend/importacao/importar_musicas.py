"""
Importador de músicas via MusicBrainz + Cover Art Archive.
"""
from __future__ import annotations

import os
from threading import local

from importacao.config import CAA_BASE_URL, MB_BASE_URL, MB_USER_AGENT
from importacao.db import get_connection, inserir_midia_genero, inserir_ou_atualizar_musica, upsert_genero
from importacao.utils import (
    ERROR_LOG_PATH,
    ImportStats,
    RateLimiter,
    criar_sessao_http,
    executar_em_paralelo,
    formatar_data_parcial,
    logger,
    registrar_falha_importacao,
)

HEADERS = {'User-Agent': MB_USER_AGENT}
MB_RATE_LIMITER = RateLimiter(1.05)
CAA_THREAD_LOCAL = local()


def buscar_artista(nome: str, session) -> dict | None:
    MB_RATE_LIMITER.wait()
    response = session.get(
        f'{MB_BASE_URL}/artist',
        headers=HEADERS,
        params={'query': nome, 'fmt': 'json', 'limit': 1},
        timeout=30,
    )
    response.raise_for_status()
    artistas = response.json().get('artists', [])
    return artistas[0] if artistas else None


def buscar_capa_album(release_group_mbid: str, session) -> str | None:
    try:
        response = session.head(
            f'{CAA_BASE_URL}/release-group/{release_group_mbid}/front-500',
            headers=HEADERS,
            allow_redirects=True,
            timeout=5,
        )
        if response.status_code == 200:
            return response.url
    except Exception:
        return None
    return None


def _obter_sessao_caa_worker():
    session = getattr(CAA_THREAD_LOCAL, 'session', None)
    if session is None:
        session = criar_sessao_http(total_retries=2, backoff_factor=0.5)
        CAA_THREAD_LOCAL.session = session
    return session


def processar_e_inserir_musica(
    release_group: dict,
    artista_nome: str,
    conn,
    poster_url: str | None,
    genero_cache: dict[str, int] | None = None,
):
    """Processa um release-group do MusicBrainz e persiste no banco."""
    try:
        tipo_map = {'Album': 'album', 'EP': 'ep', 'Single': 'single'}
        tipo = tipo_map.get(release_group.get('primary-type', ''), 'album')
        if 'Compilation' in release_group.get('secondary-types', []):
            tipo = 'compilacao'

        genero_musical = None
        tags = release_group.get('tags') or []
        if tags:
            tags = sorted(tags, key=lambda item: item.get('count', 0), reverse=True)
            genero_musical = tags[0].get('name', '').title() or None

        dados = {
            'titulo_original': release_group['title'],
            'titulo_portugues': release_group['title'],
            'sinopse': None,
            'data_lancamento': formatar_data_parcial(release_group.get('first-release-date')),
            'poster_url': poster_url,
            'banner_url': None,
            'artista': artista_nome,
            'album': release_group['title'],
            'tipo_lancamento': tipo,
            'gravadora': None,
            'duracao_total': None,
            'numero_faixas': None,
            'genero_musical': genero_musical,
            'musicbrainz_mbid': release_group['id'],
        }

        result = inserir_ou_atualizar_musica(conn, dados)
        for tag in tags[:5]:
            nome_genero = tag.get('name', '').title()
            if not nome_genero:
                continue
            genero_id = upsert_genero(conn, nome_genero, 'musica', genero_cache=genero_cache)
            inserir_midia_genero(conn, result['id_midia'], genero_id)

        conn.commit()
        logger.info("Música importada: %s - %s", artista_nome, dados['titulo_original'])
        return result
    except Exception:
        conn.rollback()
        raise


def importar_musicas_por_artista(
    nome_artista: str,
    *,
    conn=None,
    session=None,
    genero_cache: dict[str, int] | None = None,
    workers: int = 4,
):
    """Importa todos os álbuns/release-groups de um artista."""
    own_conn = conn is None
    own_session = session is None
    conn = conn or get_connection()
    session = session or criar_sessao_http(total_retries=3, backoff_factor=1.0)
    genero_cache = genero_cache if genero_cache is not None else {}
    stats = ImportStats(tipo_midia='musica', origem='MusicBrainz')

    try:
        artista = buscar_artista(nome_artista, session)
        if not artista:
            exc = LookupError(f'Artista não encontrado: {nome_artista}')
            stats.registrar_falha()
            registrar_falha_importacao(
                tipo_midia='musica',
                origem='MusicBrainz',
                exc=exc,
                identificador=nome_artista,
                titulo=nome_artista,
                extra={'etapa': 'buscar_artista'},
            )
            return stats

        offset = 0
        while True:
            try:
                MB_RATE_LIMITER.wait()
                response = session.get(
                    f'{MB_BASE_URL}/release-group',
                    headers=HEADERS,
                    params={
                        'artist': artista['id'],
                        'type': 'album|ep|single',
                        'fmt': 'json',
                        'limit': 25,
                        'offset': offset,
                    },
                    timeout=30,
                )
                response.raise_for_status()
                data = response.json()
                release_groups = data.get('release-groups', [])
            except Exception as exc:
                stats.registrar_falha()
                registrar_falha_importacao(
                    tipo_midia='musica',
                    origem='MusicBrainz',
                    exc=exc,
                    identificador=artista.get('id'),
                    titulo=artista.get('name'),
                    payload={'offset': offset},
                    extra={'etapa': 'listar_release_groups', 'offset': offset},
                )
                break

            def carregar_capa(release_group: dict):
                worker_session = _obter_sessao_caa_worker()
                return {'poster_url': buscar_capa_album(release_group['id'], worker_session)}

            capas_por_release_group = {}
            for release_group, capa_result, capa_exc in executar_em_paralelo(
                release_groups,
                carregar_capa,
                max_workers=workers,
            ):
                if capa_exc:
                    logger.warning('Falha ao buscar capa de %s: %s', release_group.get('title'), capa_exc)
                    capas_por_release_group[release_group['id']] = None
                else:
                    capas_por_release_group[release_group['id']] = (capa_result or {}).get('poster_url')

            for release_group in release_groups:
                try:
                    result = processar_e_inserir_musica(
                        release_group,
                        artista['name'],
                        conn,
                        capas_por_release_group.get(release_group['id']),
                        genero_cache,
                    )
                    stats.registrar_sucesso(ja_existia=result['ja_existia'])
                except Exception as exc:
                    stats.registrar_falha()
                    registrar_falha_importacao(
                        tipo_midia='musica',
                        origem='MusicBrainz',
                        exc=exc,
                        identificador=release_group.get('id'),
                        titulo=release_group.get('title'),
                        payload=release_group,
                        extra={'artista': artista['name'], 'offset': offset},
                    )

            if offset + 25 >= data.get('release-group-count', 0):
                break
            offset += 25

        return stats
    finally:
        if own_session:
            session.close()
        if own_conn:
            conn.close()


def importar_musicas_por_lista(seed_file: str = 'artistas_seed.txt', workers: int = 4):
    """Importa músicas a partir de um arquivo de artistas."""
    caminho_seed = seed_file
    if not os.path.isabs(seed_file):
        caminho_seed = os.path.join(os.path.dirname(__file__), seed_file)

    stats = ImportStats(tipo_midia='musica', origem='MusicBrainz')
    conn = get_connection()
    session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
    genero_cache: dict[str, int] = {}

    try:
        with open(caminho_seed, 'r', encoding='utf-8') as handle:
            for linha in handle:
                artista = linha.strip()
                if not artista:
                    continue
                artista_stats = importar_musicas_por_artista(
                    artista,
                    conn=conn,
                    session=session,
                    genero_cache=genero_cache,
                    workers=workers,
                )
                stats.merge(artista_stats)

        logger.info('Importação de músicas concluída. %s', stats.to_dict())
        if stats.falhas:
            logger.warning('Falhas de importação registradas em %s', ERROR_LOG_PATH)
        return stats
    finally:
        session.close()
        conn.close()
