"""Cursor da Importação e Senha temporária (spec `producao`, ADR 0013).

- `importacao_cursor`: a próxima página de cada Tipo de mídia na fonte, para a
  Importação diária continuar de onde a anterior parou.
- `usuarios.deve_trocar_senha` e `usuarios.senha_temporaria_expira_em`: o admin
  redefine a senha com uma Senha temporária de 24 h, e o Usuário é obrigado a
  trocá-la no próximo acesso.

Revision ID: 0006_producao
Revises: 0005_nivel_acesso
Create Date: 2026-11-22
"""
from alembic import op

revision = '0006_producao'
down_revision = '0005_nivel_acesso'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE importacao_cursor (
            tipo_midia text PRIMARY KEY
                CONSTRAINT ck_importacao_cursor_tipo CHECK (tipo_midia IN ('anime', 'manga', 'jogo')),
            proxima_pagina integer NOT NULL DEFAULT 1
                CONSTRAINT ck_importacao_cursor_pagina CHECK (proxima_pagina >= 1),
            atualizado_em timestamptz NOT NULL DEFAULT now()
        );

        ALTER TABLE usuarios
            ADD COLUMN deve_trocar_senha boolean NOT NULL DEFAULT false,
            ADD COLUMN senha_temporaria_expira_em timestamptz;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE usuarios
            DROP COLUMN senha_temporaria_expira_em,
            DROP COLUMN deve_trocar_senha;

        DROP TABLE importacao_cursor;
        """
    )
