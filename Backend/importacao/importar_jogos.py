"""
Importador de jogos via RAWG.
"""
from __future__ import annotations

from threading import local

from importacao.config import RAWG_API_KEY, RAWG_BASE_URL
from importacao.db import get_connection, inserir_midia_genero, inserir_ou_atualizar_jogo, upsert_genero
from importacao.utils import (
    ERROR_LOG_PATH,
    ImportStats,
    RateLimiter,
    criar_sessao_http,
    executar_em_paralelo,
    logger,
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


def normalizar_plataformas(plataformas_rawg: list) -> str:
    nomes = [PLATAFORMAS_MAP.get(p['platform']['name'], p['platform']['name']) for p in plataformas_rawg]
    return ', '.join(nomes[:6])


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


def processar_e_inserir_jogo(
    basico: dict,
    detalhe: dict,
    conn,
    genero_cache: dict[str, int] | None = None,
):
    """Processa um jogo do RAWG e persiste no banco."""
    try:
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
            'nota_media': round((basico.get('rating') or 0) * 2, 2) if basico.get('rating') else None,
            'poster_url': basico.get('background_image'),
            'desenvolvedor': (detalhe.get('developers') or [{}])[0].get('name'),
            'publicadora': (detalhe.get('publishers') or [{}])[0].get('name'),
            'plataformas': normalizar_plataformas(basico.get('platforms', [])),
            'status_jogo': 'lancado' if basico.get('released') else 'em_desenvolvimento',
            'modo_jogo': modo_jogo,
            'classificacao': f'ESRB: {esrb}' if esrb else None,
            'rawg_slug': basico.get('slug'),
            'trailer_url': None,
        }

        result = inserir_ou_atualizar_jogo(conn, dados)
        for genero in basico.get('genres', []):
            nome_genero = GENERO_MAP.get(genero['name'], genero['name'])
            genero_id = upsert_genero(conn, nome_genero, 'jogo', genero_cache=genero_cache)
            inserir_midia_genero(conn, result['id_midia'], genero_id)

        conn.commit()
        logger.info("Jogo importado: %s (%s)", dados['titulo_original'], result['id_midia'])
        return result
    except Exception:
        conn.rollback()
        raise


def importar_jogos(paginas: int = 25, workers: int = 4):
    """Executa a importação em lote de jogos."""
    if not RAWG_API_KEY:
        raise RuntimeError('RAWG_API_KEY não configurada')

    stats = ImportStats(tipo_midia='jogo', origem='RAWG')
    conn = get_connection()
    genero_cache: dict[str, int] = {}
    session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
    rate_limiter = RateLimiter(0.25)

    try:
        for pagina in range(1, paginas + 1):
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
                stats.registrar_falha()
                registrar_falha_importacao(
                    tipo_midia='jogo',
                    origem='RAWG',
                    exc=exc,
                    identificador=f'pagina-{pagina}',
                    payload={'pagina': pagina},
                    extra={'pagina': pagina, 'etapa': 'listar_pagina'},
                )
                continue

            def carregar_detalhe(jogo_basico: dict):
                worker_session = _obter_sessao_rawg_worker()
                return {'detalhe': buscar_detalhe_jogo(jogo_basico['slug'], worker_session, rate_limiter)}

            for jogo_basico, detalhe_result, detalhe_exc in executar_em_paralelo(
                data.get('results', []),
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

                    result = processar_e_inserir_jogo(jogo_basico, detalhe, conn, genero_cache)
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
                        extra={'pagina': pagina},
                    )

            if not data.get('next'):
                break

        logger.info('Importação de jogos concluída. %s', stats.to_dict())
        if stats.falhas:
            logger.warning('Falhas de importação registradas em %s', ERROR_LOG_PATH)
        return stats
    finally:
        session.close()
        conn.close()
