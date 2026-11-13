"""Dados estruturais: Tipos de mídia, grupos de usuários e gêneros.

Revision ID: 0003_dados_iniciais
Revises: 0002_views_de_leitura
Create Date: 2026-11-13
"""
from alembic import op

revision = '0003_dados_iniciais'
down_revision = '0002_views_de_leitura'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO tipo_midia (nome_tipo, label) VALUES
            ('anime', 'Anime'),
            ('manga', 'Mangá'),
            ('jogo', 'Jogo');

        INSERT INTO grupos_usuarios
            (nome_grupo, descricao, nivel_acesso, pode_criar, pode_editar, pode_deletar, pode_moderar)
        VALUES
            ('Administradores', 'Acesso total ao sistema', 'admin', true, true, true, true),
            ('Moderadores', 'Pode moderar conteúdo', 'moderador', true, true, false, true),
            ('Usuários', 'Usuários regulares', 'usuario', false, false, false, false);

        INSERT INTO generos (nome_genero, descricao, aplicavel_a) VALUES
            ('Ação', 'Cenas de ação e combate', '{anime,manga,jogo}'),
            ('Aventura', 'Jornadas e explorações', '{anime,manga,jogo}'),
            ('Comédia', 'Obras humorísticas', '{anime,manga,jogo}'),
            ('Drama', 'Histórias dramáticas', '{anime,manga,jogo}'),
            ('Fantasia', 'Elementos fantásticos e mágicos', '{anime,manga,jogo}'),
            ('Ficção Científica', 'Tecnologia e futurismo', '{anime,manga,jogo}'),
            ('Romance', 'Histórias de amor', '{anime,manga}'),
            ('Slice of Life', 'Cotidiano e vida real', '{anime,manga}'),
            ('Sobrenatural', 'Elementos sobrenaturais', '{anime,manga}'),
            ('Mistério', 'Histórias de mistério e suspense', '{anime,manga,jogo}'),
            ('Terror', 'Horror e suspense', '{anime,manga,jogo}'),
            ('Esportes', 'Competições esportivas', '{anime,manga,jogo}'),
            ('Mecha', 'Robôs gigantes', '{anime,manga}'),
            ('Shounen', 'Público jovem masculino', '{anime,manga}'),
            ('Shoujo', 'Público jovem feminino', '{anime,manga}'),
            ('Seinen', 'Público adulto masculino', '{anime,manga}'),
            ('Josei', 'Público adulto feminino', '{anime,manga}'),
            ('Isekai', 'Transportado para outro mundo', '{anime,manga}'),
            ('Escola', 'Ambiente escolar', '{anime,manga}'),
            ('Música', 'Obras centradas em música', '{anime,manga}'),
            ('RPG', 'Role-Playing Game', '{jogo}'),
            ('FPS', 'First-Person Shooter', '{jogo}'),
            ('Estratégia', 'Jogos de estratégia em tempo real ou turnos', '{jogo}'),
            ('Plataforma', 'Jogos de plataforma 2D/3D', '{jogo}'),
            ('Battle Royale', 'Últimos a sobreviver vencem', '{jogo}'),
            ('Simulação', 'Simuladores de vida, corrida e afins', '{jogo}'),
            ('Puzzle', 'Quebra-cabeças e raciocínio', '{jogo}'),
            ('Survival', 'Sobrevivência em mundo aberto', '{jogo}'),
            ('MOBA', 'Multiplayer Online Battle Arena', '{jogo}');
        """
    )


def downgrade() -> None:
    # As FKs (CASCADE em midias_generos e usuarios_grupos) levam junto o que
    # apontava para estes dados; midias -> tipo_midia não tem CASCADE, então o
    # downgrade falha se ainda houver Mídias, o que é o desejado.
    op.execute(
        """
        DELETE FROM generos;
        DELETE FROM grupos_usuarios;
        DELETE FROM tipo_midia;
        ALTER TABLE generos ALTER COLUMN id_genero RESTART;
        ALTER TABLE grupos_usuarios ALTER COLUMN id_grupo RESTART;
        ALTER TABLE tipo_midia ALTER COLUMN id_tipo RESTART;
        """
    )
