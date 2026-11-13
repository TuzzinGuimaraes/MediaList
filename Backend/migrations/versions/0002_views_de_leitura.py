"""Views de leitura: notas por Mídia e as três views do schema antigo.

`vw_notas_midia` calcula a Nota média e o Total de avaliações a partir de
`avaliacoes` (ticket 13): sem Avaliações, os dois são NULL. As outras views
leem a Nota média dela, no lugar da antiga coluna `midias.nota_media`.

Revision ID: 0002_views_de_leitura
Revises: 0001_tabelas_base
Create Date: 2026-11-13
"""
from alembic import op

revision = '0002_views_de_leitura'
down_revision = '0001_tabelas_base'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE VIEW vw_notas_midia AS
        SELECT
            m.id_midia,
            round(avg(a.nota), 2) AS nota_media,
            nullif(count(a.id_avaliacao), 0) AS total_avaliacoes
        FROM midias m
        LEFT JOIN avaliacoes a ON a.id_midia = m.id_midia
        GROUP BY m.id_midia;

        CREATE VIEW vw_midias_populares AS
        SELECT
            m.id_midia,
            m.codigo_midia,
            tm.nome_tipo AS tipo,
            tm.label AS tipo_label,
            m.titulo_original,
            m.titulo_portugues,
            m.poster_url,
            n.nota_media,
            m.nota_fonte,
            count(DISTINCT lu.id_usuario) AS total_usuarios,
            count(DISTINCT lu.id_usuario) FILTER (
                WHERE lu.status_consumo IN ('completo', 'lido', 'zerado', 'platinado')
            ) AS usuarios_concluiram,
            count(DISTINCT lu.id_usuario) FILTER (WHERE lu.favorito) AS total_favoritos,
            string_agg(DISTINCT g.nome_genero, ', ' ORDER BY g.nome_genero) AS generos
        FROM midias m
        JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo
        JOIN vw_notas_midia n ON n.id_midia = m.id_midia
        JOIN lista_usuarios lu ON lu.id_midia = m.id_midia
        LEFT JOIN midias_generos mg ON mg.id_midia = m.id_midia
        LEFT JOIN generos g ON g.id_genero = mg.id_genero
        GROUP BY m.id_midia, tm.nome_tipo, tm.label, n.nota_media
        ORDER BY total_usuarios DESC, n.nota_media DESC NULLS LAST;

        CREATE VIEW vw_animes_temporada_atual AS
        SELECT
            m.id_midia,
            m.codigo_midia,
            m.titulo_original,
            m.titulo_portugues,
            m.sinopse,
            m.poster_url,
            m.banner_url,
            n.nota_media,
            m.nota_fonte,
            a.status_anime,
            m.data_lancamento,
            string_agg(DISTINCT g.nome_genero, ', ' ORDER BY g.nome_genero) AS generos,
            count(DISTINCT lu.id_usuario) AS total_usuarios
        FROM midias m
        JOIN animes a ON a.id_midia = m.id_midia
        JOIN vw_notas_midia n ON n.id_midia = m.id_midia
        LEFT JOIN midias_generos mg ON mg.id_midia = m.id_midia
        LEFT JOIN generos g ON g.id_genero = mg.id_genero
        LEFT JOIN lista_usuarios lu ON lu.id_midia = m.id_midia
        WHERE a.status_anime = 'em_exibicao'
          AND date_trunc('quarter', m.data_lancamento) = date_trunc('quarter', current_date)
        GROUP BY m.id_midia, a.status_anime, n.nota_media
        ORDER BY n.nota_media DESC NULLS LAST, total_usuarios DESC;

        CREATE VIEW vw_perfil_usuario AS
        SELECT
            u.id_usuario,
            u.nome_completo,
            u.email,
            u.foto_perfil,
            u.biografia,
            u.data_cadastro,
            count(DISTINCT lu.id_midia) AS total_midias,
            count(DISTINCT lu.id_midia) FILTER (WHERE tm.nome_tipo = 'anime') AS total_animes,
            count(DISTINCT lu.id_midia) FILTER (WHERE tm.nome_tipo = 'manga') AS total_mangas,
            count(DISTINCT lu.id_midia) FILTER (WHERE tm.nome_tipo = 'jogo') AS total_jogos,
            round(avg(lu.nota_usuario), 2) AS nota_media_usuario,
            count(DISTINCT lu.id_midia) FILTER (WHERE lu.favorito) AS total_favoritos,
            string_agg(DISTINCT gu.nome_grupo, ', ') AS grupos
        FROM usuarios u
        LEFT JOIN lista_usuarios lu ON lu.id_usuario = u.id_usuario
        LEFT JOIN midias m ON m.id_midia = lu.id_midia
        LEFT JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo
        LEFT JOIN usuarios_grupos ug ON ug.id_usuario = u.id_usuario
        LEFT JOIN grupos_usuarios gu ON gu.id_grupo = ug.id_grupo
        GROUP BY u.id_usuario;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP VIEW vw_perfil_usuario;
        DROP VIEW vw_animes_temporada_atual;
        DROP VIEW vw_midias_populares;
        DROP VIEW vw_notas_midia;
        """
    )
