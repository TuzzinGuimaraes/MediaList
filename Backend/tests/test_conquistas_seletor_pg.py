# ruff: noqa: F811 (a fixture `sincronizar` vem de test_conquistas_destaques_pg)
"""Seletor de destaques com o PostgreSQL real, depois da sincronização com a Steam falsa.

`GET /usuario/conquistas`: as conquistas obtidas do próprio Usuário, em páginas de 50, com busca
pelo nome (sem caixa nem acento), filtro pelo jogo (`steam_appid`), "só as destacadas" e a ordem
por raridade (padrão: a mais rara primeiro, sem raridade no fim) ou por data (a mais recente
primeiro). `GET /usuario/conquistas/jogos`: os jogos com alguma obtida, para o filtro. Sem
TEST_DATABASE_URL, pula.
"""
import pytest

from .fontes_falsas import ICONES, conquista
from .helpers import criar_usuario
from .test_conquistas_destaques_pg import DESTAQUES, MAIS_DEPOIS, _destacar, sincronizar  # noqa: F401 (fixture)
from .test_conquistas_steam_pg import DEPOIS, QUANDO, _id_lista
from .test_repositorios_pg import TEST_DATABASE_URL

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as conquistas'
)

CONQUISTAS = '/api/usuario/conquistas'
JOGOS = '/api/usuario/conquistas/jogos'


def _pagina(client, headers, **params):
    resposta = client.get(CONQUISTAS, headers=headers, query_string=params)
    assert resposta.status_code == 200, resposta.get_json()
    return resposta.get_json()


def _codigos(corpo):
    return [c['codigo'] for c in corpo['itens']]


def test_obtidas_de_todos_os_jogos_da_mais_rara_para_a_mais_comum(client, usuario, sincronizar):
    sincronizar({
        'Um': [conquista('A', obtida_em=QUANDO, raridade='50'), conquista('Sem', obtida_em=QUANDO, raridade=None),
               conquista('Falta', raridade='0.1')],
        'Dois': [conquista('B', obtida_em=QUANDO, raridade='3'), conquista('C', obtida_em=QUANDO, raridade='80')],
    })

    corpo = _pagina(client, usuario[1])

    assert _codigos(corpo) == ['B', 'A', 'C', 'Sem']
    assert (corpo['pagina'], corpo['por_pagina'], corpo['total']) == (1, 50, 4)


def test_cada_linha_traz_a_conquista_destacada_e_o_jogo(client, usuario, sincronizar):
    jogos = sincronizar({'Um': [conquista('A', 'A Primeira', obtida_em=QUANDO, raridade='3.24', oculta=True)]})
    appid, id_midia = jogos['Um']
    assert _destacar(client, usuario[1], appid, 'A').status_code == 200

    [linha] = _pagina(client, usuario[1])['itens']

    assert linha == {
        'steam_appid': appid, 'codigo': 'A', 'nome': 'A Primeira', 'descricao': None,
        'icone': f'{ICONES}/{appid}/A.jpg', 'oculta': True, 'raridade': 3.24, 'obtida': True,
        'obtida_em': linha['obtida_em'], 'destacada': True,
        'id_lista': _id_lista(usuario[0], id_midia), 'id_midia': id_midia, 'jogo': linha['jogo'],
    }
    assert linha['obtida_em'].startswith('2020-12-10')
    assert linha['jogo'].startswith('Um')


def test_ordem_por_data_da_mais_recente_para_a_mais_antiga(client, usuario, sincronizar):
    sincronizar({'Um': [
        conquista('Velha', obtida_em=QUANDO, raridade='1'),
        conquista('Nova', obtida_em=MAIS_DEPOIS, raridade='90'),
        conquista('Meio', obtida_em=DEPOIS, raridade='40'),
    ]})

    assert _codigos(_pagina(client, usuario[1], ordem='data')) == ['Nova', 'Meio', 'Velha']
    assert _codigos(_pagina(client, usuario[1], ordem='raridade')) == ['Velha', 'Meio', 'Nova']


