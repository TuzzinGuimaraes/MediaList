"""
Passada lenta da Mesma série nos jogos (spec `relacoes`, ticket 02).

Os jogos que já estavam no Catálogo antes da série (com `rawg_slug` e sem `game_series_count`)
não passam de novo pela Importação tão cedo. A passada lê o detalhe de cada um para gravar a
contagem e, só quando ela é maior que zero, busca a série (`game-series`, no máximo 80 jogos).

- Ordem: a Popularidade do Catálogo (Usuários com o jogo na Lista; a Nota média, senão a da
  fonte, desempata; o id por último), dos mais populares para os menos.
- Cursor próprio (`importacao.cursor.ler_serie`): a posição do último jogo passado. Cada execução
  passa no máximo `limite` jogos (300 por dia no workflow `importacao`), em páginas de 40, cada
  uma gravada num comando para as contagens e outro para as Relações. Quando não sobra jogo, a
  passada marca o fim e não roda mais.
- Jogo que o RAWG não tem mais (404) fica sem contagem e é passado. Falha da fonte numa página
  encerra a passada sem avançar o cursor: a próxima execução tenta a mesma página.
"""
from __future__ import annotations

from psycopg.types.json import Jsonb

from banco import Indisponivel, autocommit, consultar
from importacao import cursor, importar_jogos, relacoes
from importacao.db import salvar_relacoes
from importacao.utils import ImportStats, logger, registrar_falha_importacao

#: Jogos por execução no workflow `importacao`.
LIMITE = 300
#: Jogos gravados por comando.
POR_PAGINA = 40

#: Os jogos ainda sem contagem depois da posição, na ordem de Popularidade do Catálogo.
_CANDIDATOS = """
    SELECT id_midia, rawg_slug, usuarios, nota FROM (
        SELECT j.id_midia, j.rawg_slug, count(DISTINCT lu.id_usuario)::integer AS usuarios,
               COALESCE(n.nota_media, m.nota_fonte, -1)::numeric AS nota
        FROM jogos j
        JOIN midias m ON m.id_midia = j.id_midia
        JOIN vw_notas_midia n ON n.id_midia = j.id_midia
        LEFT JOIN lista_usuarios lu ON lu.id_midia = j.id_midia
        WHERE j.rawg_slug IS NOT NULL AND j.game_series_count IS NULL
        GROUP BY j.id_midia, j.rawg_slug, n.nota_media, m.nota_fonte
    ) p
    WHERE %(id)s::uuid IS NULL
       OR (-p.usuarios, -p.nota, p.id_midia) > (-%(usuarios)s::integer, -%(nota)s::numeric, %(id)s::uuid)
    ORDER BY p.usuarios DESC, p.nota DESC, p.id_midia
    LIMIT %(limite)s
"""

_GRAVAR_CONTAGENS = """
    UPDATE jogos j SET game_series_count = c.contagem
    FROM jsonb_to_recordset(%s::jsonb) AS c(id_midia uuid, contagem integer)
    WHERE j.id_midia = c.id_midia
"""


def _candidatos(posicao: tuple | None, limite: int) -> list[dict]:
    usuarios, nota, id_midia = posicao or (None, None, None)
    return consultar(_CANDIDATOS, {'usuarios': usuarios, 'nota': nota, 'id': id_midia, 'limite': limite})


def passada(limite: int = LIMITE) -> ImportStats:
    """Passa até `limite` jogos a partir do cursor. Sem RAWG_API_KEY, pula com aviso."""
    stats = ImportStats(tipo_midia='jogo', origem='RAWG (série)')
    # A chave é a da Importação de jogos (os testes a trocam lá).
    if not importar_jogos.RAWG_API_KEY:
        stats.pulado = 'RAWG_API_KEY não configurada'
        return stats
    estado = cursor.ler_serie()
    if estado and estado['fim']:
        stats.pulado = 'passada da série já chegou ao fim'
        return stats

    # A sessão e o ritmo são os da Importação de jogos (os testes os trocam lá).
    session = importar_jogos.criar_sessao_http(total_retries=3, backoff_factor=1.0)
    rate_limiter = importar_jogos.RateLimiter(0.25)
    try:
        jogos = _candidatos(estado and estado['posicao'], limite) if limite > 0 else []
        logger.info('Passada da série dos jogos: %s jogos', len(jogos))
        for inicio in range(0, len(jogos), POR_PAGINA):
            numero = inicio // POR_PAGINA + 1
            pagina = jogos[inicio:inicio + POR_PAGINA]
            try:
                contagens, series = _ler_pagina(pagina, session, rate_limiter, stats)
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
                if contagens:
                    t.executar(_GRAVAR_CONTAGENS, (Jsonb(contagens),))
                salvar_relacoes(t, series)
            ultimo = pagina[-1]
            cursor.gravar_serie((ultimo['usuarios'], ultimo['nota'], ultimo['id_midia']))
        if len(jogos) < limite:
            cursor.gravar_serie(None, fim=True)
            logger.info('Passada da série dos jogos chegou ao fim.')
        logger.info('Passada da série dos jogos. %s', stats.to_dict())
        return stats
    finally:
        session.close()


def _ler_pagina(pagina: list[dict], session, rate_limiter, stats) -> tuple[list[dict], dict[str, list[dict]]]:
    """(as contagens lidas, as Relações dos jogos com série) de uma página; a falha da fonte sobe."""
    contagens, series = [], {}
    for jogo in pagina:
        detalhe = importar_jogos.buscar_detalhe_jogo(jogo['rawg_slug'], session, rate_limiter)
        contagem = relacoes.contagem_da_serie(detalhe)
        if contagem is None:
            stats.registrar_pulados(1)
            continue
        contagens.append({'id_midia': str(jogo['id_midia']), 'contagem': contagem})
        if relacoes.precisa_da_serie(contagem, None):
            series[str(jogo['id_midia'])] = relacoes.da_serie(
                importar_jogos.buscar_serie_jogo(jogo['rawg_slug'], session, rate_limiter), jogo['rawg_slug'])
        stats.registrar_sucesso(ja_existia=True)
    return contagens, series
