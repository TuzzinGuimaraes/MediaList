"""Não encontrados resolvidos sem chamado (spec `nao-encontrados`, ticket 38 da revisão).

- `jogos.steam_appid`: o jogo criado pela loja da Steam (fallback) ou que o RAWG já disse
  vender nessa appid; UNIQUE, para a Importação do RAWG atualizar a Mídia em vez de duplicar.
- `steam_appids.ignorado`: a appid não é jogo (software, DLC, trilha): sai de "Não encontrados".
- `vinculos_origem`: o vínculo global que um Usuário fez de um item de origem a uma Mídia do
  Catálogo (Vincular, ticket 02), com autor e data para o admin desfazer. A unicidade inclui o
  Tipo: no MAL, anime 1 e mangá 1 são obras diferentes.

Os negativos gravados antes do fallback ficam vencidos, para a próxima sincronização da Steam
passá-los pela loja.

Revision ID: 0009_nao_encontrados
Revises: 0008_integracoes
Create Date: 2026-11-25
"""
from alembic import op

revision = '0009_nao_encontrados'
down_revision = '0008_integracoes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE jogos ADD COLUMN steam_appid integer CONSTRAINT uk_jogos_steam_appid UNIQUE;

        ALTER TABLE steam_appids ADD COLUMN ignorado boolean NOT NULL DEFAULT false;
        UPDATE steam_appids SET tentado_em = now() - interval '31 days' WHERE id_midia IS NULL;

        CREATE TABLE vinculos_origem (
            id uuid PRIMARY KEY DEFAULT uuidv7(),
            plataforma text NOT NULL
                CONSTRAINT ck_vinculos_origem_plataforma CHECK (plataforma IN ('anilist', 'mal', 'steam')),
            origem_id text NOT NULL,
            tipo text NOT NULL CONSTRAINT ck_vinculos_origem_tipo CHECK (tipo IN ('anime', 'manga', 'jogo')),
            id_midia uuid NOT NULL REFERENCES midias (id_midia) ON DELETE CASCADE,
            id_usuario uuid REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
            criado_em timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uk_vinculos_origem UNIQUE (plataforma, tipo, origem_id)
        );
        CREATE INDEX idx_vinculos_origem_midia ON vinculos_origem (id_midia);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE vinculos_origem;
        ALTER TABLE steam_appids DROP COLUMN ignorado;
        ALTER TABLE jogos DROP COLUMN steam_appid;
        """
    )
