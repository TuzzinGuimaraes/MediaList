"""Filtro por ano de GET /midias e o mapa de atividade de uma Mídia, pelo app, no PostgreSQL real.

Usa TEST_DATABASE_URL; sem ela, pula.
"""
import uuid

import pytest

from repositories import Catalogo

from .test_repositorios_pg import TEST_DATABASE_URL, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o ano e a atividade'
)


@pytest.fixture
def prefixo():
    return f'ANO{uuid.uuid4().hex[:8]}'


def _midia(pg, prefixo, **dados):  # noqa: F811
    id_midia = Catalogo().criar('anime', {'titulo_original': f'{prefixo} {uuid.uuid4().hex}', **dados})
    pg['midias'].append(id_midia)
    return id_midia


def _ids(client, consulta):
    corpo = client.get(f'/api/midias?{consulta}&ordem=data_lancamento').get_json()
    return [m['id_midia'] for m in corpo['itens']], corpo['total']


def test_filtro_por_ano_inclui_os_extremos_e_o_total_acompanha(client, pg, prefixo):  # noqa: F811
    de_1999 = _midia(pg, prefixo, data_lancamento='1999-12-31')
    de_2000 = _midia(pg, prefixo, data_lancamento='2000-01-01')
    de_2005 = _midia(pg, prefixo, data_lancamento='2005-06-15')
    de_2010 = _midia(pg, prefixo, data_lancamento='2010-01-01')
    _midia(pg, prefixo)  # sem data: fica fora de qualquer filtro por ano

    assert _ids(client, f'busca={prefixo}&ano_min=2000&ano_max=2005') == ([de_2005, de_2000], 2)
    assert _ids(client, f'busca={prefixo}&ano_min=2005') == ([de_2010, de_2005], 2)
    assert _ids(client, f'busca={prefixo}&ano_max=1999') == ([de_1999], 1)
    assert _ids(client, f'busca={prefixo}&ano_min=2010&ano_max=2010') == ([de_2010], 1)
    assert _ids(client, f'busca={prefixo}&ano_min=&ano_max=')[1] == 5

