"""`midias.titulo_portugues` vira `titulo_romaji` (spec `ajustes-titulos`, CONTEXT.md: Título).

A coluna sempre guardou o romanizado do AniList (e o nome do jogo); não existe título em
português. O índice e as colunas das views que a expõem acompanham o nome. Os dados não mudam.
`vw_midias_populares` ganha `titulo_ingles` no fim (o `CREATE OR REPLACE` só acrescenta colunas
no fim e mantém os grants), para os Populares montarem o título exibido sem outro JOIN.

O downgrade volta os nomes antigos e a view dos populares sem o inglês.

Revision ID: 0019_titulo_romaji
Revises: 0018_serie_jogos
Create Date: 2026-11-27
"""
from alembic import op

revision = '0019_titulo_romaji'
down_revision = '0018_serie_jogos'
branch_labels = None
depends_on = None

_VIEWS = ('vw_midias_populares', 'vw_animes_temporada_atual')


def _renomear(de: str, para: str, views: tuple[str, ...] = _VIEWS) -> None:
    views = '\n'.join(f'ALTER VIEW {v} RENAME COLUMN titulo_{de} TO titulo_{para};' for v in views)
    op.execute(
        f"""
        ALTER TABLE midias RENAME COLUMN titulo_{de} TO titulo_{para};
        ALTER INDEX idx_midias_titulo_{de} RENAME TO idx_midias_titulo_{para};
        {views}
        """
    )


def _populares(romaji: str, com_ingles: bool) -> str:
    """O SELECT de `vw_midias_populares` da 0002, com a coluna `romaji` e, se pedido, o inglês no fim."""
    ingles = ', m.titulo_ingles' if com_ingles else ''
    return f"""
        SELECT
            m.id_midia,
            m.codigo_midia,
            tm.nome_tipo AS tipo,
            tm.label AS tipo_label,
            m.titulo_original,
            m.{romaji},
            m.poster_url,
            n.nota_media,
            m.nota_fonte,
            count(DISTINCT lu.id_usuario) AS total_usuarios,
            count(DISTINCT lu.id_usuario) FILTER (
                WHERE lu.status_consumo IN ('completo', 'lido', 'zerado', 'platinado')
            ) AS usuarios_concluiram,
            count(DISTINCT lu.id_usuario) FILTER (WHERE lu.favorito) AS total_favoritos,
            string_agg(DISTINCT g.nome_genero, ', ' ORDER BY g.nome_genero) AS generos{ingles}
        FROM midias m
        JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo
        JOIN vw_notas_midia n ON n.id_midia = m.id_midia
        JOIN lista_usuarios lu ON lu.id_midia = m.id_midia
        LEFT JOIN midias_generos mg ON mg.id_midia = m.id_midia
        LEFT JOIN generos g ON g.id_genero = mg.id_genero
        GROUP BY m.id_midia, tm.nome_tipo, tm.label, n.nota_media
        ORDER BY total_usuarios DESC, n.nota_media DESC NULLS LAST
    """


def upgrade() -> None:
    _renomear('portugues', 'romaji')
    op.execute(f'CREATE OR REPLACE VIEW vw_midias_populares AS {_populares("titulo_romaji", com_ingles=True)}')


def downgrade() -> None:
    # Coluna de view não sai com CREATE OR REPLACE: a view volta inteira, como na 0002.
    op.execute('DROP VIEW vw_midias_populares')
    _renomear('romaji', 'portugues', views=('vw_animes_temporada_atual',))
    op.execute(f'CREATE VIEW vw_midias_populares AS {_populares("titulo_portugues", com_ingles=False)}')
