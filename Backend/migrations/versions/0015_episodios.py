"""Episódio novo automático (spec `episodio-novo`, ticket 47 da revisão, Q142–Q151).

- `animes.episodios_lancados` e `animes.proximo_episodio_em`: o que o job de episódios lê do
  AniList (quantos já foram ao ar e quando sai o próximo).
- Índice único parcial em `atualizacoes_midia (id_midia, dados_adicionais->>'episodio')` para o
  tipo `episodio`: rodar o job de novo não duplica a Atualização (nem as Notificações e o push).
- `usuarios.avisar_episodios`: o "Avisar sobre episódios novos" do Perfil (push), ligado por padrão.
- `episodios_cursor`: até quando (`exibido_ate`) o job já leu o `airingSchedule`. Uma linha só;
  não é o `importacao_cursor`, que é por Tipo de mídia e página.

O downgrade tira tudo isso; as Atualizações de episódio ficam.

Revision ID: 0015_episodios
Revises: 0014_conclusao_antes_do_inicio
Create Date: 2026-11-27
"""
from alembic import op

revision = '0015_episodios'
down_revision = '0014_conclusao_antes_do_inicio'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE animes
            ADD COLUMN episodios_lancados integer
                CONSTRAINT ck_animes_episodios_lancados CHECK (episodios_lancados >= 0),
            ADD COLUMN proximo_episodio_em timestamptz;

        CREATE UNIQUE INDEX uk_atualizacoes_midia_episodio
            ON atualizacoes_midia (id_midia, (dados_adicionais->>'episodio'))
            WHERE tipo_atualizacao = 'episodio';

        ALTER TABLE usuarios ADD COLUMN avisar_episodios boolean NOT NULL DEFAULT true;

        CREATE TABLE episodios_cursor (
            unica boolean PRIMARY KEY DEFAULT true CONSTRAINT ck_episodios_cursor_unica CHECK (unica),
            exibido_ate timestamptz NOT NULL,
            atualizado_em timestamptz NOT NULL DEFAULT now()
        );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE episodios_cursor;
        ALTER TABLE usuarios DROP COLUMN avisar_episodios;
        DROP INDEX uk_atualizacoes_midia_episodio;
        ALTER TABLE animes DROP COLUMN proximo_episodio_em, DROP COLUMN episodios_lancados;
        """
    )
