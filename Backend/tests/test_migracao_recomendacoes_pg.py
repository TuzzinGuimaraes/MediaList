"""Migração 0020: as recomendações do AniList (spec `sugestoes`, Q216–Q229).

Roda o Alembic de verdade num banco descartável (as funções de apoio são as do teste da 0007).
Usa TEST_OWNER_DATABASE_URL (dono do banco, com CREATEDB); sem ela, pula.
"""
import psycopg
import pytest

from .test_migracao_email_normalizado_pg import (  # noqa: F401 (fixture)
    TEST_OWNER_DATABASE_URL,
    _alembic,
    _sql,
    banco_descartavel,
)
from .test_migracao_relacoes_pg import _anime, _um

ANTERIOR = '0019_titulo_romaji'
NOVA = '0020_recomendacoes'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _recomendacao(nome, midia, tipo='anime', anilist_id=2, rating=10, adulto=False):
    _sql(nome, 'INSERT INTO recomendacoes_midia (id_midia, tipo_destino, destino_anilist_id, rating, adulto) '
               'VALUES (%s, %s, %s, %s, %s)', (midia, tipo, anilist_id, rating, adulto))


def test_upgrade_cria_as_recomendacoes_com_cascata_na_origem(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    origem, destino = _anime(nome, 1), _anime(nome, 2)
    _recomendacao(nome, origem, anilist_id=2)
    _recomendacao(nome, origem, tipo='manga', anilist_id=2, adulto=True)

    # A obra recomendada é só a identidade na fonte: apagá-la não mexe na recomendação.
    _sql(nome, 'DELETE FROM midias WHERE id_midia = %s', (destino,))
    assert _um(nome, 'SELECT count(*) AS n FROM recomendacoes_midia')['n'] == 2

    _sql(nome, 'DELETE FROM midias WHERE id_midia = %s', (origem,))
    assert _um(nome, 'SELECT count(*) AS n FROM recomendacoes_midia')['n'] == 0


def test_upgrade_recusa_o_mesmo_destino_duas_vezes_na_mesma_origem(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    origem = _anime(nome, 1)
    _recomendacao(nome, origem, anilist_id=2)

    with pytest.raises(psycopg.errors.UniqueViolation):
        _recomendacao(nome, origem, anilist_id=2, rating=3)


@pytest.mark.parametrize('campos', [
    {'tipo': 'jogo'},
    {'anilist_id': 0},
    {'rating': 0},
    {'rating': -4},
])
def test_upgrade_recusa_recomendacao_invalida(banco_descartavel, campos):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    origem = _anime(nome, 1)

    with pytest.raises(psycopg.errors.CheckViolation):
        _recomendacao(nome, origem, **campos)


def test_downgrade_volta_o_schema(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    _recomendacao(nome, _anime(nome, 1))

    _alembic(nome, 'downgrade', ANTERIOR)

    assert _um(nome, "SELECT to_regclass('recomendacoes_midia') AS t")['t'] is None
    assert _um(nome, 'SELECT count(*) AS n FROM animes')['n'] == 1
