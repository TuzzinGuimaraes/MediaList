"""`midias.titulo_portugues` vira `titulo_romaji` (spec `ajustes-titulos`, CONTEXT.md: Título).

A coluna sempre guardou o romanizado do AniList (e o nome do jogo); não existe título em
português. O índice e as colunas das views que a expõem acompanham o nome. Os dados não mudam.

O downgrade volta os nomes antigos.

Revision ID: 0019_titulo_romaji
Revises: 0018_serie_jogos
Create Date: 2026-11-27
"""
from alembic import op

revision = '0019_titulo_romaji'
down_revision = '0018_serie_jogos'
branch_labels = None
depends_on = None

_VIEWS = ('vw_midias_populares', 'vw_animes_temporada_atual')


def _renomear(de: str, para: str) -> None:
    views = '\n'.join(f'ALTER VIEW {v} RENAME COLUMN titulo_{de} TO titulo_{para};' for v in _VIEWS)
    op.execute(
        f"""
        ALTER TABLE midias RENAME COLUMN titulo_{de} TO titulo_{para};
        ALTER INDEX idx_midias_titulo_{de} RENAME TO idx_midias_titulo_{para};
        {views}
        """
    )


def upgrade() -> None:
    _renomear('portugues', 'romaji')


def downgrade() -> None:
    _renomear('romaji', 'portugues')
