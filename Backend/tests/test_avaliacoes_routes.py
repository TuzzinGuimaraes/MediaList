"""Tradução HTTP do módulo de Avaliação: corpo, códigos e autenticação.

As regras estão em `test_avaliacao.py`; aqui o módulo é trocado por um falso
que devolve o `Resultado` combinado, e o que se prova é o que a rota faz com ele.
"""
import pytest

from dominio.avaliacao import CONFLITO, Resultado
from dominio.lista_pessoal import INVALIDO, NAO_ENCONTRADO, NEGADO, OK
from routes import avaliacoes as avaliacoes_routes


class ModuloFalso:
    def __init__(self, resultado):
        self.resultado = resultado
        self.chamadas = []

    def __getattr__(self, operacao):
        def chamar(*args):
            self.chamadas.append((operacao, *args))
            return self.resultado

        return chamar


@pytest.fixture
def modulo(monkeypatch):
    def _instalar(resultado):
        falso = ModuloFalso(resultado)
        monkeypatch.setattr(avaliacoes_routes, 'avaliacoes', falso)
        return falso

    return _instalar


def test_criar_responde_201_com_a_nota_media_atualizada(client, auth_headers, modulo):
    falso = modulo(Resultado(OK, dados={'id_avaliacao': 'AVL-1', 'nota_media': 8.5, 'total_avaliacoes': 2}))

    resposta = client.post('/api/avaliacoes', headers=auth_headers, json={'id_midia': 'MID-1', 'nota': 9})

    assert resposta.status_code == 201
    assert resposta.get_json() == {
        'mensagem': 'Avaliação criada com sucesso!', 'id_avaliacao': 'AVL-1',
        'nota_media_atualizada': 8.5, 'total_avaliacoes': 2,
    }
    assert falso.chamadas == [('criar', 'USR-TEST-0001', {'id_midia': 'MID-1', 'nota': 9})]


def test_editar_responde_200_com_a_nota_media_atualizada(client, auth_headers, modulo):
    falso = modulo(Resultado(OK, dados={'nota_media': 7.0, 'total_avaliacoes': 1}))

    resposta = client.put('/api/avaliacoes/AVL-1', headers=auth_headers, json={'nota': 7})

    assert (resposta.status_code, resposta.get_json()) == (
        200, {'mensagem': 'Avaliação atualizada com sucesso!', 'nota_media_atualizada': 7.0})
    assert falso.chamadas == [('editar', 'USR-TEST-0001', 'AVL-1', {'nota': 7})]


@pytest.mark.parametrize('pode_moderar', [0, 1])
def test_apagar_passa_o_poder_de_moderar(client, auth_headers, modulo, monkeypatch, pode_moderar):
    falso = modulo(Resultado(OK))
    monkeypatch.setattr(avaliacoes_routes, 'get_user_permissions', lambda _id: {'pode_moderar': pode_moderar})

    resposta = client.delete('/api/avaliacoes/AVL-1', headers=auth_headers)

    assert (resposta.status_code, resposta.get_json()) == (200, {'mensagem': 'Avaliação removida com sucesso'})
    assert falso.chamadas == [('apagar', 'USR-TEST-0001', 'AVL-1', bool(pode_moderar))]


def test_listar(client, modulo):
    falso = modulo(Resultado(OK, dados={'avaliacoes': [{'id_avaliacao': 'AVL-1'}]}))

    resposta = client.get('/api/avaliacoes/MID-1')

    assert (resposta.status_code, resposta.get_json()) == (200, {'avaliacoes': [{'id_avaliacao': 'AVL-1'}]})
    assert falso.chamadas == [('listar', 'MID-1')]


@pytest.mark.parametrize('codigo, status', [(INVALIDO, 400), (NEGADO, 403), (NAO_ENCONTRADO, 404), (CONFLITO, 409)])
def test_erro_do_modulo_vira_o_codigo_http_com_a_mensagem(client, auth_headers, modulo, codigo, status):
    modulo(Resultado(codigo, 'Mensagem do módulo'))

    for resposta in (
        client.get('/api/avaliacoes/MID-1'),
        client.post('/api/avaliacoes', headers=auth_headers, json={}),
        client.put('/api/avaliacoes/AVL-1', headers=auth_headers, json={'nota': 1}),
    ):
        assert (resposta.status_code, resposta.get_json()) == (status, {'erro': 'Mensagem do módulo'})


def test_invalido_com_detalhes_traz_os_detalhes(client, auth_headers, modulo):
    modulo(Resultado(INVALIDO, 'Nota inválida', {'nota': 'Nota inválida'}))

    resposta = client.post('/api/avaliacoes', headers=auth_headers, json={'id_midia': 'MID-1', 'nota': 11})

    assert resposta.get_json() == {'erro': 'Nota inválida', 'detalhes': {'nota': 'Nota inválida'}}


def test_escrita_exige_login(client, modulo):
    falso = modulo(Resultado(OK))

    assert client.post('/api/avaliacoes', json={'id_midia': 'MID-1', 'nota': 8}).status_code == 401
    assert client.put('/api/avaliacoes/AVL-1', json={'nota': 8}).status_code == 401
    assert client.delete('/api/avaliacoes/AVL-1').status_code == 401
    assert falso.chamadas == []
