"""Integrações por perfil público (spec `integracoes`, ADR 0015).

- `integracoes`: a conta externa (AniList, MAL, Steam) que cada Usuário
  conectou, pelo identificador público, com a última sincronização.
- `importacao_previas`: a prévia de uma importação manual, guardada por 1 h
  para o "Confirmar" não refazer as chamadas à origem.
- `steam_appids`: o casamento `appid` da Steam → Mídia do Catálogo, inclusive
  os que não casaram (`id_midia` nulo), para não buscar no RAWG de novo.

Revision ID: 0008_integracoes
Revises: 0007_email_normalizado
Create Date: 2026-11-24
"""
from alembic import op

revision = '0008_integracoes'
down_revision = '0007_email_normalizado'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE integracoes (
            id_integracao uuid PRIMARY KEY DEFAULT uuidv7(),
            id_usuario uuid NOT NULL REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
            plataforma text NOT NULL
                CONSTRAINT ck_integracoes_plataforma CHECK (plataforma IN ('anilist', 'mal', 'steam')),
            identificador text NOT NULL,
            nome_exibicao text,
            ultima_sincronizacao timestamptz,
            ultimo_resultado jsonb,
            data_criacao timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uk_integracoes_usuario_plataforma UNIQUE (id_usuario, plataforma)
        );
        CREATE INDEX idx_integracoes_plataforma ON integracoes (plataforma);

        CREATE TABLE importacao_previas (
            id_previa uuid PRIMARY KEY DEFAULT uuidv7(),
            id_usuario uuid NOT NULL REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
            plataforma text NOT NULL
                CONSTRAINT ck_importacao_previas_plataforma CHECK (plataforma IN ('anilist', 'mal', 'steam')),
            conteudo jsonb NOT NULL,
            data_criacao timestamptz NOT NULL DEFAULT now(),
            expira_em timestamptz NOT NULL
        );
        CREATE INDEX idx_importacao_previas_usuario ON importacao_previas (id_usuario);

        CREATE TABLE steam_appids (
            appid integer PRIMARY KEY,
            id_midia uuid REFERENCES midias (id_midia) ON DELETE SET NULL,
            nome text NOT NULL,
            tentado_em timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX idx_steam_appids_midia ON steam_appids (id_midia);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE steam_appids;
        DROP TABLE importacao_previas;
        DROP TABLE integracoes;
        """
    )
