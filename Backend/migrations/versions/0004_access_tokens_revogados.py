"""Blocklist persistida dos access tokens (ticket 26, ADR-0006).

Guarda o jti de todo access token revogado antes de expirar (logout e token
de recuperação de senha já usado). Vale para todos os workers e sobrevive a
restart. A linha só importa até `expira_em`: depois disso o próprio JWT já é
recusado, e a limpeza apaga a linha (índice por expira_em).

Revision ID: 0004_access_tokens_revogados
Revises: 0003_dados_iniciais
Create Date: 2026-11-14
"""
from alembic import op

revision = '0004_access_tokens_revogados'
down_revision = '0003_dados_iniciais'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE access_tokens_revogados (
            jti text PRIMARY KEY,
            expira_em timestamptz NOT NULL
        );
        CREATE INDEX idx_access_tokens_revogados_expira_em ON access_tokens_revogados (expira_em);
        """
    )


def downgrade() -> None:
    op.execute('DROP TABLE access_tokens_revogados')
