"""
Cliente AniList reutilizável para animes e mangás.
"""
from __future__ import annotations

import time

from importacao.config import ANILIST_URL
from importacao.utils import RateLimiter, criar_sessao_http, logger

QUERY_ANILIST = """
query ($page: Int, $perPage: Int, $tipo: MediaType) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(type: $tipo, sort: POPULARITY_DESC) {
      id
      title {
        romaji
        english
        native
      }
      description(asHtml: false)
      startDate { year month day }
      status
      episodes
      duration
      chapters
      volumes
      coverImage { large extraLarge }
      bannerImage
      meanScore
      genres
      studios(isMain: true) { nodes { name } }
      staff(sort: RELEVANCE) {
        edges {
          role
          node { name { full } }
        }
      }
      source
      trailer { id site }
      isAdult
    }
  }
}
"""


def importar_do_anilist(tipo: str, paginas: int = 20, session=None, rate_limiter: RateLimiter | None = None):
    """Retorna páginas do AniList com tratamento tolerante a falhas."""
    own_session = session is None
    session = session or criar_sessao_http(total_retries=3, backoff_factor=1.0)
    rate_limiter = rate_limiter or RateLimiter(0.35)
    pagina = 1
    try:
        while pagina <= paginas:
            payload = {
                'query': QUERY_ANILIST,
                'variables': {'page': pagina, 'perPage': 50, 'tipo': tipo},
            }

            try:
                rate_limiter.wait()
                response = session.post(ANILIST_URL, json=payload, timeout=30)

                if response.status_code == 429:
                    retry_after = int(response.headers.get('Retry-After', 60))
                    logger.warning('Rate limit do AniList atingido. Aguardando %ss.', retry_after)
                    time.sleep(retry_after)
                    continue

                response.raise_for_status()
                data = response.json()['data']['Page']
            except Exception as exc:
                logger.warning('Falha ao buscar página %s do AniList (%s): %s', pagina, tipo, exc)
                yield {'pagina': pagina, 'itens': [], 'erro': exc, 'payload': payload}
                pagina += 1
                continue

            yield {'pagina': pagina, 'itens': data['media'], 'erro': None}

            if not data['pageInfo']['hasNextPage']:
                break

            pagina += 1
    finally:
        if own_session:
            session.close()
