"""Destaques do Perfil com o PostgreSQL real, depois da sincronização com a Steam falsa.

`GET /usuario/conquistas/destaques`: até 6, da mais rara para a mais comum (empate ou sem raridade:
a obtida mais recente primeiro; sem raridade no fim); sem escolha, as 6 obtidas mais raras com a
marca de automáticos; o total de conquistas e de jogos. `PUT`/`DELETE` de um destaque pela
conquista (appid e código): só a obtida do próprio Usuário, o sétimo responde 409. Sem
TEST_DATABASE_URL, pula.
"""
import pytest

from integracoes import sincronizacao_steam

from .fontes_falsas import ICONES, conquista, jogo_steam
from .helpers import criar_usuario
from .test_conquistas_steam_pg import DEPOIS, QUANDO, _conectar, _id_lista
from .test_integracoes_steam_pg import HORA, _no_catalogo
from .test_repositorios_pg import TEST_DATABASE_URL

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as conquistas'
)

DESTAQUES = '/api/usuario/conquistas/destaques'
MAIS_DEPOIS = DEPOIS + 86_400


@pytest.fixture
def sincronizar(usuario, fontes, jogo):
    """`sincronizar({nome: [conquista(...)]})`: os jogos lidos pelo job; devolve {nome: (appid, id_midia)}."""
    def rodar(por_jogo):
        id_usuario, _ = usuario
        jogos, conquistas = {}, {}
        for nome_curto, lista in por_jogo.items():
            appid, slug, nome = jogo(nome_curto)
            jogos[nome_curto] = (appid, _no_catalogo(appid, slug, nome), nome)
            conquistas[appid] = lista
        fontes([jogo_steam(appid, nome, 600, HORA) for appid, _, nome in jogos.values()], conquistas=conquistas)
        _conectar(id_usuario)
        sincronizacao_steam.sincronizar(id_usuario, orcamento=None)
        return {n: (appid, id_midia) for n, (appid, id_midia, _) in jogos.items()}

    return rodar


def _destaques(client, headers):
    resposta = client.get(DESTAQUES, headers=headers)
    assert resposta.status_code == 200, resposta.get_json()
    return resposta.get_json()


def _destacar(client, headers, appid, codigo):
    return client.put(f'{DESTAQUES}/{appid}/{codigo}', headers=headers)


def _tirar(client, headers, appid, codigo):
    return client.delete(f'{DESTAQUES}/{appid}/{codigo}', headers=headers)


def _codigos(corpo):
    return [d['codigo'] for d in corpo['destaques']]


def test_sem_escolha_as_6_obtidas_mais_raras_automaticas_e_o_total(client, usuario, sincronizar):
    sincronizar({
        'Um': [conquista(c, obtida_em=QUANDO, raridade=r) for c, r in
               [('A', '50'), ('B', '3.5'), ('C', '80'), ('D', '1.2')]] + [conquista('Falta', raridade='0.1')],
        'Dois': [conquista(c, obtida_em=QUANDO, raridade=r) for c, r in [('E', '9'), ('F', '20'), ('G', '99')]],
        'Tres': [conquista('Nenhuma', raridade='5')],
    })

    corpo = _destaques(client, usuario[1])

    assert corpo['automaticos'] is True
    assert _codigos(corpo) == ['D', 'B', 'E', 'F', 'A', 'C']
    assert corpo['total'] == {'conquistas': 7, 'jogos': 2}


def test_destaque_traz_icone_nome_jogo_raridade_e_data(client, usuario, sincronizar):
    jogos = sincronizar({'Um': [conquista('A', 'A Primeira', obtida_em=QUANDO, raridade='3.24')]})
    appid, id_midia = jogos['Um']

    [destaque] = _destaques(client, usuario[1])['destaques']

    assert destaque == {
        'steam_appid': appid, 'codigo': 'A', 'nome': 'A Primeira', 'icone': f'{ICONES}/{appid}/A.jpg',
        'raridade': 3.24, 'obtida_em': destaque['obtida_em'], 'id_lista': _id_lista(usuario[0], id_midia),
        'id_midia': id_midia, 'jogo': destaque['jogo'],
    }
    assert destaque['obtida_em'].startswith('2020-12-10')
    assert destaque['jogo'].startswith('Um')


def test_empate_de_raridade_e_sem_raridade_vao_pela_obtida_mais_recente(client, usuario, sincronizar):
    sincronizar({'Um': [
        conquista('SemVelha', obtida_em=QUANDO, raridade=None),
        conquista('SemNova', obtida_em=DEPOIS, raridade=None),
        conquista('Velha', obtida_em=QUANDO, raridade='10'),
        conquista('Nova', obtida_em=MAIS_DEPOIS, raridade='10'),
        conquista('Rara', obtida_em=QUANDO, raridade='2'),
    ]})

    assert _codigos(_destaques(client, usuario[1])) == ['Rara', 'Nova', 'Velha', 'SemNova', 'SemVelha']


