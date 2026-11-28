"""Recomendações do AniList (spec `sugestoes`, Q216–Q229).

`recomendacoes_midia`: as recomendações de cada anime e mangá como o AniList as dá (as 10 mais
votadas, só as de `rating > 0`), gravadas pela Importação (a reimportação troca as da Mídia). A
origem é a Mídia (cascata na exclusão). A obra recomendada é a identidade na fonte, não uma FK: o
Tipo e o `anilist_id`. Ela casa com o Catálogo na leitura, como nas Relações (0017), então passa a
contar quando a Importação a traz. `adulto` vem da fonte, para a leitura deixá-la de fora sem
depender do Catálogo.

O downgrade apaga a tabela.

Revision ID: 0020_recomendacoes
Revises: 0019_titulo_romaji
Create Date: 2026-11-27
"""
from alembic import op

revision = '0020_recomendacoes'
down_revision = '0019_titulo_romaji'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE recomendacoes_midia (
            id_midia uuid NOT NULL REFERENCES midias (id_midia) ON DELETE CASCADE,
            tipo_destino text NOT NULL
                CONSTRAINT ck_recomendacoes_midia_tipo_destino CHECK (tipo_destino IN ('anime', 'manga')),
            destino_anilist_id integer NOT NULL
                CONSTRAINT ck_recomendacoes_midia_destino CHECK (destino_anilist_id > 0),
            rating integer NOT NULL CONSTRAINT ck_recomendacoes_midia_rating CHECK (rating > 0),
            adulto boolean NOT NULL DEFAULT false,
            CONSTRAINT pk_recomendacoes_midia PRIMARY KEY (id_midia, tipo_destino, destino_anilist_id)
        );
        """
    )


def downgrade() -> None:
    op.execute('DROP TABLE recomendacoes_midia;')
