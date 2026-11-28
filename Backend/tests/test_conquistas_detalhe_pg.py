"""GET /lista/<id_lista>/conquistas com o PostgreSQL real, depois da sincronização com a Steam falsa.

A lista do Detalhe do jogo: obtidas da mais recente para a mais antiga, depois as que faltam da mais
comum para a mais rara; a oculta não obtida sem nome nem descrição; o ícone colorido na obtida e o
cinza na que falta; a marca de destacada; só o dono do Item. Sem TEST_DATABASE_URL, pula.
"""
import pytest

import banco
from integracoes import sincronizacao_steam

from .fontes_falsas import ICONES, conquista, jogo_steam
from .helpers import criar_usuario
from .test_conquistas_steam_pg import DEPOIS, QUANDO, _conectar, _id_lista
from .test_integracoes_steam_pg import HORA, _no_catalogo
from .test_repositorios_pg import TEST_DATABASE_URL

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as conquistas'
)

MAIS_DEPOIS = DEPOIS + 86_400


def _sincronizado(usuario, fontes, jogo, lista):
    """O id_lista do jogo do Usuário, já com as conquistas `lista` lidas pelo job."""
    id_usuario, _ = usuario
    appid, slug, nome = jogo('Conquistas')
    id_midia = _no_catalogo(appid, slug, nome)
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: lista})
    _conectar(id_usuario)
    sincronizacao_steam.sincronizar(id_usuario, orcamento=None)
    return appid, _id_lista(id_usuario, id_midia)


def _conquistas(client, headers, id_lista):
    resposta = client.get(f'/api/lista/{id_lista}/conquistas', headers=headers)
    assert resposta.status_code == 200, resposta.get_json()
    return resposta.get_json()['conquistas']


def test_obtidas_das_mais_recentes_e_depois_as_que_faltam_das_mais_comuns(client, usuario, fontes, jogo):
    _, id_lista = _sincronizado(usuario, fontes, jogo, [
        conquista('Rara', raridade='3.24'),
        conquista('Antiga', obtida_em=QUANDO, raridade='90'),
        conquista('Comum', raridade='71.5'),
        conquista('Recente', obtida_em=MAIS_DEPOIS, raridade='12'),
        conquista('Meio', obtida_em=DEPOIS, raridade='40'),
        conquista('SemRaridade', raridade=None),
    ])

    lista = _conquistas(client, usuario[1], id_lista)

    assert [c['codigo'] for c in lista] == ['Recente', 'Meio', 'Antiga', 'Comum', 'Rara', 'SemRaridade']
    assert lista[0]['obtida_em'].startswith('2020-12-12')
    assert (lista[3]['obtida_em'], lista[4]['raridade']) == (None, 3.24)


def test_oculta_que_falta_vem_sem_nome_nem_descricao_e_a_obtida_vem_com_nome(client, usuario, fontes, jogo):
    _, id_lista = _sincronizado(usuario, fontes, jogo, [
        conquista('Segredo', 'O Segredo', oculta=True, descricao='Descubra o final.'),
        conquista('Revelada', 'A Revelada', oculta=True, obtida_em=QUANDO),
    ])

    por_codigo = {c['codigo']: c for c in _conquistas(client, usuario[1], id_lista)}

    assert (por_codigo['Segredo']['nome'], por_codigo['Segredo']['descricao']) == (None, None)
    assert por_codigo['Segredo']['oculta'] is True
    # A descrição da oculta não vem no esquema da Steam: só o nome aparece depois de obtida.
    assert (por_codigo['Revelada']['nome'], por_codigo['Revelada']['oculta']) == ('A Revelada', True)


def test_icone_colorido_na_obtida_e_cinza_na_que_falta(client, usuario, fontes, jogo):
    appid, id_lista = _sincronizado(usuario, fontes, jogo, [
        conquista('Feita', obtida_em=QUANDO), conquista('Falta'),
    ])

    por_codigo = {c['codigo']: c for c in _conquistas(client, usuario[1], id_lista)}

    assert por_codigo['Feita']['icone'] == f'{ICONES}/{appid}/Feita.jpg'
    assert por_codigo['Falta']['icone'] == f'{ICONES}/{appid}/cinza.jpg'


def test_marca_a_destacada(client, usuario, fontes, jogo):
    _, id_lista = _sincronizado(usuario, fontes, jogo, [
        conquista('A', obtida_em=QUANDO), conquista('B', obtida_em=DEPOIS),
    ])
    banco.executar("INSERT INTO conquistas_destaques (id_lista, codigo) VALUES (%s, 'A')", (id_lista,))

    por_codigo = {c['codigo']: c['destacada'] for c in _conquistas(client, usuario[1], id_lista)}

    assert por_codigo == {'A': True, 'B': False}


def test_item_sem_leitura_responde_lista_vazia(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    appid, slug, nome = jogo('Conquistas')
    id_midia = _no_catalogo(appid, slug, nome)
    fontes([jogo_steam(appid, nome, 600, HORA)])  # sem stats: o jogo não tem conquistas
    _conectar(id_usuario)
    sincronizacao_steam.sincronizar(id_usuario, orcamento=None)

    assert _conquistas(client, headers, _id_lista(id_usuario, id_midia)) == []


@pytest.mark.parametrize('id_lista', ['outro', '00000000-0000-0000-0000-000000000000', 'nao-e-uuid'])
def test_so_o_dono_do_item(client, usuario, fontes, jogo, pg, make_token, id_lista):
    _, do_dono = _sincronizado(usuario, fontes, jogo, [conquista('A', obtida_em=QUANDO)])
    outro = {'Authorization': f'Bearer {make_token(criar_usuario(pg))}'}

    resposta = client.get(f'/api/lista/{do_dono if id_lista == "outro" else id_lista}/conquistas', headers=outro)

    assert resposta.status_code == 403
    assert resposta.get_json()['codigo'] == 'acesso_negado'


def test_sem_sessao_responde_401(client, usuario, fontes, jogo):
    _, id_lista = _sincronizado(usuario, fontes, jogo, [conquista('A')])

    assert client.get(f'/api/lista/{id_lista}/conquistas').status_code == 401
