"""Edição de Notícias (ticket 42 da revisão, Q130).

`noticias` não tinha coluna de atualização. `data_edicao` (nula = nunca editada) é gravada pela
rota `PUT /noticias/<id>`, sem trigger: um trigger de `data_atualizacao` também marcaria como
editada qualquer outra escrita na linha (por exemplo, `visualizacoes`), e as Notícias que já
existem mostrariam "editada em" sem nunca terem sido editadas.

O downgrade só tira a coluna.

Revision ID: 0013_noticias_edicao
Revises: 0012_noticias_avisos
Create Date: 2026-11-27
"""
from alembic import op

revision = '0013_noticias_edicao'
down_revision = '0012_noticias_avisos'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('ALTER TABLE noticias ADD COLUMN data_edicao timestamptz')


def downgrade() -> None:
    op.execute('ALTER TABLE noticias DROP COLUMN data_edicao')
