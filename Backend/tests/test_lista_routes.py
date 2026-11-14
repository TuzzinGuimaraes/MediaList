"""Tradução HTTP do módulo de Lista pessoal: contrato, códigos e autenticação.

As regras do Item de lista são afirmadas em `test_lista_pessoal.py`. Aqui só se
prova o que o adaptador faz: validar o corpo pelo modelo, escolher o código de
status, esconder item de terceiro atrás de 403 e servir o Item no modelo de saída.
"""

import pytest

from dominio.lista_pessoal import INVALIDO, NAO_ENCONTRADO, NEGADO, OK, Resultado
from routes import lista as lista_routes

from .helpers import linha_de_item


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


@pytest.fixture
def listar(monkeypatch):
    """Troca `itens_lista.listar` e registra (usuário, tipo, status)."""
    chamadas = []

    def _instalar(linhas):
        def fake_listar(user_id, tipo=None, status=None):
            chamadas.append((user_id, tipo, status))
            return linhas

        monkeypatch.setattr(lista_routes.itens_lista, 'listar', fake_listar)
        return chamadas

    return _instalar


def test_get_lista_filtra_por_tipo_e_estado_do_usuario(client, auth_headers, listar):
    """A leitura não passa pelo módulo de domínio: a rota lê de `itens_lista` direto."""
    chamadas = listar([linha_de_item()])

    response = client.get('/api/lista?tipo=anime&status_consumo=assistindo', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()['lista'][0]['id_lista'] == 'LST-1'
    assert chamadas == [('USR-TEST-0001', 'anime', 'assistindo')]


def test_get_lista_serve_o_item_no_modelo_sem_os_apelidos_legados(client, auth_headers, listar):
    listar([linha_de_item()])

    item = client.get('/api/lista', headers=auth_headers).get_json()['lista'][0]

    for legado in ('status_visualizacao', 'episodios_assistidos', 'codigo_lista', 'id_anime', 'codigo_anime',
                   'codigo_midia', 'anime_trailer_url', 'trailer_url', 'unidade_progresso', 'rawg_slug',
                   'tipo_label', 'progresso_total_padrao'):
        assert legado not in item
    assert (item['nota_usuario'], item['nota_fonte'], item['favorito']) == (8.5, 8.9, True)
    assert (item['data_inicio'], item['data_lancamento'], item['data_conclusao']) == ('2026-10-01', '2023-09-29', None)
    assert item['data_adicao'] == '2026-11-06T10:00:00Z'
    assert item['generos_lista'] == ['Aventura', 'Drama']


@pytest.mark.parametrize('campo, valor', [
    ('status_anime', 'em_algum_lugar'), ('demografia', 'adulto'), ('origem_nota', 'IMDb'), ('status_consumo', 'vendo'),
])
def test_get_lista_tipa_a_midia_do_item_com_os_enums_da_midia(client, auth_headers, listar, campo, valor):
    """A Mídia do Item usa os mesmos enums da Mídia de /midias; fora deles, a resposta sai do contrato."""
    listar([linha_de_item(**{campo: valor})])

    assert client.get('/api/lista', headers=auth_headers).status_code == 500


def test_get_lista_recusa_tipo_desconhecido_no_envelope(client, auth_headers, listar):
    chamadas = listar([])

    response = client.get('/api/lista?tipo=filme', headers=auth_headers)

    assert response.status_code == 400
    assert response.get_json()['codigo'] == 'dados_invalidos'
    assert 'tipo' in response.get_json()['detalhes']
    assert chamadas == []


def test_get_lista_com_filtro_vazio_vale_como_ausente(client, auth_headers, listar):
    chamadas = listar([])

    assert client.get('/api/lista?tipo=&status_consumo=', headers=auth_headers).status_code == 200
    assert chamadas == [('USR-TEST-0001', None, None)]


def test_lista_exige_token_e_so_serve_a_lista_do_dono(client, auth_headers, listar):
    listar([linha_de_item()])
    assert client.get('/api/lista').status_code == 401

    alheia = client.get('/api/lista/USR-OUTRO-1', headers=auth_headers)
    propria = client.get('/api/lista/USR-TEST-0001', headers=auth_headers)

    assert alheia.status_code == 403
    assert alheia.get_json() == {'erro': 'Sem permissão para acessar esta lista', 'codigo': 'acesso_negado'}
    assert propria.status_code == 200
    assert propria.get_json()['lista'][0]['id_lista'] == 'LST-1'


@pytest.mark.parametrize('rota', ['/api/lista', '/api/lista/adicionar'])
def test_post_lista_entrega_ao_modulo_so_os_campos_enviados(client, auth_headers, modulo, rota):
    falso = modulo(Resultado(OK, id_lista='LST-10'))

    response = client.post(rota, headers=auth_headers, json={
        'id_midia': 'MID-1', 'status_consumo': 'assistindo', 'progresso_atual': 5, 'nota_usuario': None,
        'data_conclusao': '2026-04-11', 'favorito': 1, 'titulo_original': 'campo do Item ignorado',
    })

    assert response.status_code == 201
    assert response.get_json() == {'mensagem': 'Mídia adicionada à lista!', 'id_lista': 'LST-10'}
    assert falso.chamadas == [('adicionar', 'USR-TEST-0001', {
        'id_midia': 'MID-1', 'status_consumo': 'assistindo', 'progresso_atual': 5, 'nota_usuario': None,
        'data_conclusao': '2026-04-11', 'favorito': True,
    })]


@pytest.mark.parametrize('corpo', [
    {'id_midia': 'MID-1', 'status': 'assistindo'},
    {'id_anime': 'MID-1', 'status_visualizacao': 'assistindo'},
])
def test_post_lista_nao_aceita_apelidos(client, auth_headers, modulo, corpo):
    """Só `id_midia` e `status_consumo`: `status` (o último apelido, do web) também saiu."""
    falso = modulo(Resultado(OK, id_lista='LST-10'))

    recusado = client.post('/api/lista', headers=auth_headers, json=corpo)

    assert recusado.status_code == 400
    assert 'status_consumo' in recusado.get_json()['detalhes']
    assert falso.chamadas == []


def test_post_lista_traduz_invalido_para_400_no_envelope(client, auth_headers, modulo):
    modulo(Resultado(INVALIDO, {'status_consumo': 'O rótulo não se aplica'}))

    response = client.post('/api/lista/adicionar', headers=auth_headers, json={
        'id_midia': 'MID-1', 'status_consumo': 'platinado',
    })

    assert response.status_code == 400
    assert response.get_json() == {
        'erro': 'O rótulo não se aplica', 'codigo': 'dados_invalidos',
        'detalhes': {'status_consumo': 'O rótulo não se aplica'},
    }


def test_corpo_fora_do_tipo_nao_chega_ao_modulo(client, auth_headers, modulo):
    falso = modulo()

    response = client.put('/api/lista/LST-1', headers=auth_headers, json={
        'progresso_atual': 'muitos', 'data_inicio': '11/04/2026',
    })

    assert response.status_code == 400
    assert response.get_json()['codigo'] == 'dados_invalidos'
    assert set(response.get_json()['detalhes']) == {'progresso_atual', 'data_inicio'}
    assert falso.chamadas == []


def test_put_e_delete_encaminham_o_item_do_usuario_e_respondem_200(client, auth_headers, modulo):
    falso = modulo()

    resposta_put = client.put('/api/lista/LST-1', headers=auth_headers, json={'nota_usuario': 8, 'comentario': ''})
    resposta_delete = client.delete('/api/lista/LST-1', headers=auth_headers)

    assert (resposta_put.status_code, resposta_put.get_json()) == (200, {'mensagem': 'Lista atualizada com sucesso!'})
    assert (resposta_delete.status_code, resposta_delete.get_json()) == (200, {'mensagem': 'Mídia removida da lista'})
    assert falso.chamadas == [
        ('atualizar', 'USR-TEST-0001', 'LST-1', {'nota_usuario': 8.0, 'comentario': None}),
        ('remover', 'USR-TEST-0001', 'LST-1'),
    ]


@pytest.mark.parametrize('codigo', [NAO_ENCONTRADO, NEGADO])
def test_item_de_terceiro_e_inexistente_respondem_o_mesmo_403(client, auth_headers, modulo, codigo):
    """Um 404 aqui revelaria quais Itens existem nas listas dos outros."""
    modulo(Resultado(codigo))

    resposta_put = client.put('/api/lista/LST-1', headers=auth_headers, json={'favorito': True})
    resposta_delete = client.delete('/api/lista/LST-1', headers=auth_headers)

    esperado = {'erro': 'Item não encontrado ou sem permissão', 'codigo': 'acesso_negado'}
    assert (resposta_put.status_code, resposta_put.get_json()) == (403, esperado)
    assert (resposta_delete.status_code, resposta_delete.get_json()) == (403, esperado)


def test_put_progresso_exige_o_campo_progresso(client, auth_headers, modulo):
    falso = modulo()

    response = client.put('/api/lista/LST-1/progresso', headers=auth_headers, json={'episodios_assistidos': 3})

    assert response.status_code == 400
    assert response.get_json()['detalhes'] == {'progresso_atual': 'Campo obrigatório'}
    assert falso.chamadas == []


def test_put_progresso_passa_pelo_modulo_e_rebaixa_o_concluido(client, auth_headers, monkeypatch):
    """O stepper usa esta rota: baixar do total tira o Item de Concluído (ADR 0009)."""
    from dominio.lista_pessoal import ListaPessoal

    from .helpers import FakeCatalogo, FakeItensLista

    midias = {'MID-1': {'tipo': 'anime', 'progresso_total_padrao': 10}}
    lista = FakeItensLista(midias=midias, itens={'LST-1': {
        'id_lista': 'LST-1', 'id_usuario': 'USR-TEST-0001', 'id_midia': 'MID-1',
        'status_consumo': 'completo', 'progresso_atual': 10, 'data_conclusao': '2026-01-02',
    }})
    monkeypatch.setattr(lista_routes, 'lista_pessoal', ListaPessoal(lista, FakeCatalogo(midias)))

    response = client.put('/api/lista/LST-1/progresso', headers=auth_headers, json={'progresso_atual': 9})

    assert (response.status_code, response.get_json()) == (200, {'mensagem': 'Progresso atualizado com sucesso!'})
    assert lista.itens['LST-1']['status_consumo'] == 'assistindo'
    assert lista.itens['LST-1']['progresso_atual'] == 9