def test_ordem_desconhecida_responde_400(client, usuario):
    assert client.get(CONQUISTAS, headers=usuario[1], query_string={'ordem': 'nome'}).status_code == 400


def test_busca_pelo_nome_sem_caixa_nem_acento(client, usuario, sincronizar):
    sincronizar({
        'Um': [conquista('A', 'Ação Rápida', obtida_em=QUANDO, raridade='1'),
               conquista('B', 'Lenta', obtida_em=QUANDO, raridade='2')],
        'Dois': [conquista('C', 'REAÇÃO em cadeia', obtida_em=QUANDO, raridade='3'),
                 conquista('D', 'Ação escondida', raridade='4')],
    })

    assert _codigos(_pagina(client, usuario[1], busca='acao')) == ['A', 'C']
    assert _codigos(_pagina(client, usuario[1], busca='  ')) == ['A', 'B', 'C']


def test_filtro_por_jogo(client, usuario, sincronizar):
    jogos = sincronizar({
        'Um': [conquista('A', obtida_em=QUANDO, raridade='1')],
        'Dois': [conquista('B', obtida_em=QUANDO, raridade='2'), conquista('C', obtida_em=QUANDO, raridade='3')],
    })

    corpo = _pagina(client, usuario[1], steam_appid=jogos['Dois'][0])

    assert (_codigos(corpo), corpo['total']) == (['B', 'C'], 2)


def test_so_as_destacadas(client, usuario, sincronizar):
    appid = sincronizar({'Um': [conquista(c, obtida_em=QUANDO, raridade=r)
                                for c, r in [('A', '1'), ('B', '2'), ('C', '3')]]})['Um'][0]
    _destacar(client, usuario[1], appid, 'C')
    _destacar(client, usuario[1], appid, 'A')

    corpo = _pagina(client, usuario[1], so_destacadas='true')

    assert (_codigos(corpo), corpo['total']) == (['A', 'C'], 2)
    assert [c['destacada'] for c in _pagina(client, usuario[1])['itens']] == [True, False, True]


def test_paginas_de_50_sem_repetir_nem_pular(client, usuario, sincronizar):
    sincronizar({'Um': [conquista(f'C{i:02}', obtida_em=QUANDO, raridade='5') for i in range(55)]})

    primeira = _pagina(client, usuario[1])
    segunda = _pagina(client, usuario[1], pagina=2)

    assert (len(primeira['itens']), len(segunda['itens']), primeira['total']) == (50, 5, 55)
    assert sorted(_codigos(primeira) + _codigos(segunda)) == [f'C{i:02}' for i in range(55)]
    assert len(_pagina(client, usuario[1], por_pagina=500)['itens']) == 50


def test_jogos_com_alguma_obtida_para_o_filtro(client, usuario, sincronizar):
    jogos = sincronizar({
        'Beta': [conquista('A', obtida_em=QUANDO), conquista('B', obtida_em=QUANDO), conquista('Falta')],
        'Alfa': [conquista('C', obtida_em=QUANDO)],
        'Nada': [conquista('D')],
    })

    resposta = client.get(JOGOS, headers=usuario[1])

    assert resposta.status_code == 200, resposta.get_json()
    corpo = resposta.get_json()['jogos']
    assert [(j['steam_appid'], j['id_midia'], j['obtidas']) for j in corpo] == [
        (*jogos['Alfa'], 1), (*jogos['Beta'], 2),
    ]
    assert corpo[0]['jogo'].startswith('Alfa')


def test_so_as_do_proprio_usuario(client, usuario, sincronizar, pg, make_token):
    sincronizar({'Um': [conquista('A', obtida_em=QUANDO)]})
    outro = {'Authorization': f'Bearer {make_token(criar_usuario(pg))}'}

    assert _pagina(client, outro) == {'itens': [], 'pagina': 1, 'por_pagina': 50, 'total': 0}
    assert client.get(JOGOS, headers=outro).get_json() == {'jogos': []}


def test_sem_sessao_responde_401(client):
    assert client.get(CONQUISTAS).status_code == 401
    assert client.get(JOGOS).status_code == 401
    assert client.get(DESTAQUES).status_code == 401
