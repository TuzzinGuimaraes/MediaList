"""
Job de episódios (spec `episodio-novo`, Q142–Q151): de hora em hora, no workflow `episodios`.

`python -m importacao.episodios`, com `DATABASE_URL` (e `EXPO_ACCESS_TOKEN`, se houver).

1. A janela vai do cursor (`episodios_cursor.exibido_ate`, exclusivo) até agora. Sem cursor
   (primeira execução), a última hora; a janela nunca começa antes de 7 dias atrás.
2. Lê o `airingSchedule` do AniList da janela, por ordem de exibição, até a última página.
   Se a janela passa da página 100 (o máximo da API pública), ela termina um segundo antes do
   último instante lido, e o resto fica para a próxima execução.
3. Casa cada episódio pelo `anilist_id` do Catálogo (o resto é ignorado). Por anime, numa
   transação: grava `status_anime`, `numero_episodios`, `episodios_lancados` e
   `proximo_episodio_em`, e publica a Atualização `episodio` de cada episódio com as
   Notificações (`Atualizacoes.publicar_episodio`). O índice único de episódio faz a mesma
   janela, lida de novo, não repetir nada.
4. Grava o cursor no fim da janela, só depois de gravar a janela toda.
5. Manda o push dos episódios novos desta execução (`avisos_push.avisar_episodios`), mesmo se a
   gravação falhou no meio: o que já foi publicado não é publicado de novo.

Falha no AniList ou no banco não avança o cursor e sai com 1 (a próxima execução refaz a janela).
"""
from __future__ import annotations

import sys
from collections import defaultdict
from datetime import UTC, datetime, timedelta

import avisos_push
from banco import consultar, consultar_um, executar, transacao
from importacao.config import ANILIST_URL
from importacao.importar_animes import STATUS_MAP
from importacao.utils import RateLimiter, configurar_log, criar_sessao_http, logger
from repositories.atualizacoes import Atualizacoes

POR_PAGINA = 50
#: A maior página que a API pública aceita.
ULTIMA_PAGINA = 100
#: O AniList aceita ~30 requisições por minuto na prática.
INTERVALO_SEGUNDOS = 2.0
#: Janela da primeira execução (sem cursor).
JANELA_INICIAL = timedelta(hours=1)
#: A janela nunca começa antes disto: uma execução perdida é recuperada até 7 dias depois.
TETO = timedelta(days=7)

CONSULTA = """
query ($page: Int, $perPage: Int, $depois: Int, $antes: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $depois, airingAt_lesser: $antes, sort: [TIME, ID]) {
      episode
      airingAt
      mediaId
      media { status episodes nextAiringEpisode { episode airingAt } }
    }
  }
}
"""

def relogio() -> datetime:
    """Agora, em UTC (os testes trocam)."""
    return datetime.now(UTC)

atualizacoes = Atualizacoes()


def _inteiro(valor, minimo: int = 0) -> int | None:
    """Um inteiro do AniList, ou None se não for (bool não vale)."""
    if isinstance(valor, int) and not isinstance(valor, bool) and valor >= minimo:
        return valor
    return None


def _instante(epoch: int) -> datetime:
    return datetime.fromtimestamp(epoch, UTC)


def _exibicao(item) -> dict | None:
    """Um item do `airingSchedule` validado: `{anilist_id, episodio, exibido_em, anime}`; None se inválido.

    `anime`: o que o AniList diz do anime (`status`, `total`, `proximo`), ou None se não veio.
    """
    if not isinstance(item, dict):
        return None
    anilist_id, episodio = _inteiro(item.get('mediaId'), 1), _inteiro(item.get('episode'), 1)
    exibido_em = _inteiro(item.get('airingAt'), 1)
    if anilist_id is None or episodio is None or exibido_em is None:
        return None
    media = item.get('media')
    anime = None
    if isinstance(media, dict):
        proximo = media.get('nextAiringEpisode')
        proximo_em = _inteiro(proximo.get('airingAt'), 1) if isinstance(proximo, dict) else None
        proximo_ep = _inteiro(proximo.get('episode'), 1) if isinstance(proximo, dict) else None
        anime = {
            'status': STATUS_MAP.get(media.get('status')),
            'total': _inteiro(media.get('episodes')),
            'proximo_em': _instante(proximo_em) if proximo_em else None,
            'proximo_episodio': proximo_ep if proximo_em else None,
        }
    return {'anilist_id': anilist_id, 'episodio': episodio, 'exibido_em': exibido_em, 'anime': anime}


def ler_cursor() -> datetime | None:
    linha = consultar_um('SELECT exibido_ate FROM episodios_cursor')
    return linha and linha['exibido_ate']


def gravar_cursor(exibido_ate: datetime) -> None:
    executar(
        'INSERT INTO episodios_cursor (exibido_ate) VALUES (%s) '
        'ON CONFLICT (unica) DO UPDATE SET exibido_ate = EXCLUDED.exibido_ate, atualizado_em = now()',
        (exibido_ate,),
    )


def inicio_da_janela(cursor: datetime | None, agora: datetime) -> datetime:
    inicio = cursor if cursor is not None else agora - JANELA_INICIAL
    return max(inicio, agora - TETO)


