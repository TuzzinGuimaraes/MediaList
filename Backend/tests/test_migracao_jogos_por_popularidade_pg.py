"""Migração 0011: o cursor de jogo recomeça da página 1 (spec `jogos-catalogo`, Q126: a ordem mudou).

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

ANTERIOR = '0010_anilist_sem_limite'
NOVA = '0011_jogos_por_popularidade'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _paginas(nome):
    return {linha['tipo_midia']: linha['proxima_pagina']
            for linha in _sql(nome, 'SELECT tipo_midia, proxima_pagina FROM importacao_cursor')}


def test_upgrade_volta_so_o_cursor_de_jogo_para_1_e_o_downgrade_nao_mexe(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    _sql(nome, "INSERT INTO importacao_cursor (tipo_midia, proxima_pagina) VALUES ('jogo', 37), ('anime', 4)")

    _alembic(nome, 'upgrade', NOVA)

    assert _paginas(nome) == {'jogo': 1, 'anime': 4}

    _sql(nome, "UPDATE importacao_cursor SET proxima_pagina = 9 WHERE tipo_midia = 'jogo'")
    _alembic(nome, 'downgrade', ANTERIOR)

    assert _paginas(nome) == {'jogo': 9, 'anime': 4}


def test_upgrade_sem_linha_de_jogo_nao_cria_nenhuma(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)

    assert _paginas(nome) == {}
