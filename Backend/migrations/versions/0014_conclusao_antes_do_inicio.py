"""Itens com conclusão antes do início (ticket 45 da revisão).

A API passa a recusar essa combinação; a migração corrige os Itens que já a têm (1 em produção
em 26/11). Sai a `data_inicio`, a mais provável de estar errada; a `data_conclusao` fica.

O downgrade não faz nada: a data apagada não volta, e a combinação nunca foi uma regra a restaurar.

Revision ID: 0014_conclusao_antes_do_inicio
Revises: 0013_noticias_edicao
Create Date: 2026-11-27
"""
from alembic import op

revision = '0014_conclusao_antes_do_inicio'
down_revision = '0013_noticias_edicao'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('UPDATE lista_usuarios SET data_inicio = NULL WHERE data_conclusao < data_inicio')


def downgrade() -> None:
    pass
