"""Avisos de Notícias (spec `noticias-avisos`, ticket 41 da revisão, Q128–Q129).

- `notificacoes` entrega uma Atualização de mídia **ou** uma Notícia: `id_atualizacao` passa a
  aceitar nulo, `id_noticia` é novo (apagar a Notícia apaga as Notificações) e o CHECK exige
  exatamente um dos dois. Uma Notificação por Usuário e Notícia.
- `push_tokens`: o token Expo de cada aparelho, com o dono, a plataforma e quando o app o
  registrou (`criado_em`) e o renovou pela última vez (`visto_em`). O token é a chave: um
  aparelho que troca de conta passa o token para o novo dono.
- `usuarios.avisar_noticias`: o "Avisar sobre Notícias" do Perfil (push), ligado por padrão.

O downgrade apaga as Notificações de Notícia (o schema antigo não as comporta) e os tokens.

Revision ID: 0012_noticias_avisos
Revises: 0011_jogos_por_popularidade
Create Date: 2026-11-26
"""
from alembic import op

revision = '0012_noticias_avisos'
down_revision = '0011_jogos_por_popularidade'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE notificacoes
            ALTER COLUMN id_atualizacao DROP NOT NULL,
            ADD COLUMN id_noticia uuid REFERENCES noticias (id_noticia) ON DELETE CASCADE,
            ADD CONSTRAINT ck_notificacoes_origem CHECK (num_nonnulls(id_atualizacao, id_noticia) = 1),
            ADD CONSTRAINT uk_notificacoes_usuario_noticia UNIQUE (id_usuario, id_noticia);
        CREATE INDEX idx_notificacoes_noticia ON notificacoes (id_noticia);

        CREATE TABLE push_tokens (
            token text PRIMARY KEY,
            id_usuario uuid NOT NULL REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
            plataforma text NOT NULL CONSTRAINT ck_push_tokens_plataforma CHECK (plataforma IN ('android', 'ios')),
            criado_em timestamptz NOT NULL DEFAULT now(),
            visto_em timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX idx_push_tokens_usuario ON push_tokens (id_usuario);

        ALTER TABLE usuarios ADD COLUMN avisar_noticias boolean NOT NULL DEFAULT true;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE usuarios DROP COLUMN avisar_noticias;
        DROP TABLE push_tokens;

        DELETE FROM notificacoes WHERE id_noticia IS NOT NULL;
        DROP INDEX idx_notificacoes_noticia;
        ALTER TABLE notificacoes
            DROP CONSTRAINT uk_notificacoes_usuario_noticia,
            DROP CONSTRAINT ck_notificacoes_origem,
            DROP COLUMN id_noticia,
            ALTER COLUMN id_atualizacao SET NOT NULL;
        """
    )