def test_sem_nenhuma_obtida_nada_e_total_zero(client, usuario, sincronizar):
    sincronizar({'Um': [conquista('A'), conquista('B')]})

    assert _destaques(client, usuario[1]) == {
        'destaques': [], 'automaticos': True, 'total': {'conquistas': 0, 'jogos': 0},
    }


def test_escolhidos_aparecem_sozinhos_da_mais_rara_para_a_mais_comum(client, usuario, sincronizar):
    jogos = sincronizar({
        'Um': [conquista('Comum', obtida_em=QUANDO, raridade='70'), conquista('Rara', obtida_em=QUANDO, raridade='1')],
        'Dois': [conquista('Meio', obtida_em=QUANDO, raridade='30')],
    })
    um, dois = jogos['Um'][0], jogos['Dois'][0]
    headers = usuario[1]

    assert _destacar(client, headers, um, 'Comum').status_code == 200
    assert _destacar(client, headers, dois, 'Meio').status_code == 200

    corpo = _destaques(client, headers)
    assert (corpo['automaticos'], _codigos(corpo)) == (False, ['Meio', 'Comum'])
    assert corpo['total'] == {'conquistas': 3, 'jogos': 2}


def test_destacar_de_novo_nao_muda_nada(client, usuario, sincronizar):
    appid = sincronizar({'Um': [conquista('A', obtida_em=QUANDO)]})['Um'][0]

    assert _destacar(client, usuario[1], appid, 'A').status_code == 200
    assert _destacar(client, usuario[1], appid, 'A').status_code == 200

    assert _codigos(_destaques(client, usuario[1])) == ['A']


def test_tirar_o_ultimo_volta_aos_automaticos(client, usuario, sincronizar):
    appid = sincronizar({'Um': [conquista('A', obtida_em=QUANDO, raridade='5'),
                                conquista('B', obtida_em=QUANDO, raridade='50')]})['Um'][0]
    headers = usuario[1]
    _destacar(client, headers, appid, 'B')

    assert _tirar(client, headers, appid, 'B').status_code == 200
    assert _tirar(client, headers, appid, 'B').status_code == 200

    corpo = _destaques(client, headers)
    assert (corpo['automaticos'], _codigos(corpo)) == (True, ['A', 'B'])


def test_o_setimo_responde_409_com_codigo_proprio(client, usuario, sincronizar):
    appid = sincronizar({'Um': [conquista(f'C{i}', obtida_em=QUANDO) for i in range(7)]})['Um'][0]
    headers = usuario[1]
    for i in range(6):
        assert _destacar(client, headers, appid, f'C{i}').status_code == 200

    resposta = _destacar(client, headers, appid, 'C6')

    assert resposta.status_code == 409
    assert resposta.get_json()['codigo'] == 'limite_de_destaques'
    assert len(_destaques(client, headers)['destaques']) == 6
    # Um dos seis de novo não é o sétimo.
    assert _destacar(client, headers, appid, 'C0').status_code == 200


@pytest.mark.parametrize('metodo', ['put', 'delete'])
def test_conquista_que_falta_ou_que_nao_existe_responde_404(client, usuario, sincronizar, metodo):
    appid = sincronizar({'Um': [conquista('Feita', obtida_em=QUANDO), conquista('Falta')]})['Um'][0]
    headers = usuario[1]

    for alvo, codigo in [(appid, 'Falta'), (appid, 'Inexistente'), (999_999_999, 'Feita')]:
        resposta = getattr(client, metodo)(f'{DESTAQUES}/{alvo}/{codigo}', headers=headers)
        assert resposta.status_code == 404, (alvo, codigo)
        assert resposta.get_json()['codigo'] == 'nao_encontrado'


def test_conquista_de_outro_usuario_responde_404_e_nao_destaca(client, usuario, sincronizar, pg, make_token):
    appid = sincronizar({'Um': [conquista('A', obtida_em=QUANDO)]})['Um'][0]
    outro = {'Authorization': f'Bearer {make_token(criar_usuario(pg))}'}

    assert _destacar(client, outro, appid, 'A').status_code == 404
    assert _destaques(client, outro) == {'destaques': [], 'automaticos': True,
                                          'total': {'conquistas': 0, 'jogos': 0}}
    assert _destaques(client, usuario[1])['automaticos'] is True


def test_codigo_com_caracteres_especiais(client, usuario, sincronizar):
    appid = sincronizar({'Um': [conquista('NEW ACH.1', obtida_em=QUANDO)]})['Um'][0]

    assert _destacar(client, usuario[1], appid, 'NEW%20ACH.1').status_code == 200
    assert _codigos(_destaques(client, usuario[1])) == ['NEW ACH.1']


def test_sem_sessao_responde_401(client):
    assert client.get(DESTAQUES).status_code == 401
    assert client.put(f'{DESTAQUES}/10/A').status_code == 401
    assert client.delete(f'{DESTAQUES}/10/A').status_code == 401
