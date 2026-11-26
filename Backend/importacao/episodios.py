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
5. Situação dos animes sem episódio na janela: os do Catálogo `em_exibicao` cujo próximo episódio
   é desconhecido ou devia ter saído há mais de 1 dia (até 2 páginas de 50, sorteados, menos os
   que a janela já atualizou) são lidos no AniList (`Page.media(id_in:)`) e gravados como no
   passo 3, sem Atualização. É assim que o anime que terminou deixa de ficar "em exibição".
6. Manda o push dos episódios novos desta execução (`avisos_push.avisar_episodios`), mesmo se a
   gravação falhou no meio: o que já foi publicado não é publicado de novo.

Falha no AniList ou no banco sai com 1. Na janela, ela não avança o cursor (a próxima execução
refaz a janela); na Situação, o que não foi gravado fica para a próxima execução.
"""
from __future__ import annotations

import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import avisos_push
from avisos_push import EpisodioNovo
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
RECUPERACAO_MAXIMA = timedelta(days=7)
#: Páginas (de `POR_PAGINA` animes) da Situação dos animes sem episódio na janela, por execução.
PAGINAS_DA_SITUACAO = 2
#: O próximo episódio que devia ter saído há mais que isto faz o anime ser lido de novo.
ATRASO_DA_SITUACAO = timedelta(days=1)

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

CONSULTA_SITUACAO = """
query ($page: Int, $perPage: Int, $ids: [Int]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(id_in: $ids, type: ANIME) { id status episodes nextAiringEpisode { episode airingAt } }
  }
}
"""


def relogio() -> datetime:
    """Agora, em UTC (os testes trocam)."""
    return datetime.now(UTC)

atualizacoes = Atualizacoes()


@dataclass(frozen=True)
class SituacaoDoAnime:
    """O que o AniList diz do anime: Situação, total de episódios e o próximo episódio."""

    status: str | None
    total: int | None
    proximo_em: datetime | None
    proximo_episodio: int | None


@dataclass(frozen=True)
class Exibicao:
    """Um item válido do `airingSchedule`: o episódio, quando foi ao ar (epoch) e a Situação do anime."""

    anilist_id: int
    episodio: int
    exibido_em: int
    anime: SituacaoDoAnime | None


def _inteiro(valor, minimo: int = 0) -> int | None:
    """Um inteiro do AniList, ou None se não for (bool não vale)."""
    if isinstance(valor, int) and not isinstance(valor, bool) and valor >= minimo:
        return valor
    return None


def _instante(epoch: int) -> datetime:
    return datetime.fromtimestamp(epoch, UTC)


def _situacao(media) -> SituacaoDoAnime | None:
    """A Situação de um `media` do AniList; None se não veio."""
    if not isinstance(media, dict):
        return None
    proximo = media.get('nextAiringEpisode')
    proximo_em = _inteiro(proximo.get('airingAt'), 1) if isinstance(proximo, dict) else None
    proximo_ep = _inteiro(proximo.get('episode'), 1) if isinstance(proximo, dict) else None
    return SituacaoDoAnime(
        status=STATUS_MAP.get(media.get('status')),
        total=_inteiro(media.get('episodes')),
        proximo_em=_instante(proximo_em) if proximo_em else None,
        proximo_episodio=proximo_ep if proximo_em else None,
    )


def _exibicao(item) -> Exibicao | None:
    """Um item do `airingSchedule` validado; None se inválido."""
    if not isinstance(item, dict):
        return None
    anilist_id, episodio = _inteiro(item.get('mediaId'), 1), _inteiro(item.get('episode'), 1)
    exibido_em = _inteiro(item.get('airingAt'), 1)
    if anilist_id is None or episodio is None or exibido_em is None:
        return None
    return Exibicao(anilist_id, episodio, exibido_em, _situacao(item.get('media')))


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
    return max(inicio, agora - RECUPERACAO_MAXIMA)


def _pagina(session, rate_limiter, consulta: str, variaveis: dict) -> dict:
    """Uma página do GraphQL do AniList (`data.Page`). Levanta se falhar."""
    rate_limiter.wait()
    # O 429 é tratado pelo Retry da sessão; esgotado, raise_for_status falha.
    response = session.post(ANILIST_URL, json={'query': consulta, 'variables': variaveis}, timeout=30)
    response.raise_for_status()
    return response.json()['data']['Page']


def buscar_janela(session, rate_limiter, inicio: datetime, fim: datetime) -> tuple[list[Exibicao], datetime]:
    """As exibições válidas de (`inicio`, `fim`] e o fim efetivo da janela. Levanta se o AniList falhar."""
    depois, antes = int(inicio.timestamp()), int(fim.timestamp()) + 1
    itens: list = []
    for pagina in range(1, ULTIMA_PAGINA + 1):
        dados = _pagina(session, rate_limiter, CONSULTA, {
            'page': pagina, 'perPage': POR_PAGINA, 'depois': depois, 'antes': antes,
        })
        itens.extend(dados['airingSchedules'] or [])
        if not dados['pageInfo']['hasNextPage']:
            return [e for e in map(_exibicao, itens) if e], fim

    exibicoes = [e for e in map(_exibicao, itens) if e]
    ultimo = max((e.exibido_em for e in exibicoes), default=None)
    if ultimo is None or ultimo - 1 <= depois:
        raise RuntimeError(f'janela do airingSchedule não cabe em {ULTIMA_PAGINA} páginas')
    logger.warning('Janela do airingSchedule passa de %d páginas: o resto fica para a próxima execução',
                   ULTIMA_PAGINA)
    return [e for e in exibicoes if e.exibido_em < ultimo], _instante(ultimo - 1)


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


def _gravar_anime(t, id_midia, lancados: int | None, anime: SituacaoDoAnime | None) -> None:
    """Grava Situação, total, lançados e próximo episódio; o que o AniList não disse fica como está.

    `lancados` só sobe. Sem `anime`, só `lancados` muda.
    """
    if anime and anime.proximo_episodio:
        lancados = max(lancados or 0, anime.proximo_episodio - 1)
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
            'status': anime and anime.status, 'total': anime and anime.total,
            'proximo_em': anime and anime.proximo_em,
        },
    )


def _atualizar_anime(t, id_midia, exibicoes: list[Exibicao]) -> None:
    """O anime pelo que o AniList disse por último na janela."""
    com_anime = [e.anime for e in exibicoes if e.anime]
    _gravar_anime(t, id_midia, max(e.episodio for e in exibicoes), com_anime[-1] if com_anime else None)


def gravar(exibicoes: list[Exibicao], novos: dict[str, list[EpisodioNovo]], atualizados: set[str]) -> int:
    """Grava a janela, um anime por transação; anota em `novos` o que cada Usuário recebeu e em
    `atualizados` as Mídias gravadas. Devolve quantas Atualizações saíram.
    """
    catalogo = _animes_do_catalogo({e.anilist_id for e in exibicoes})
    por_anime: dict[int, list[Exibicao]] = defaultdict(list)
    for exibicao in exibicoes:
        if exibicao.anilist_id in catalogo:
            por_anime[exibicao.anilist_id].append(exibicao)

    publicadas = 0
    for anilist_id, do_anime in por_anime.items():
        anime = catalogo[anilist_id]
        id_midia = str(anime['id_midia'])
        with transacao() as t:
            _atualizar_anime(t, id_midia, do_anime)
            for exibicao in do_anime:
                exibido_em = _instante(exibicao.exibido_em)
                destinatarios = atualizacoes.publicar_episodio(
                    t, id_midia, exibicao.episodio,
                    f'Episódio {exibicao.episodio} de {anime["nome"]} foi ao ar', exibido_em.isoformat(),
                )
                if destinatarios is None:
                    continue
                publicadas += 1
                for id_usuario in destinatarios:
                    novos[str(id_usuario)].append(EpisodioNovo(id_midia, anime['nome'], exibicao.episodio))
        atualizados.add(id_midia)
    return publicadas


def _animes_parados(agora: datetime, atualizados: set[str]) -> dict[int, str]:
    """Os animes `em_exibicao` a ler de novo: {anilist_id: id_midia}, sorteados até o que cabe."""
    return {linha['anilist_id']: str(linha['id_midia']) for linha in consultar(
        """
        SELECT anilist_id, id_midia
        FROM animes
        WHERE status_anime = 'em_exibicao' AND anilist_id IS NOT NULL
          AND (proximo_episodio_em IS NULL OR proximo_episodio_em < %s)
          AND NOT (id_midia = ANY(%s::uuid[]))
        ORDER BY random()
        LIMIT %s
        """,
        (agora - ATRASO_DA_SITUACAO, list(atualizados), POR_PAGINA * PAGINAS_DA_SITUACAO),
    )}


def atualizar_situacao(session, rate_limiter, agora: datetime, atualizados: set[str]) -> int:
    """Lê no AniList e grava a Situação dos animes parados; devolve quantos. Levanta se falhar."""
    parados = _animes_parados(agora, atualizados)
    if not parados:
        return 0
    gravados = 0
    for pagina in range(1, PAGINAS_DA_SITUACAO + 1):
        dados = _pagina(session, rate_limiter, CONSULTA_SITUACAO, {
            'page': pagina, 'perPage': POR_PAGINA, 'ids': sorted(parados),
        })
        for media in dados['media'] or []:
            id_midia = parados.get(_inteiro(media.get('id'), 1)) if isinstance(media, dict) else None
            anime = _situacao(media)
            if id_midia is None or anime is None:
                continue
            lancados = anime.total if anime.status == 'finalizado' else None
            with transacao() as t:
                _gravar_anime(t, id_midia, lancados, anime)
            gravados += 1
        if not dados['pageInfo']['hasNextPage']:
            break
    return gravados


def main() -> int:
    configurar_log()
    agora = relogio().replace(microsecond=0)
    inicio = inicio_da_janela(ler_cursor(), agora)
    rate_limiter = RateLimiter(INTERVALO_SEGUNDOS)

    session = criar_sessao_http(total_retries=3, backoff_factor=1.0)
    try:
        try:
            exibicoes, fim = buscar_janela(session, rate_limiter, inicio, agora)
        except Exception as exc:
            logger.warning('Episódios: AniList falhou na janela %s–%s (%s); o cursor fica.', inicio, agora, exc)
            return 1

        novos: dict[str, list[EpisodioNovo]] = defaultdict(list)
        atualizados: set[str] = set()
        codigo = 0
        try:
            publicadas = gravar(exibicoes, novos, atualizados)
            gravar_cursor(fim)
            logger.info('Episódios de %s a %s: %d exibições, %d Atualizações novas, %d Usuários avisados.',
                        inicio, fim, len(exibicoes), publicadas, len(novos))
        except Exception:
            logger.exception('Episódios: falha ao gravar a janela %s–%s; o cursor fica.', inicio, fim)
            codigo = 1
        finally:
            avisos_push.avisar_episodios(dict(novos))

        if codigo == 0:
            try:
                logger.info('Situação: %d animes parados atualizados.',
                            atualizar_situacao(session, rate_limiter, agora, atualizados))
            except Exception as exc:
                logger.warning('Episódios: falha na Situação dos animes parados (%s).', exc)
                codigo = 1
        return codigo
    finally:
        session.close()


if __name__ == '__main__':
    sys.exit(main())
