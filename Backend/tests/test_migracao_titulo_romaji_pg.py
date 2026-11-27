"""Migração 0019: `midias.titulo_portugues` vira `titulo_romaji` (spec `ajustes-titulos`).

Roda o Alembic de verdade num banco descartável (as funções de apoio são as do teste da 0007).
Usa TEST_OWNER_DATABASE_URL (dono do banco, com CREATEDB); sem ela, pula.
"""
import pytest

from .test_migracao_email_normalizado_pg import (  # noqa: F401 (fixture)
    TEST_OWNER_DATABASE_URL,
    _alembic,
    _sql,
    banco_descartavel,
)

ANTERIOR = '0018_serie_jogos'
NOVA = '0019_titulo_romaji'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _colunas(nome, tabela):
    return {linha['column_name'] for linha in _sql(
        nome, 'SELECT column_name FROM information_schema.columns WHERE table_name = %s', (tabela,))}


def _indices(nome):
    return {linha['indexname'] for linha in _sql(nome, "SELECT indexname FROM pg_indexes WHERE tablename = 'midias'")}


def test_upgrade_renomeia_a_coluna_e_mantem_o_romaji_gravado(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    [linha] = _sql(nome, "INSERT INTO midias (id_tipo, titulo_original, titulo_portugues) "
                         "SELECT id_tipo, '鋼の錬金術師', 'Hagane no Renkinjutsushi' "
                         "FROM tipo_midia WHERE nome_tipo = 'anime' RETURNING id_midia")

    _alembic(nome, 'upgrade', NOVA)

    assert 'titulo_portugues' not in _colunas(nome, 'midias')
    [midia] = _sql(nome, 'SELECT titulo_romaji FROM midias WHERE id_midia = %s', (linha['id_midia'],))
    assert midia['titulo_romaji'] == 'Hagane no Renkinjutsushi'
    assert 'idx_midias_titulo_romaji' in _indices(nome)
    for view in ('vw_midias_populares', 'vw_animes_temporada_atual'):
        assert 'titulo_romaji' in _colunas(nome, view)
        assert 'titulo_portugues' not in _colunas(nome, view)


def test_downgrade_volta_o_nome_antigo(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)

    _alembic(nome, 'downgrade', ANTERIOR)

    assert 'titulo_romaji' not in _colunas(nome, 'midias')
    assert 'titulo_portugues' in _colunas(nome, 'midias')
    assert 'idx_midias_titulo_portugues' in _indices(nome)
    for view in ('vw_midias_populares', 'vw_animes_temporada_atual'):
        assert 'titulo_portugues' in _colunas(nome, view)
