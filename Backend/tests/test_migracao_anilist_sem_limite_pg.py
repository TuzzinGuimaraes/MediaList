"""Migração 0010: o cursor do AniList por popularidade (spec `anilist-sem-limite`).

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

ANTERIOR = '0009_nao_encontrados'
NOVA = '0010_anilist_sem_limite'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _cursor(nome):
    return {linha.pop('tipo_midia'): linha for linha in _sql(nome, 'SELECT * FROM importacao_cursor')}


def test_upgrade_mantem_o_cursor_de_pagina_e_o_downgrade_desfaz(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    # Produção em 2026-11-25: anime e mangá parados na página 101.
    _sql(nome, "INSERT INTO importacao_cursor (tipo_midia, proxima_pagina) VALUES ('anime', 101), ('jogo', 7)")

    _alembic(nome, 'upgrade', NOVA)

    cursor = _cursor(nome)
    for tipo, pagina in (('anime', 101), ('jogo', 7)):
        assert {k: v for k, v in cursor[tipo].items() if k != 'atualizado_em'} == {
            'proxima_pagina': pagina, 'crescimento_popularidade': None, 'crescimento_id': None,
            'crescimento_empate': None, 'atualizacao_pagina': 1,
        }

    _sql(nome, 'UPDATE importacao_cursor SET crescimento_popularidade = 40, crescimento_id = 9, '
               "crescimento_empate = 2, atualizacao_pagina = 100 WHERE tipo_midia = 'anime'")
    for invalido in ('crescimento_id = NULL', 'atualizacao_pagina = 101', 'crescimento_empate = 0',
                     'crescimento_popularidade = -1'):
        with pytest.raises(psycopg.errors.CheckViolation):
            _sql(nome, f"UPDATE importacao_cursor SET {invalido} WHERE tipo_midia = 'anime'")

    _alembic(nome, 'downgrade', ANTERIOR)

    assert {t: linha['proxima_pagina'] for t, linha in _cursor(nome).items()} == {'anime': 101, 'jogo': 7}
    assert set(_cursor(nome)['anime']) == {'proxima_pagina', 'atualizado_em'}
