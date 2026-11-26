"""Migração 0016: Temporada, formato e Popularidade da fonte dos animes (spec `temporada`).

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

ANTERIOR = '0015_episodios'
NOVA = '0016_temporada'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)

COLUNAS = {'temporada_estacao', 'temporada_ano', 'formato', 'popularidade_fonte', 'temporada_estimada'}


def _um(nome, sql, params=None):
    [linha] = _sql(nome, sql, params)
    return linha


def _anime(nome, anilist_id, estreia):
    midia = _um(nome, "INSERT INTO midias (id_tipo, titulo_original, data_lancamento) SELECT id_tipo, 'A', %s "
                      "FROM tipo_midia WHERE nome_tipo = 'anime' RETURNING id_midia", (estreia,))['id_midia']
    _sql(nome, 'INSERT INTO animes (id_midia, anilist_id) VALUES (%s, %s)', (midia, anilist_id))
    return midia


def _temporada(nome, midia):
    return _um(nome, 'SELECT temporada_estacao, temporada_ano, temporada_estimada, formato, popularidade_fonte '
                     'FROM animes WHERE id_midia = %s', (midia,))


def test_upgrade_estima_a_temporada_pela_estreia(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    estreias = {
        '2026-01-01': ('inverno', 2026), '2026-03-31': ('inverno', 2026),
        '2026-04-01': ('primavera', 2026), '2026-06-30': ('primavera', 2026),
        '2026-07-01': ('verao', 2026), '2026-09-30': ('verao', 2026),
        '2026-10-01': ('outono', 2026), '2026-12-31': ('outono', 2026),
    }
    midias = {estreia: _anime(nome, i, estreia) for i, estreia in enumerate(estreias, start=1)}
    sem_estreia = _anime(nome, 99, None)

    _alembic(nome, 'upgrade', NOVA)

    for estreia, (estacao, ano) in estreias.items():
        assert _temporada(nome, midias[estreia]) == {
            'temporada_estacao': estacao, 'temporada_ano': ano, 'temporada_estimada': True,
            'formato': None, 'popularidade_fonte': None,
        }, estreia
    assert _temporada(nome, sem_estreia) == {
        'temporada_estacao': None, 'temporada_ano': None, 'temporada_estimada': False,
        'formato': None, 'popularidade_fonte': None,
    }


@pytest.mark.parametrize('atribuicao', [
    "temporada_estacao = 'inverno', temporada_ano = NULL",
    "temporada_estacao = NULL, temporada_ano = 2026",
    "temporada_estacao = 'monção', temporada_ano = 2026",
    "formato = 'MANGA'",
    'popularidade_fonte = -1',
])
def test_upgrade_recusa_temporada_formato_e_popularidade_invalidos(banco_descartavel, atribuicao):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    midia = _anime(nome, 1, '2026-10-01')
    _sql(nome, "UPDATE animes SET temporada_estacao = 'outono', temporada_ano = 2026, formato = 'TV_SHORT', "
               'popularidade_fonte = 0 WHERE id_midia = %s', (midia,))

    with pytest.raises(psycopg.errors.CheckViolation):
        _sql(nome, f'UPDATE animes SET {atribuicao} WHERE id_midia = %s', (midia,))


def test_downgrade_volta_o_schema(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    midia = _anime(nome, 1, '2026-10-01')
    _alembic(nome, 'upgrade', NOVA)

    _alembic(nome, 'downgrade', ANTERIOR)

    colunas = {linha['column_name'] for linha in _sql(
        nome, "SELECT column_name FROM information_schema.columns WHERE table_name = 'animes'",
    )}
    assert not colunas & COLUNAS
    assert _um(nome, "SELECT to_regclass('ix_animes_temporada') AS i")['i'] is None
    assert _um(nome, 'SELECT count(*) AS n FROM animes WHERE id_midia = %s', (midia,))['n'] == 1
