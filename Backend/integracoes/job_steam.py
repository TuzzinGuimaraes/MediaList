"""Sincronização diária da Steam de todos os Usuários conectados (Q111), sem orçamento curto.

Roda no workflow `importacao`, depois da Importação: `python -m integracoes.job_steam`, com
`DATABASE_URL`, `STEAM_API_KEY` e `RAWG_API_KEY`. Log no mesmo arquivo da Importação
(`importacao_logs/`, que vira artefato), com a mesma ocultação de segredos; as falhas também
vão para o jsonl de erros. Perfil que ficou privado ou sumiu é problema do Usuário: só avisa.
Steam ou RAWG fora do ar, ou erro inesperado, segue para o próximo Usuário e sai com 1.
Sem `STEAM_API_KEY`, pula com aviso e sai com 0 (como os jogos sem `RAWG_API_KEY`).
"""
from __future__ import annotations

import sys

from banco import consultar
from importacao.utils import configurar_log, logger, registrar_falha_importacao
from integracoes import servico, sincronizacao_steam
from integracoes.plataforma import OrigemIndisponivel, PerfilNaoEncontrado, PerfilPrivado


def usuarios_com_steam() -> list[str]:
    return [linha['id_usuario'] for linha in consultar(
        "SELECT id_usuario FROM integracoes WHERE plataforma = 'steam' ORDER BY ultima_sincronizacao NULLS FIRST"
    )]


def main() -> int:
    configurar_log()
    if not servico.plataforma('steam').disponivel():
        logger.warning('Sincronização da Steam pulada: STEAM_API_KEY não configurada.')
        return 0

    falhas = 0
    usuarios = usuarios_com_steam()
    logger.info('Sincronizando a Steam de %d Usuário(s).', len(usuarios))
    for id_usuario in usuarios:
        try:
            resultado = sincronizacao_steam.sincronizar(id_usuario, orcamento=None)
            logger.info(
                'Steam de %s: %d novos, %d atualizados, %d não encontrados, %d pendentes.', id_usuario,
                resultado['novos'], resultado['atualizados'],
                resultado['total_nao_encontrados'], resultado['pendentes'],
            )
        except (PerfilPrivado, PerfilNaoEncontrado) as exc:
            logger.warning('Steam de %s não sincronizada: %s', id_usuario, exc)
        except Exception as exc:
            falhas += 1
            registrar_falha_importacao(
                tipo_midia='jogo', origem='Steam', exc=exc, identificador=id_usuario, titulo='sincronizacao_steam',
            )
            if isinstance(exc, OrigemIndisponivel):
                logger.warning('Steam de %s falhou: %s', id_usuario, exc)
            else:
                logger.exception('Steam de %s falhou.', id_usuario)
    logger.info('Sincronização da Steam concluída: %d falha(s).', falhas)
    return 1 if falhas else 0


if __name__ == '__main__':
    sys.exit(main())
