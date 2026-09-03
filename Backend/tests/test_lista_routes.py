"""Tradução HTTP do módulo de Lista pessoal: aliases, códigos e autenticação.

As regras do Item de lista são afirmadas em `test_lista_pessoal.py`. Aqui só se
prova o que o adaptador faz: renomear os aliases legados do fio, escolher o
código de status e esconder item de terceiro atrás de 403.
"""
import pytest

from dominio.lista_pessoal import INVALIDO, NAO_ENCONTRADO, NEGADO, OK, Resultado
from routes import lista as lista_routes


class ModuloFalso:
    """Registra as chamadas e devolve o Resultado combinado."""

    def __init__(self, resultado=None):
        self.resultado = resultado or Resultado(OK)
        self.chamadas = []

    def adicionar(self, id_usuario, payload):
        self.chamadas.append(('adicionar', id_usuario, payload))
        return self.resultado

    def atualizar(self, id_usuario, id_lista, payload):
        self.chamadas.append(('atualizar', id_usuario, id_lista, payload))
        return self.resultado

    def remover(self, id_usuario, id_lista):
        self.chamadas.append(('remover', id_usuario, id_lista))
        return self.resultado


@pytest.fixture
def modulo(monkeypatch):
    def _instalar(resultado=None):
        falso = ModuloFalso(resultado)
        monkeypatch.setattr(lista_routes, 'lista_pessoal', falso)
        return falso

    return _instalar


def test_get_lista_retorna_apenas_itens_do_usuario(client, auth_headers, monkeypatch):
    """A leitura não passa pelo módulo: a rota consulta o repositório direto."""
    chamadas = []

    def fake_obter_lista(user_id, tipo=None, status=None):
        chamadas.append((user_id, tipo, status))
        return [{'id_lista': 'LST-1', 'tipo': 'anime'}]

    monkeypatch.setattr(lista_routes.lista_repository, 'obter_lista_usuario', fake_obter_lista)

    response = client.get('/api/lista?tipo=anime&status=assistindo', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()['lista'][0]['id_lista'] == 'LST-1'
    assert chamadas == [('USR-TEST-0001', 'anime', 'assistindo')]


def test_lista_exige_token_e_so_serve_a_lista_do_dono(client, auth_headers):
    assert client.get('/api/lista').status_code == 401

    response = client.get('/api/lista/USR-OUTRO-1', headers=auth_headers)

    assert response.status_code == 403
    assert response.get_json()['erro'] == 'Sem permissão para acessar esta lista'


def test_post_lista_traduz_os_aliases_legados(client, auth_headers, modulo):
    """Compatibilidade de fio: o módulo só conhece um nome por campo."""
    falso = modulo(Resultado(OK, id_lista='LST-10'))

    response = client.post('/api/lista', headers=auth_headers, json={
        'id_anime': 'MID-1',
        'status_visualizacao': 'assistindo',
        'episodios_assistidos': 5,
        'data_fim': '2026-04-11',
        'notas_pessoais': 'comentario legado',
    })

    assert response.status_code == 201
    assert response.get_json()['id_lista'] == 'LST-10'
    assert falso.chamadas == [('adicionar', 'USR-TEST-0001', {
        'id_midia': 'MID-1',
        'status_consumo': 'assistindo',
        'progresso_atual': 5,
        'data_conclusao': '2026-04-11',
        'comentario': 'comentario legado',
    })]


def test_post_lista_adicionar_traduz_invalido_para_400_com_detalhes(client, auth_headers, modulo):
    modulo(Resultado(INVALIDO, {'status_consumo': 'O rótulo não se aplica'}))

    response = client.post('/api/lista/adicionar', headers=auth_headers, json={
        'id_midia': 'MID-1',
        'status': 'platinado',
    })

    assert response.status_code == 400
    assert response.get_json()['detalhes'] == {'status_consumo': 'O rótulo não se aplica'}


def test_put_e_delete_encaminham_o_item_do_usuario_e_respondem_200(client, auth_headers, modulo):
    falso = modulo()

    resposta_put = client.put('/api/lista/LST-1', headers=auth_headers, json={'nota_usuario': 8})
    resposta_delete = client.delete('/api/lista/LST-1', headers=auth_headers)

    assert resposta_put.status_code == 200
    assert resposta_delete.status_code == 200
    assert falso.chamadas == [
        ('atualizar', 'USR-TEST-0001', 'LST-1', {'nota_usuario': 8}),
        ('remover', 'USR-TEST-0001', 'LST-1'),
    ]


@pytest.mark.parametrize('codigo', [NAO_ENCONTRADO, NEGADO])
def test_item_de_terceiro_e_inexistente_respondem_o_mesmo_403(client, auth_headers, modulo, codigo):
    """Um 404 aqui revelaria quais Itens existem nas listas dos outros."""
    modulo(Resultado(codigo))

    resposta_put = client.put('/api/lista/LST-1', headers=auth_headers, json={'favorito': True})
    resposta_delete = client.delete('/api/lista/LST-1', headers=auth_headers)

    assert resposta_put.status_code == 403
    assert resposta_delete.status_code == 403


def test_put_progresso_exige_o_campo_progresso(client, auth_headers, modulo):
    falso = modulo()

    response = client.put('/api/lista/LST-1/progresso', headers=auth_headers, json={})

    assert response.status_code == 400
    assert response.get_json()['erro'] == 'Progresso é obrigatório'
    assert falso.chamadas == []
