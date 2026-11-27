"""
Passada lenta da Mesma série nos jogos (spec `relacoes`, ticket 02).

Os jogos que já estavam no Catálogo antes da série (com `rawg_slug` e sem `game_series_count`)
não passam de novo pela Importação tão cedo. A passada lê o detalhe de cada um para gravar a
contagem e, só quando ela é maior que zero, busca a série (`game-series`, no máximo 80 jogos).

- Candidatos: os jogos com `rawg_slug` e contagem nula, na ordem de Popularidade do Catálogo
  (Usuários com o jogo na Lista; a Nota média, senão a da fonte, desempata; o id por último),
  no máximo `limite` por execução (300 por dia no workflow `importacao`), em páginas de 40.
  Sem cursor: o jogo passado ganha a contagem e deixa de ser candidato, e o que subiu na
  Popularidade entra na vez dele. Sem candidatos, a passada não faz nada.
- A contagem é gravada na mesma transação das Relações do jogo, uma transação por página. Jogo
  que o RAWG não tem mais (404) fica com 0, para não voltar. A falha da série de um jogo deixa
  ele sem contagem (a próxima execução tenta de novo) e a passada segue; a do detalhe (a fonte
  fora) encerra a passada.
"""
from __future__ import annotations

from banco import Indisponivel, autocommit, consultar
from importacao import importar_jogos, relacoes
from importacao.utils import ImportStats, logger, registrar_falha_importacao

#: Jogos por execução no workflow `importacao`.
LIMITE = 300
#: Jogos gravados por transação.
POR_PAGINA = 40

#: Os jogos ainda sem contagem, na ordem de Popularidade do Catálogo.
_CANDIDATOS = """
    SELECT j.id_midia, j.rawg_slug
    FROM jogos j
    JOIN midias m ON m.id_midia = j.id_midia
    JOIN vw_notas_midia n ON n.id_midia = j.id_midia
    LEFT JOIN lista_usuarios lu ON lu.id_midia = j.id_midia
    WHERE j.rawg_slug IS NOT NULL AND j.game_series_count IS NULL
    GROUP BY j.id_midia, j.rawg_slug, n.nota_media, m.nota_fonte
    ORDER BY count(DISTINCT lu.id_usuario) DESC, COALESCE(n.nota_media, m.nota_fonte, -1) DESC, j.id_midia
    LIMIT %s
"""

#: A série do jogo que o RAWG não tem mais: contagem 0, sem Relações.
_SEM_SERIE = {'contagem': 0, 'relacoes': []}


def passada(limite: int = LIMITE) -> ImportStats:
    """Passa até `limite` jogos sem contagem. Sem RAWG_API_KEY, pula com aviso."""
    stats = ImportStats(tipo_midia='jogo', origem='RAWG (série)')
    # A chave é a da Importação de jogos (os testes a trocam lá).
    if not importar_jogos.RAWG_API_KEY:
        stats.pulado = 'RAWG_API_KEY não configurada'
        return stats
    jogos = consultar(_CANDIDATOS, (limite,)) if limite > 0 else []
    if not jogos:
        stats.pulado = 'nenhum jogo sem a contagem da série'
        return stats

    # A sessão e o ritmo são os da Importação de jogos (os testes os trocam lá).
    session = importar_jogos.criar_sessao_http(total_retries=3, backoff_factor=1.0)
    rate_limiter = importar_jogos.RateLimiter(0.25)
    try:
        logger.info('Passada da série dos jogos: %s jogos', len(jogos))
        for inicio in range(0, len(jogos), POR_PAGINA):
            numero = inicio // POR_PAGINA + 1
            try:
                series = _ler_pagina(jogos[inicio:inicio + POR_PAGINA], session, rate_limiter, stats, numero)
            except Indisponivel:
                raise
            except Exception as exc:
                stats.registrar_falha_pagina(numero)
                registrar_falha_importacao(
                    tipo_midia='jogo', origem='RAWG', exc=exc, identificador=f'serie-pagina-{numero}',
                    extra={'pagina': numero, 'etapa': 'passada_serie'},
                )
                return stats
            with autocommit() as t:
                if relacoes.gravar_series(t, series, numero):
                    for _ in series:
                        stats.registrar_sucesso()
                else:
                    stats.registrar_falha_pagina(numero)
        logger.info('Passada da série dos jogos. %s', stats.to_dict())
        return stats
    finally:
        session.close()


def _ler_pagina(pagina: list[dict], session, rate_limiter, stats, numero: int) -> dict[str, dict]:
    """A série a gravar de cada jogo da página (`relacoes.serie_do_jogo`); a falha do detalhe sobe."""
    series = {}
    for jogo in pagina:
        slug, id_midia = jogo['rawg_slug'], str(jogo['id_midia'])
        detalhe = importar_jogos.buscar_detalhe_jogo(slug, session, rate_limiter)
        if detalhe is None:
            series[id_midia] = _SEM_SERIE
            continue
        try:
            serie = relacoes.serie_do_jogo(
                detalhe, None, lambda s: importar_jogos.buscar_serie_jogo(s, session, rate_limiter))
        except Exception as exc:
            stats.registrar_falha()
            registrar_falha_importacao(
                tipo_midia='jogo', origem='RAWG', exc=exc, identificador=slug,
                extra={'pagina': numero, 'etapa': 'passada_serie'},
            )
            continue
        if serie is None:
            stats.registrar_pulados(1)
        else:
            series[id_midia] = serie
    return series
