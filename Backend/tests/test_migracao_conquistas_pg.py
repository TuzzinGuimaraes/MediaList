"""Migração 0021: as Conquistas da Steam (spec `conquistas-steam`, Q230–Q247).

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

ANTERIOR = '0020_recomendacoes'
NOVA = '0021_conquistas'
APPID = 1091500

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _um(nome, sql, params=None):
    [linha] = _sql(nome, sql, params)
    return linha


def _contar(nome, tabela):
    return _um(nome, f'SELECT count(*) AS n FROM {tabela}')['n']


def _cenario(nome):
    """Um Item de jogo com o esquema de duas conquistas, uma obtida e destacada. Devolve o id_lista."""
    usuario = _um(nome, "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('U', 'u@x.test', 'x') "
                        'RETURNING id_usuario')['id_usuario']
    midia = _um(nome, "INSERT INTO midias (id_tipo, titulo_original) SELECT id_tipo, 'J' FROM tipo_midia "
                      "WHERE nome_tipo = 'jogo' RETURNING id_midia")['id_midia']
    _sql(nome, 'INSERT INTO jogos (id_midia, steam_appid) VALUES (%s, %s)', (midia, APPID))
    id_lista = _um(nome, "INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo) "
                         "VALUES (%s, %s, 'jogando') RETURNING id_lista", (usuario, midia))['id_lista']
    _sql(nome, 'INSERT INTO conquistas_esquemas (steam_appid, total) VALUES (%s, 2)', (APPID,))
    _sql(nome, "INSERT INTO conquistas (steam_appid, codigo, nome, oculta, raridade) VALUES "
               "(%s, 'A', 'Primeira', false, 88.6), (%s, 'B', 'Segunda', true, 4.2)", (APPID, APPID))
    _sql(nome, 'INSERT INTO conquistas_itens (id_lista, steam_appid, total, horas_lidas) VALUES (%s, %s, 2, 10)',
         (id_lista, APPID))
    _sql(nome, "INSERT INTO conquistas_obtidas (id_lista, codigo, obtida_em) VALUES (%s, 'A', now())", (id_lista,))
    _sql(nome, "INSERT INTO conquistas_destaques (id_lista, codigo) VALUES (%s, 'A')", (id_lista,))
    return id_lista


def test_upgrade_cria_as_tabelas_e_o_destaque_sai_com_a_obtida(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    id_lista = _cenario(nome)

    _sql(nome, "DELETE FROM conquistas_obtidas WHERE id_lista = %s AND codigo = 'A'", (id_lista,))

    assert _contar(nome, 'conquistas_destaques') == 0


def test_upgrade_recusa_destaque_de_conquista_nao_obtida(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    id_lista = _cenario(nome)

    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        _sql(nome, "INSERT INTO conquistas_destaques (id_lista, codigo) VALUES (%s, 'B')", (id_lista,))


def test_apagar_o_item_leva_as_conquistas_dele_e_deixa_o_esquema(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    id_lista = _cenario(nome)

    _sql(nome, 'DELETE FROM lista_usuarios WHERE id_lista = %s', (id_lista,))

    for tabela in ('conquistas_itens', 'conquistas_obtidas', 'conquistas_destaques'):
        assert _contar(nome, tabela) == 0
    assert _contar(nome, 'conquistas') == 2


@pytest.mark.parametrize('sql', [
    "INSERT INTO conquistas (steam_appid, codigo, nome, raridade) VALUES (1091500, 'C', 'X', 101)",
    "INSERT INTO conquistas (steam_appid, codigo, nome, raridade) VALUES (1091500, 'C', 'X', -1)",
    "INSERT INTO conquistas (steam_appid, codigo, nome) VALUES (1091500, '', 'X')",
    'INSERT INTO conquistas_esquemas (steam_appid, total) VALUES (0, 1)',
    'INSERT INTO conquistas_esquemas (steam_appid, total) VALUES (5, -1)',
])
def test_upgrade_recusa_valor_invalido(banco_descartavel, sql):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    _cenario(nome)

    with pytest.raises(psycopg.errors.CheckViolation):
        _sql(nome, sql)


def test_downgrade_volta_o_schema(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    _cenario(nome)

    _alembic(nome, 'downgrade', ANTERIOR)

    for tabela in ('conquistas_esquemas', 'conquistas', 'conquistas_itens', 'conquistas_obtidas',
                   'conquistas_destaques'):
        assert _um(nome, f"SELECT to_regclass('{tabela}') AS t")['t'] is None
    assert _contar(nome, 'lista_usuarios') == 1
