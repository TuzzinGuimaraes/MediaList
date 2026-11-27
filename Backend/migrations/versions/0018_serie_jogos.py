"""Mesma série nos jogos e mangá adulto (spec `relacoes`, ticket 02 e revisão).

- `jogos.game_series_count`: quantos jogos o RAWG diz que estão na série deste, lido do detalhe.
  É gravada na mesma transação das Relações do jogo: a Importação só busca a série
  (`/games/<slug>/game-series`) quando a contagem é maior que zero e mudou, e a que falhou fica
  com a contagem antiga para tentar de novo. Nula: ainda não lida (os jogos de antes desta
  migração e os que entraram só pela loja da Steam). A passada lenta percorre os nulos com
  `rawg_slug`; o jogo que o RAWG não tem mais fica com 0.
- `mangas.adulto`: o `isAdult` do AniList. Com a classificação 18 do anime, tira a Mídia adulta
  das Relações vindas de outras Mídias.

O downgrade apaga as colunas.

Revision ID: 0018_serie_jogos
Revises: 0017_relacoes
Create Date: 2026-11-29
"""
from alembic import op

revision = '0018_serie_jogos'
down_revision = '0017_relacoes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE jogos
            ADD COLUMN game_series_count integer
                CONSTRAINT ck_jogos_game_series_count CHECK (game_series_count >= 0);

        ALTER TABLE mangas ADD COLUMN adulto boolean NOT NULL DEFAULT false;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE mangas DROP COLUMN adulto;

        ALTER TABLE jogos DROP COLUMN game_series_count;
        """
    )
