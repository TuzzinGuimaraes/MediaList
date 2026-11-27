"""Migração 0018: a contagem da série nos jogos e o mangá adulto (spec `relacoes`).

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

ANTERIOR = '0017_relacoes'
NOVA = '0018_serie_jogos'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _jogo(nome, slug):
    [linha] = _sql(nome, "INSERT INTO midias (id_tipo, titulo_original) SELECT id_tipo, 'J' "
                         "FROM tipo_midia WHERE nome_tipo = 'jogo' RETURNING id_midia")
    _sql(nome, 'INSERT INTO jogos (id_midia, rawg_slug) VALUES (%s, %s)', (linha['id_midia'], slug))
    return linha['id_midia']


def _colunas(nome, tabela):
    return {linha['column_name'] for linha in _sql(
        nome, 'SELECT column_name FROM information_schema.columns WHERE table_name = %s', (tabela,))}


def test_upgrade_cria_a_contagem_nula_nos_jogos_que_ja_estavam(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    antigo = _jogo(nome, 'portal')

    _alembic(nome, 'upgrade', NOVA)

    [linha] = _sql(nome, 'SELECT game_series_count FROM jogos WHERE id_midia = %s', (antigo,))
    assert linha['game_series_count'] is None
    with pytest.raises(psycopg.errors.CheckViolation):
        _sql(nome, 'UPDATE jogos SET game_series_count = -1 WHERE id_midia = %s', (antigo,))


def test_upgrade_cria_o_adulto_falso_nos_mangas_que_ja_estavam(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    [linha] = _sql(nome, "INSERT INTO midias (id_tipo, titulo_original) SELECT id_tipo, 'M' "
                         "FROM tipo_midia WHERE nome_tipo = 'manga' RETURNING id_midia")
    _sql(nome, 'INSERT INTO mangas (id_midia, anilist_id) VALUES (%s, 1)', (linha['id_midia'],))

    _alembic(nome, 'upgrade', NOVA)

    [manga] = _sql(nome, 'SELECT adulto FROM mangas WHERE id_midia = %s', (linha['id_midia'],))
    assert manga['adulto'] is False


def test_downgrade_apaga_a_contagem_e_o_adulto(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)

    _alembic(nome, 'downgrade', ANTERIOR)

    assert 'game_series_count' not in _colunas(nome, 'jogos')
    assert 'adulto' not in _colunas(nome, 'mangas')
