"""
Repositório do acesso por access token (ticket 26, ADR-0006).

Blocklist persistida (`access_tokens_revogados`): o jti de um access token
revogado antes de expirar. Vale para todos os workers e sobrevive a restart.
"""
from __future__ import annotations

from datetime import datetime

from banco import consultar_um, transacao


class AcessoRepository:
    def revogar(self, jti: str, expira_em: datetime) -> None:
        """Grava o jti até a expiração do token e apaga os vencidos.

        A limpeza vai junto de cada gravação: sem rotina à parte, e com N
        workers o DELETE concorrente só apaga o que já não vale.
        """
        with transacao() as t:
            t.executar('DELETE FROM access_tokens_revogados WHERE expira_em <= now()')
            t.executar(
                'INSERT INTO access_tokens_revogados (jti, expira_em) VALUES (%s, %s) '
                'ON CONFLICT (jti) DO NOTHING',
                (jti, expira_em),
            )

    def revogado(self, jti: str) -> bool:
        return consultar_um('SELECT 1 FROM access_tokens_revogados WHERE jti = %s', (jti,)) is not None
