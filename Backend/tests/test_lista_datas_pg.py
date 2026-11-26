"""Datas do Item pela rota da Lista, com o PostgreSQL real (spec lista-regras, ticket 01).

Nunca no futuro; conclusão não antes do início, com a outra data enviada ou com a gravada.
Só as datas enviadas são julgadas. Usa TEST_DATABASE_URL; sem ela, pula.
"""
from datetime import date, timedelta

import pytest

import banco

from .test_contrato_rotas_pg import catalogo, entrar, prefixo  # noqa: F401 (fixtures)
from .test_repositorios_pg import TEST_DATABASE_URL, _usuario, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL')

AMANHA = (date.today() + timedelta(days=1)).isoformat()
ANTES = 'A conclusão não pode ser antes do início.'


@pytest.fixture
def eu(pg, entrar):  # noqa: F811
    usuario = _usuario(pg)
    return usuario, entrar(usuario)


def _item(client, cabecalho, id_midia, **campos):
    resposta = client.post('/api/lista', headers=cabecalho, json={
        'id_midia': id_midia, 'status_consumo': 'assistindo', **campos,
    })
    assert resposta.status_code == 201, resposta.get_json()
    return resposta.get_json()['id_lista']


def _datas(id_lista):
    linha = banco.consultar_um(
        'SELECT data_inicio, data_conclusao, progresso_atual FROM lista_usuarios WHERE id_lista = %s', (id_lista,),
    )
    return linha['data_inicio'], linha['data_conclusao'], linha['progresso_atual']


def test_adicionar_com_data_no_futuro_e_400_por_campo(client, catalogo, eu):  # noqa: F811
    _, cabecalho = eu

    resposta = client.post('/api/lista', headers=cabecalho, json={
        'id_midia': catalogo['anime'], 'status_consumo': 'assistindo', 'data_inicio': AMANHA,
    })

    assert (resposta.status_code, resposta.get_json()) == (400, {
        'erro': 'A data de início não pode ser no futuro.', 'codigo': 'dados_invalidos',
        'detalhes': {'data_inicio': 'A data de início não pode ser no futuro.'},
    })
    assert client.get('/api/lista', headers=cabecalho).get_json() == {'lista': []}


def test_editar_com_conclusao_no_futuro_e_400(client, catalogo, eu):  # noqa: F811
    _, cabecalho = eu
    id_lista = _item(client, cabecalho, catalogo['anime'])

    resposta = client.put(f'/api/lista/{id_lista}', headers=cabecalho, json={'data_conclusao': AMANHA})

    assert resposta.status_code == 400
    assert resposta.get_json()['detalhes'] == {'data_conclusao': 'A data de conclusão não pode ser no futuro.'}


def test_conclusao_antes_do_inicio_enviado_junto_e_400(client, catalogo, eu):  # noqa: F811
    _, cabecalho = eu
    id_lista = _item(client, cabecalho, catalogo['anime'])

    resposta = client.put(f'/api/lista/{id_lista}', headers=cabecalho, json={
        'data_inicio': '2026-05-02', 'data_conclusao': '2026-05-01',
    })

    assert (resposta.status_code, resposta.get_json()['detalhes']) == (400, {'data_conclusao': ANTES})


def test_conclusao_antes_do_inicio_gravado_e_400_e_nada_muda(client, catalogo, eu):  # noqa: F811
    _, cabecalho = eu
    id_lista = _item(client, cabecalho, catalogo['anime'], data_inicio='2026-05-02')

    resposta = client.put(f'/api/lista/{id_lista}', headers=cabecalho, json={
        'data_conclusao': '2026-05-01', 'nota_usuario': 9,
    })

    assert (resposta.status_code, resposta.get_json()['detalhes']) == (400, {'data_conclusao': ANTES})
    assert _datas(id_lista)[:2] == (date(2026, 5, 2), None)


def test_editar_so_o_progresso_de_item_com_datas_ruins_funciona(client, catalogo, eu):  # noqa: F811
    _, cabecalho = eu
    id_lista = _item(client, cabecalho, catalogo['anime'])
    banco.executar(
        "UPDATE lista_usuarios SET data_inicio = '2026-05-02', data_conclusao = '2026-05-01' WHERE id_lista = %s",
        (id_lista,),
    )

    progresso = client.put(f'/api/lista/{id_lista}/progresso', headers=cabecalho, json={'progresso_atual': 4})
    edicao = client.put(f'/api/lista/{id_lista}', headers=cabecalho, json={'comentario': 'bom'})

    assert (progresso.status_code, edicao.status_code) == (200, 200)
    assert _datas(id_lista) == (date(2026, 5, 2), date(2026, 5, 1), 4)



def test_editor_reenviando_as_datas_ruins_gravadas_edita_o_item(client, catalogo, eu):  # noqa: F811
    """O editor reenvia o formulário inteiro: as datas iguais às gravadas não são julgadas (User Story 3)."""
    _, cabecalho = eu
    id_lista = _item(client, cabecalho, catalogo['anime'])
    banco.executar(
        "UPDATE lista_usuarios SET data_inicio = '2026-05-02', data_conclusao = '2026-05-01' WHERE id_lista = %s",
        (id_lista,),
    )

    resposta = client.put(f'/api/lista/{id_lista}', headers=cabecalho, json={
        'status_consumo': 'assistindo', 'progresso_atual': 4,
        'data_inicio': '2026-05-02', 'data_conclusao': '2026-05-01',
    })

    assert resposta.status_code == 200, resposta.get_json()
    assert _datas(id_lista) == (date(2026, 5, 2), date(2026, 5, 1), 4)
