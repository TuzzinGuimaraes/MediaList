"""Temporada de anime (spec `temporada`, ticket 49 da revisão, Q161–Q173).

Em `animes`:

- `temporada_estacao` (`inverno`, `primavera`, `verao`, `outono`) e `temporada_ano`: a Temporada,
  as duas juntas ou nenhuma;
- `formato`: o `format` do AniList (TV, TV_SHORT, ONA, MOVIE, SPECIAL, OVA, MUSIC); nulo é
  desconhecido;
- `popularidade_fonte`: a Popularidade da fonte (`popularity` do AniList);
- `temporada_estimada`: a Temporada veio da data de estreia, não do AniList.

Backfill: a Temporada pela data de estreia gravada, na divisão do AniList (jan–mar inverno,
abr–jun primavera, jul–set verão, out–dez outono), com `temporada_estimada`. A Importação troca
pela do AniList e desliga a marca. Índice para listar por Temporada.

O downgrade tira as colunas e o índice.

Revision ID: 0016_temporada
Revises: 0015_episodios
Create Date: 2026-11-28
"""
from alembic import op

revision = '0016_temporada'
down_revision = '0015_episodios'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE animes
            ADD COLUMN temporada_estacao text
                CONSTRAINT ck_animes_temporada_estacao
                CHECK (temporada_estacao IN ('inverno', 'primavera', 'verao', 'outono')),
            ADD COLUMN temporada_ano integer,
            ADD COLUMN formato text
                CONSTRAINT ck_animes_formato
                CHECK (formato IN ('TV', 'TV_SHORT', 'ONA', 'MOVIE', 'SPECIAL', 'OVA', 'MUSIC')),
            ADD COLUMN popularidade_fonte integer
                CONSTRAINT ck_animes_popularidade_fonte CHECK (popularidade_fonte >= 0),
            ADD COLUMN temporada_estimada boolean NOT NULL DEFAULT false,
            ADD CONSTRAINT ck_animes_temporada_completa
                CHECK ((temporada_estacao IS NULL) = (temporada_ano IS NULL));

        UPDATE animes a
        SET temporada_estacao = (ARRAY['inverno', 'primavera', 'verao', 'outono'])[
                extract(quarter FROM m.data_lancamento)::int],
            temporada_ano = extract(year FROM m.data_lancamento)::int,
            temporada_estimada = true
        FROM midias m
        WHERE m.id_midia = a.id_midia AND m.data_lancamento IS NOT NULL;

        CREATE INDEX ix_animes_temporada ON animes (temporada_ano, temporada_estacao);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX ix_animes_temporada;
        ALTER TABLE animes
            DROP CONSTRAINT ck_animes_temporada_completa,
            DROP COLUMN temporada_estimada,
            DROP COLUMN popularidade_fonte,
            DROP COLUMN formato,
            DROP COLUMN temporada_ano,
            DROP COLUMN temporada_estacao;
        """
    )
