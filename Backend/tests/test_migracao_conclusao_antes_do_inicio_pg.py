"""Migração 0014: apaga a `data_inicio` dos Itens com conclusão antes do início (spec lista-regras).

Roda o Alembic de verdade num banco descartável (as funções de apoio são as do teste da 0007).
Usa TEST_OWNER_DATABASE_URL (dono do banco, com CREATEDB); sem ela, pula.
"""
from datetime import date

import pytest

from .test_migracao_email_normalizado_pg import (  # noqa: F401 (fixture)
    TEST_OWNER_DATABASE_URL,
    _alembic,
    _sql,
    banco_descartavel,
)

ANTERIOR = '0013_noticias_edicao'
NOVA = '0014_conclusao_antes_do_inicio'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _item(nome, usuario, titulo, inicio, conclusao):
    midia = _sql(nome, "INSERT INTO midias (id_tipo, titulo_original) SELECT id_tipo, %s FROM tipo_midia "
                       "WHERE nome_tipo = 'anime' RETURNING id_midia", (titulo,))[0]['id_midia']
    _sql(nome, "INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo, data_inicio, data_conclusao) "
               "VALUES (%s, %s, 'completo', %s, %s)", (usuario, midia, inicio, conclusao))


def _datas(nome):
    return {linha['titulo_original']: (linha['data_inicio'], linha['data_conclusao']) for linha in _sql(
        nome, 'SELECT m.titulo_original, lu.data_inicio, lu.data_conclusao '
              'FROM lista_usuarios lu JOIN midias m ON m.id_midia = lu.id_midia',
    )}


def test_so_o_inicio_dos_itens_com_conclusao_antes_dele_e_apagado(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    usuario = _sql(nome, "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('U', 'u@x.test', 'x') "
                         'RETURNING id_usuario')[0]['id_usuario']
    _item(nome, usuario, 'Ruim', date(2026, 5, 2), date(2026, 5, 1))
    _item(nome, usuario, 'Mesmo dia', date(2026, 5, 1), date(2026, 5, 1))
    _item(nome, usuario, 'Em ordem', date(2026, 4, 1), date(2026, 5, 1))
    _item(nome, usuario, 'Sem início', None, date(2026, 5, 1))

    _alembic(nome, 'upgrade', NOVA)

    assert _datas(nome) == {
        'Ruim': (None, date(2026, 5, 1)),
        'Mesmo dia': (date(2026, 5, 1), date(2026, 5, 1)),
        'Em ordem': (date(2026, 4, 1), date(2026, 5, 1)),
        'Sem início': (None, date(2026, 5, 1)),
    }

    _alembic(nome, 'downgrade', ANTERIOR)

    assert _datas(nome)['Ruim'] == (None, date(2026, 5, 1))
