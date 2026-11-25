"""Cursor de jogo de volta à página 1 (spec `jogos-catalogo`, Q126).

A Importação do RAWG troca a listagem por nota (`ordering=-rating` com `metacritic=60,100`) pela
listagem por popularidade (`ordering=-added`), sem filtro na fonte. A página do cursor antigo não diz nada na
ordem nova, então o crescimento recomeça da página 1; o upsert pelo `rawg_slug` absorve os jogos
já importados. Só dado, sem mudança de schema.

O downgrade não mexe no cursor: a página antiga se perdeu, e o código antigo segue de qualquer
página (no fim da fonte volta à 1).

Revision ID: 0011_jogos_por_popularidade
Revises: 0010_anilist_sem_limite
Create Date: 2026-11-25
"""
from alembic import op

revision = '0011_jogos_por_popularidade'
down_revision = '0010_anilist_sem_limite'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE importacao_cursor SET proxima_pagina = 1, atualizado_em = now() WHERE tipo_midia = 'jogo'"
    )


def downgrade() -> None:
    pass
