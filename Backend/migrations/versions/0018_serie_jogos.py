"""Mesma série nos jogos (spec `relacoes`, ticket 02).

- `jogos.game_series_count`: quantos jogos o RAWG diz que estão na série deste, lido do detalhe.
  A Importação só busca a série (`/games/<slug>/game-series`) quando a contagem é maior que zero
  e mudou (o jogo novo não tem contagem gravada). Nulo: ainda não lida (os jogos de antes desta
  migração e os que entraram só pela loja da Steam).
- `importacao_cursor` (linha `jogo`): o cursor da passada lenta, que lê a contagem dos jogos de
  antes desta migração, dos mais populares do Catálogo para os menos. A posição é a do último
  jogo passado na ordem de Popularidade (`serie_usuarios`, `serie_nota`, `serie_id`); sem ela, o
  início. `serie_fim`: a passada chegou ao fim e não roda mais.

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

        ALTER TABLE importacao_cursor
            ADD COLUMN serie_usuarios integer,
            ADD COLUMN serie_nota numeric,
            ADD COLUMN serie_id uuid,
            ADD COLUMN serie_fim boolean NOT NULL DEFAULT false,
            ADD CONSTRAINT ck_importacao_cursor_serie CHECK (
                num_nulls(serie_usuarios, serie_nota, serie_id) IN (0, 3)
            );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE importacao_cursor
            DROP CONSTRAINT ck_importacao_cursor_serie,
            DROP COLUMN serie_usuarios,
            DROP COLUMN serie_nota,
            DROP COLUMN serie_id,
            DROP COLUMN serie_fim;

        ALTER TABLE jogos DROP COLUMN game_series_count;
        """
    )
