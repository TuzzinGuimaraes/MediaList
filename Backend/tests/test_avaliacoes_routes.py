"""Tradução HTTP do módulo de Avaliação: corpo, códigos e autenticação.

As regras estão em `test_avaliacao.py`; aqui o módulo é trocado por um falso
que devolve o `Resultado` combinado, e o que se prova é o que a rota faz com ele.
"""
from datetime import datetime, timezone

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


AVALIACAO = {
    'id_avaliacao': 'AVL-1', 'id_usuario': 'USR-1', 'id_midia': 'MID-1', 'nota': 8.5,
    'titulo_avaliacao': 'Bom', 'texto_avaliacao': None,
    'data_avaliacao': datetime(2026, 11, 13, 10, tzinfo=timezone.utc),
    'data_edicao': None, 'nome_completo': 'Ana', 'foto_perfil': None,
}


def test_listar_responde_a_pagina_com_o_total(client, modulo):
    falso = modulo(Resultado(OK, dados={'avaliacoes': [AVALIACAO], 'total': 6}))

    resposta = client.get('/api/avaliacoes/MID-1?pagina=2&por_pagina=5')

    assert (resposta.status_code, resposta.get_json()) == (200, {
        'itens': [{**AVALIACAO, 'data_avaliacao': '2026-11-13T10:00:00Z'}],
        'pagina': 2, 'por_pagina': 5, 'total': 6,
    })
    assert falso.chamadas == [('listar', 'MID-1', 5, 5)]  # limite e deslocamento


def test_listar_sem_paginacao_usa_a_primeira_pagina_de_20(client, modulo):
    falso = modulo(Resultado(OK, dados={'avaliacoes': [], 'total': 0}))

    resposta = client.get('/api/avaliacoes/MID-1')

    assert resposta.get_json() == {'itens': [], 'pagina': 1, 'por_pagina': 20, 'total': 0}
    assert falso.chamadas == [('listar', 'MID-1', 20, 0)]


CODIGO_DO_ERRO = {INVALIDO: 'dados_invalidos', NEGADO: 'acesso_negado', NAO_ENCONTRADO: 'nao_encontrado',
                  CONFLITO: 'conflito'}


@pytest.mark.parametrize('codigo, status', [(INVALIDO, 400), (NEGADO, 403), (NAO_ENCONTRADO, 404), (CONFLITO, 409)])
def test_erro_do_modulo_vira_o_codigo_http_com_a_mensagem(client, auth_headers, modulo, monkeypatch, codigo, status):
    modulo(Resultado(codigo, 'Mensagem do módulo'))
    monkeypatch.setattr(avaliacoes_routes, 'get_user_permissions', lambda _id: {'pode_moderar': 0})

    for resposta in (
        client.get('/api/avaliacoes/MID-1'),
        client.post('/api/avaliacoes', headers=auth_headers, json={'id_midia': 'MID-1', 'nota': 8}),
        client.put('/api/avaliacoes/AVL-1', headers=auth_headers, json={'nota': 1}),
        client.delete('/api/avaliacoes/AVL-1', headers=auth_headers),
    ):
        assert (resposta.status_code, resposta.get_json()) == (
            status, {'erro': 'Mensagem do módulo', 'codigo': CODIGO_DO_ERRO[codigo]})


def test_invalido_com_detalhes_traz_os_detalhes(client, auth_headers, modulo):
    modulo(Resultado(INVALIDO, 'Nota inválida', {'nota': 'Nota inválida'}))

    resposta = client.post('/api/avaliacoes', headers=auth_headers, json={'id_midia': 'MID-1', 'nota': 8.55})

    assert resposta.get_json() == {
        'erro': 'Nota inválida', 'codigo': 'dados_invalidos', 'detalhes': {'nota': 'Nota inválida'}}


@pytest.mark.parametrize('corpo, campo, motivo', [
    ({'id_midia': 'MID-1'}, 'nota', 'Campo obrigatório'),
    ({'nota': 8}, 'id_midia', 'Campo obrigatório'),
    ({'id_anime': 'MID-1', 'nota': 8}, 'id_midia', 'Campo obrigatório'),
    ({'id_midia': 'MID-1', 'nota': True}, 'nota', 'Tipo inválido'),
    # A Nota de entrada é a mesma da saída (contrato.Nota): número de 0 a 10, sem texto.
    ({'id_midia': 'MID-1', 'nota': '7,5'}, 'nota', 'Tipo inválido'),
    ({'id_midia': 'MID-1', 'nota': 11}, 'nota', 'Deve ser menor ou igual a 10'),
    ({'id_midia': 'MID-1', 'nota': -1}, 'nota', 'Deve ser maior ou igual a 0'),
])
def test_corpo_fora_do_modelo_responde_400_sem_chamar_o_modulo(client, auth_headers, modulo, corpo, campo, motivo):
    falso = modulo(Resultado(OK))

    resposta = client.post('/api/avaliacoes', headers=auth_headers, json=corpo)

    assert resposta.status_code == 400
    assert resposta.get_json()['codigo'] == 'dados_invalidos'
    assert resposta.get_json()['detalhes'][campo] == motivo
    assert falso.chamadas == []


def test_edicao_passa_so_os_campos_enviados(client, auth_headers, modulo):
    falso = modulo(Resultado(OK, dados={'nota_media': None, 'total_avaliacoes': None}))

    client.put('/api/avaliacoes/AVL-1', headers=auth_headers, json={'nota': 7.5, 'texto_avaliacao': None, 'x': 1})

    assert falso.chamadas == [('editar', 'USR-TEST-0001', 'AVL-1', {'nota': 7.5, 'texto_avaliacao': None})]
def test_escrita_exige_login(client, modulo):
    falso = modulo(Resultado(OK))

    assert client.post('/api/avaliacoes', json={'id_midia': 'MID-1', 'nota': 8}).status_code == 401
    assert client.put('/api/avaliacoes/AVL-1', json={'nota': 8}).status_code == 401
    assert client.delete('/api/avaliacoes/AVL-1').status_code == 401
    assert falso.chamadas == []
