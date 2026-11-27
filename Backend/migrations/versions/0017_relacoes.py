"""Relações entre Mídias (spec `relacoes`, Q186–Q205).

`relacoes_midia`: as Relações de cada Mídia como a fonte as descreve, gravadas pela Importação
(a reimportação troca as da Mídia). A origem é a Mídia (cascata na exclusão). O destino é a
identidade na fonte, não uma FK: o Tipo e o `anilist_id` (AniList) ou o `rawg_slug` (RAWG). Ele
casa com o Catálogo na leitura, então a obra que ainda não está no Catálogo vira link interno
quando a Importação a traz, e apagar uma Mídia não derruba as Relações que apontam para ela.
O destino guarda o título, o formato, a estreia, se é adulto e o pôster, para mostrar a obra
fora do Catálogo. `relacao` é o código da fonte (`SEQUEL`, `PREQUEL`... e `MESMA_SERIE` nos
jogos), inclusive os que a leitura deixa de fora (`CHARACTER`, `OTHER`).

O downgrade apaga a tabela.

Revision ID: 0017_relacoes
Revises: 0016_temporada
Create Date: 2026-11-29
"""
from alembic import op

revision = '0017_relacoes'
down_revision = '0016_temporada'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE relacoes_midia (
            id_midia uuid NOT NULL REFERENCES midias (id_midia) ON DELETE CASCADE,
            relacao text NOT NULL CONSTRAINT ck_relacoes_midia_relacao CHECK (relacao ~ '^[A-Z_]{1,40}$'),
            fonte text NOT NULL CONSTRAINT ck_relacoes_midia_fonte CHECK (fonte IN ('AniList', 'RAWG')),
            tipo_destino text NOT NULL
                CONSTRAINT ck_relacoes_midia_tipo_destino CHECK (tipo_destino IN ('anime', 'manga', 'jogo')),
            destino_anilist_id integer,
            destino_rawg_slug text,
            titulo text NOT NULL,
            formato text,
            data_lancamento date,
            adulto boolean NOT NULL DEFAULT false,
            poster_url text,
            CONSTRAINT ck_relacoes_midia_destino CHECK (
                (fonte = 'AniList' AND tipo_destino IN ('anime', 'manga')
                    AND destino_anilist_id IS NOT NULL AND destino_rawg_slug IS NULL)
                OR (fonte = 'RAWG' AND tipo_destino = 'jogo'
                    AND destino_rawg_slug IS NOT NULL AND destino_anilist_id IS NULL)
            ),
            CONSTRAINT uk_relacoes_midia_destino
                UNIQUE NULLS NOT DISTINCT (id_midia, tipo_destino, destino_anilist_id, destino_rawg_slug)
        );

        CREATE INDEX ix_relacoes_midia_anilist ON relacoes_midia (destino_anilist_id)
            WHERE destino_anilist_id IS NOT NULL;
        CREATE INDEX ix_relacoes_midia_rawg ON relacoes_midia (destino_rawg_slug)
            WHERE destino_rawg_slug IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.execute('DROP TABLE relacoes_midia;')
