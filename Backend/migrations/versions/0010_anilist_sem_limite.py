"""Cursor do AniList sem o limite de 5000 (spec `anilist-sem-limite`).

A API pública do AniList recusa página acima de 100. O cursor de animes e mangás passa a ter
duas passadas (`importacao.anilist`):

- crescimento: a fronteira na ordem por popularidade (`crescimento_popularidade`,
  `crescimento_id`, `crescimento_empate`: quantas obras com essa popularidade já vieram);
  as três vazias são o topo;
- atualização das populares: `atualizacao_pagina`, de 1 a 100.

`proxima_pagina` fica: é o cursor do RAWG, e no AniList sem fronteira é a página do topo onde o
crescimento começa. As linhas de produção em 101 continuam da página 100 (a última aceita), que
dá a fronteira das 5000 obras já importadas.

Revision ID: 0010_anilist_sem_limite
Revises: 0009_nao_encontrados
Create Date: 2026-11-25
"""
from alembic import op

revision = '0010_anilist_sem_limite'
down_revision = '0009_nao_encontrados'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE importacao_cursor
            ADD COLUMN crescimento_popularidade integer
                CONSTRAINT ck_importacao_cursor_popularidade CHECK (crescimento_popularidade >= 0),
            ADD COLUMN crescimento_id integer,
            ADD COLUMN crescimento_empate integer
                CONSTRAINT ck_importacao_cursor_empate CHECK (crescimento_empate >= 1),
            ADD COLUMN atualizacao_pagina integer NOT NULL DEFAULT 1
                CONSTRAINT ck_importacao_cursor_atualizacao CHECK (atualizacao_pagina BETWEEN 1 AND 100),
            ADD CONSTRAINT ck_importacao_cursor_fronteira CHECK (
                num_nulls(crescimento_popularidade, crescimento_id, crescimento_empate) IN (0, 3)
            );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE importacao_cursor
            DROP CONSTRAINT ck_importacao_cursor_fronteira,
            DROP COLUMN atualizacao_pagina,
            DROP COLUMN crescimento_empate,
            DROP COLUMN crescimento_id,
            DROP COLUMN crescimento_popularidade;
        """
    )
