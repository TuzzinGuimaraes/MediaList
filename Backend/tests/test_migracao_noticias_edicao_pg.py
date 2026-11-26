"""Migração 0013: `noticias.data_edicao` (ticket 42 da revisão, Q130).

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

ANTERIOR = '0012_noticias_avisos'
NOVA = '0013_noticias_edicao'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _colunas(nome):
    return {linha['column_name'] for linha in _sql(
        nome, "SELECT column_name FROM information_schema.columns WHERE table_name = 'noticias'",
    )}


def test_noticias_existentes_ficam_sem_edicao_e_o_downgrade_tira_a_coluna(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    _sql(nome, "INSERT INTO noticias (titulo) VALUES ('N')")

    _alembic(nome, 'upgrade', NOVA)

    assert _sql(nome, 'SELECT data_edicao FROM noticias') == [{'data_edicao': None}]
    _sql(nome, "UPDATE noticias SET visualizacoes = visualizacoes + 1")
    assert _sql(nome, 'SELECT data_edicao FROM noticias') == [{'data_edicao': None}]

    _alembic(nome, 'downgrade', ANTERIOR)

    assert 'data_edicao' not in _colunas(nome)
    assert _sql(nome, 'SELECT titulo FROM noticias') == [{'titulo': 'N'}]