def buscar_janela(session, rate_limiter, inicio: datetime, fim: datetime) -> tuple[list[dict], datetime]:
    """As exibições válidas de (`inicio`, `fim`] e o fim efetivo da janela. Levanta se o AniList falhar."""
    depois, antes = int(inicio.timestamp()), int(fim.timestamp()) + 1
    itens: list = []
    for pagina in range(1, ULTIMA_PAGINA + 1):
        rate_limiter.wait()
        # O 429 é tratado pelo Retry da sessão; esgotado, raise_for_status falha a janela.
        response = session.post(ANILIST_URL, json={'query': CONSULTA, 'variables': {
            'page': pagina, 'perPage': POR_PAGINA, 'depois': depois, 'antes': antes,
        }}, timeout=30)
        response.raise_for_status()
        dados = response.json()['data']['Page']
        itens.extend(dados['airingSchedules'] or [])
        if not dados['pageInfo']['hasNextPage']:
            return [e for e in map(_exibicao, itens) if e], fim

    exibicoes = [e for e in map(_exibicao, itens) if e]
    ultimo = max((e['exibido_em'] for e in exibicoes), default=None)
    if ultimo is None or ultimo - 1 <= depois:
        raise RuntimeError(f'janela do airingSchedule não cabe em {ULTIMA_PAGINA} páginas')
    logger.warning('Janela do airingSchedule passa de %d páginas: o resto fica para a próxima execução',
                   ULTIMA_PAGINA)
    return [e for e in exibicoes if e['exibido_em'] < ultimo], _instante(ultimo - 1)


def _animes_do_catalogo(anilist_ids) -> dict[int, dict]:
    return {linha['anilist_id']: linha for linha in consultar(
        """
        SELECT a.anilist_id, a.id_midia, COALESCE(NULLIF(m.titulo_portugues, ''), m.titulo_original) AS nome
        FROM animes a
        JOIN midias m ON m.id_midia = a.id_midia
        WHERE a.anilist_id = ANY(%s)
        """,
        (list(anilist_ids),),
    )}


def _atualizar_anime(t, id_midia, exibicoes: list[dict]) -> None:
    """Status, total, lançados e próximo episódio, pelo que o AniList disse por último."""
    lancados = max(e['episodio'] for e in exibicoes)
    com_anime = [e['anime'] for e in exibicoes if e['anime']]
    anime = com_anime[-1] if com_anime else None
    if anime and anime['proximo_episodio']:
        lancados = max(lancados, anime['proximo_episodio'] - 1)
    t.executar(
        """
        UPDATE animes
        SET status_anime = COALESCE(%(status)s, status_anime),
            numero_episodios = COALESCE(%(total)s, numero_episodios),
            episodios_lancados = GREATEST(episodios_lancados, %(lancados)s),
            proximo_episodio_em = CASE WHEN %(tem_anime)s THEN %(proximo_em)s::timestamptz
                                       ELSE proximo_episodio_em END
        WHERE id_midia = %(id_midia)s
        """,
        {
            'id_midia': id_midia, 'lancados': lancados, 'tem_anime': anime is not None,
            'status': anime and anime['status'], 'total': anime and anime['total'],
            'proximo_em': anime and anime['proximo_em'],
        },
    )


def gravar(exibicoes: list[dict], novos: dict[str, list[dict]]) -> int:
    """Grava a janela, um anime por transação; anota em `novos` o que cada Usuário recebeu.

    Devolve quantas Atualizações saíram.
    """
    catalogo = _animes_do_catalogo({e['anilist_id'] for e in exibicoes})
    por_anime: dict[int, list[dict]] = defaultdict(list)
    for exibicao in exibicoes:
        if exibicao['anilist_id'] in catalogo:
            por_anime[exibicao['anilist_id']].append(exibicao)

    publicadas = 0
    for anilist_id, do_anime in por_anime.items():
        anime = catalogo[anilist_id]
        with transacao() as t:
            _atualizar_anime(t, anime['id_midia'], do_anime)
            for exibicao in do_anime:
                exibido_em = _instante(exibicao['exibido_em'])
                destinatarios = atualizacoes.publicar_episodio(
                    t, anime['id_midia'], exibicao['episodio'],
                    f"Episódio {exibicao['episodio']} de {anime['nome']} foi ao ar", exibido_em.isoformat(),
                )
                if destinatarios is None:
                    continue
                publicadas += 1
                for id_usuario in destinatarios:
                    novos[str(id_usuario)].append(
                        {'id_midia': anime['id_midia'], 'anime': anime['nome'], 'episodio': exibicao['episodio']}
                    )
    return publicadas


def main() -> int:
    configurar_log()
    agora = relogio().replace(microsecond=0)
    inicio = inicio_da_janela(ler_cursor(), agora)

    session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
    try:
        exibicoes, fim = buscar_janela(session, RateLimiter(INTERVALO_SEGUNDOS), inicio, agora)
    except Exception as exc:
        logger.warning('Episódios: AniList falhou na janela %s–%s (%s); o cursor fica.', inicio, agora, exc)
        return 1
    finally:
        session.close()

    novos: dict[str, list[dict]] = defaultdict(list)
    codigo = 0
    try:
        publicadas = gravar(exibicoes, novos)
        gravar_cursor(fim)
        logger.info('Episódios de %s a %s: %d exibições, %d Atualizações novas, %d Usuários avisados.',
                    inicio, fim, len(exibicoes), publicadas, len(novos))
    except Exception:
        logger.exception('Episódios: falha ao gravar a janela %s–%s; o cursor fica.', inicio, fim)
        codigo = 1
    finally:
        avisos_push.avisar_episodios(dict(novos))
    return codigo


if __name__ == '__main__':
    sys.exit(main())
