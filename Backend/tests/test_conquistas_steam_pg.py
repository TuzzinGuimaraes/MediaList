"""Conquistas da Steam na sincronização, com o PostgreSQL real e a Steam falsa (nada de rede).

Quais jogos são lidos (job diário: novo, horas que subiram ou nunca lido; "Sincronizar agora": só os
de horas que subiram, dentro do orçamento), jogo sem stats e detalhes privados sem falha, falha que
mantém o anterior, esquema relido só quando falta ou o total muda, raridade renovada, destaque que
sai com a conquista e o resumo no Item de `GET /lista`. Sem TEST_DATABASE_URL, pula.
"""
from datetime import datetime, timezone

import pytest

import banco
from importacao import utils as importacao_utils
from integracoes import conquistas, repositorio, sincronizacao_steam
from integracoes.plataforma import Conta

from .fontes_falsas import (
    CHAVE_STEAM,
    DETALHES_PRIVADOS,
    ICONES,
    SEM_STATS,
    STEAMID,
    Resposta,
    conquista,
    jogo_steam,
)
from .test_integracoes_steam_pg import HORA, _no_catalogo
from .test_repositorios_pg import TEST_DATABASE_URL

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as conquistas'
)

QUANDO = 1_607_614_356  # 10/12/2020, 15:32:36 UTC
DEPOIS = 1_607_701_254


def _conectar(id_usuario):
    repositorio.gravar_conta(id_usuario, 'steam', Conta(STEAMID, 'Fulano'))


def _job(id_usuario):
    return sincronizacao_steam.sincronizar(id_usuario, orcamento=None)


def _agora(client, headers):
    resposta = client.post('/api/integracoes/steam/sincronizar', headers=headers)
    assert resposta.status_code == 200, resposta.get_json()
    return resposta.get_json()


def _resumo(client, headers, id_midia):
    lista = client.get('/api/lista', headers=headers).get_json()['lista']
    return next(i for i in lista if i['id_midia'] == id_midia)['conquistas']


def _id_lista(id_usuario, id_midia):
    return banco.consultar_um('SELECT id_lista FROM lista_usuarios WHERE id_usuario = %s AND id_midia = %s',
                              (id_usuario, id_midia))['id_lista']


@pytest.fixture
def do_item(client, make_token):
    """`do_item(id_usuario, id_midia)`: as conquistas do Item por `GET /lista/<id>/conquistas`, por código."""
    def ler(id_usuario, id_midia):
        resposta = client.get(f'/api/lista/{_id_lista(id_usuario, id_midia)}/conquistas',
                              headers={'Authorization': f'Bearer {make_token(id_usuario)}'})
        assert resposta.status_code == 200, resposta.get_json()
        return {c['codigo']: c for c in resposta.get_json()['conquistas']}

    return ler


def _lidas(sessao, metodo):
    """As appids pedidas a um método da Steam."""
    return [int(p.get('appid') or p.get('gameid')) for url, p in sessao.steam.chamadas if metodo in url]


@pytest.fixture
def jogos(jogo):
    """`jogos(n)`: n jogos já casados no Catálogo, como (appid, id_midia, nome)."""
    def criar(n):
        criados = []
        for i in range(n):
            appid, slug, nome = jogo(f'Conquistas{i}')
            criados.append((appid, _no_catalogo(appid, slug, nome), nome))
        return criados

    return criar


# ============================================
# Leitura e resumo
# ============================================

def test_job_le_as_conquistas_do_jogo_novo_e_o_item_traz_o_resumo(client, usuario, fontes, jogos, do_item):
    id_usuario, headers = usuario
    [(appid, id_midia, nome)] = jogos(1)
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: [
        conquista('TheFool', 'O Louco', obtida_em=QUANDO, oculta=True, raridade='88.6'),
        conquista('TheLovers', 'Os Enamorados', obtida_em=DEPOIS, raridade='4.2'),
        conquista('TheTower', 'A Torre', raridade='0.3'),
    ]})
    _conectar(id_usuario)

    _job(id_usuario)

    assert _resumo(client, headers, id_midia) == {'obtidas': 2, 'total': 3}
    lidas = do_item(id_usuario, id_midia)
    assert {**lidas['TheFool'], 'obtida_em': None} == {
        'steam_appid': appid, 'codigo': 'TheFool', 'nome': 'O Louco', 'descricao': None, 'oculta': True,
        'raridade': 88.6, 'icone': f'{ICONES}/{appid}/TheFool.jpg', 'obtida': True, 'obtida_em': None,
        'destacada': False,
    }
    assert datetime.fromisoformat(lidas['TheFool']['obtida_em']) == datetime.fromtimestamp(QUANDO, tz=timezone.utc)
    assert lidas['TheLovers']['descricao'] == 'Faça TheLovers.'
    torre = lidas['TheTower']
    assert (torre['obtida'], torre['raridade'], torre['icone']) == (False, 0.3, f'{ICONES}/{appid}/cinza.jpg')


def test_esquema_e_raridade_sao_pedidos_em_portugues_e_sem_a_chave_na_raridade(usuario, fontes, jogos):
    id_usuario, _ = usuario
    [(appid, _, nome)] = jogos(1)
    sessao = fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: [conquista('A')]})
    _conectar(id_usuario)

    _job(id_usuario)

    pedidos = {url.rsplit('/', 3)[-3]: p for url, p in sessao.steam.chamadas}
    assert pedidos['GetPlayerAchievements']['l'] == 'brazilian'
    assert pedidos['GetSchemaForGame']['l'] == 'brazilian'
    assert 'key' not in pedidos['GetGlobalAchievementPercentagesForApp']


def test_nenhuma_obtida_mostra_zero_do_total(client, usuario, fontes, jogos):
    id_usuario, headers = usuario
    [(appid, id_midia, nome)] = jogos(1)
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: [conquista('A'), conquista('B')]})
    _conectar(id_usuario)

    _job(id_usuario)

    assert _resumo(client, headers, id_midia) == {'obtidas': 0, 'total': 2}


def test_jogo_nunca_lido_fica_sem_resumo(client, usuario, fontes, jogos):
    id_usuario, headers = usuario
    [(appid, id_midia, nome)] = jogos(1)
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: [conquista('A')]})
    _conectar(id_usuario)

    _agora(client, headers)  # o "Sincronizar agora" não lê o jogo nunca lido: fica para o job

    assert _resumo(client, headers, id_midia) is None


# ============================================
# Quais jogos são lidos
# ============================================

def test_job_rele_so_os_jogos_com_horas_que_subiram(usuario, fontes, jogos):
    id_usuario, _ = usuario
    (a, _, na), (b, _, nb) = jogos(2)
    lista = {a: [conquista('A')], b: [conquista('B')]}
    fontes([jogo_steam(a, na, 600, HORA), jogo_steam(b, nb, 600, HORA)], conquistas=lista)
    _conectar(id_usuario)
    _job(id_usuario)

    sessao = fontes([jogo_steam(a, na, 900, HORA), jogo_steam(b, nb, 600, HORA)], conquistas=lista)
    _job(id_usuario)

    assert _lidas(sessao, 'GetPlayerAchievements') == [a]


def test_sincronizar_agora_le_os_jogos_com_horas_que_subiram_e_grava_as_novas(client, usuario, fontes, jogos):
    id_usuario, headers = usuario
    (a, ma, na), (b, mb, nb) = jogos(2)
    fontes([jogo_steam(a, na, 600, HORA), jogo_steam(b, nb, 600, HORA)],
           conquistas={a: [conquista('A1'), conquista('A2')], b: [conquista('B1')]})
    _conectar(id_usuario)
    _job(id_usuario)

    sessao = fontes([jogo_steam(a, na, 900, HORA), jogo_steam(b, nb, 600, HORA)],
                    conquistas={a: [conquista('A1', obtida_em=QUANDO), conquista('A2')],
                                b: [conquista('B1', obtida_em=QUANDO)]})
    _agora(client, headers)

    assert _lidas(sessao, 'GetPlayerAchievements') == [a]
    assert _resumo(client, headers, ma) == {'obtidas': 1, 'total': 2}
    assert _resumo(client, headers, mb) == {'obtidas': 0, 'total': 1}


def test_orcamento_esgotado_nao_le_conquistas_e_atualiza_as_horas(client, usuario, fontes, jogos, monkeypatch):
    id_usuario, headers = usuario
    [(appid, id_midia, nome)] = jogos(1)
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: [conquista('A')]})
    _conectar(id_usuario)
    _job(id_usuario)
    sessao = fontes([jogo_steam(appid, nome, 900, HORA)], conquistas={appid: [conquista('A', obtida_em=QUANDO)]})
    monkeypatch.setattr(sincronizacao_steam, 'ORCAMENTO_SEGUNDOS', 0)

    corpo = _agora(client, headers)

    assert corpo['atualizados'] == 1
    assert _lidas(sessao, 'GetPlayerAchievements') == []
    assert _resumo(client, headers, id_midia) == {'obtidas': 0, 'total': 1}


def test_orcamento_e_conferido_antes_de_cada_chamada_das_conquistas(usuario, fontes, jogos, do_item):
    id_usuario, _ = usuario
    (a, ma, na), (b, mb, nb) = jogos(2)
    fontes([jogo_steam(a, na, 600, HORA), jogo_steam(b, nb, 600, HORA)],
           conquistas={a: [conquista('A')], b: [conquista('B')]})
    _conectar(id_usuario)
    _job(id_usuario)
    sessao = fontes([jogo_steam(a, na, 900, HORA), jogo_steam(b, nb, 900, HORA)],
                    conquistas={a: [conquista('A', obtida_em=QUANDO)], b: [conquista('B', obtida_em=QUANDO)]})
    tempo = iter(range(0, 1000, 10))  # cada leitura do relógio avança 10 s; o início é 0

    # Jogo a: conquistas (10) e raridade (20); jogo b: conquistas (30 ≥ 25) não sai.
    sincronizacao_steam.sincronizar(id_usuario, orcamento=25, relogio=lambda: next(tempo))

    assert _lidas(sessao, 'GetPlayerAchievements') == [a]
    assert do_item(id_usuario, ma)['A']['obtida'] is True
    assert do_item(id_usuario, mb)['B']['obtida'] is False


# ============================================
# Sem dado e falhas
# ============================================

def test_jogo_sem_stats_fica_sem_resumo_sem_falha_e_nao_e_lido_de_novo(client, usuario, fontes, jogos):
    id_usuario, headers = usuario
    [(appid, id_midia, nome)] = jogos(1)
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: SEM_STATS})
    _conectar(id_usuario)

    corpo = _job(id_usuario)
    sessao = fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: SEM_STATS})
    _job(id_usuario)

    assert corpo['atualizados'] + corpo['novos'] == 1
    assert _resumo(client, headers, id_midia) is None
    assert _lidas(sessao, 'GetPlayerAchievements') == []


@pytest.mark.parametrize('falha', [
    DETALHES_PRIVADOS,
    Resposta(500, {}),
    ConnectionError(f'caiu /ISteamUserStats/GetPlayerAchievements/v1/?key={CHAVE_STEAM}'),
    Resposta(200, {'playerstats': {'success': False, 'error': 'outra coisa'}}),
])
def test_sem_dado_ou_falha_mantem_o_anterior_e_atualiza_as_horas(client, usuario, fontes, jogos, falha, caplog):
    id_usuario, headers = usuario
    (a, ma, na), (b, mb, nb) = jogos(2)
    fontes([jogo_steam(a, na, 600, HORA), jogo_steam(b, nb, 600, HORA)],
           conquistas={a: [conquista('A', obtida_em=QUANDO), conquista('A2')], b: [conquista('B')]})
    _conectar(id_usuario)
    _job(id_usuario)

    fontes([jogo_steam(a, na, 900, HORA), jogo_steam(b, nb, 900, HORA)],
           conquistas={a: falha, b: [conquista('B', obtida_em=QUANDO)]})
    corpo = _job(id_usuario)

    assert corpo['atualizados'] == 2
    assert _resumo(client, headers, ma) == {'obtidas': 1, 'total': 2}
    assert _resumo(client, headers, mb) == {'obtidas': 1, 'total': 1}
    assert CHAVE_STEAM not in caplog.text


@pytest.mark.parametrize('metodo', ['GetSchemaForGame', 'GetGlobalAchievementPercentagesForApp'])
def test_falha_no_esquema_ou_na_raridade_mantem_o_anterior(client, usuario, fontes, jogos, metodo):
    id_usuario, headers = usuario
    [(appid, id_midia, nome)] = jogos(1)
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: [conquista('A')]},
           quebrar={metodo: Resposta(502, {})})
    _conectar(id_usuario)

    corpo = _job(id_usuario)

    assert corpo['novos'] + corpo['atualizados'] == 1
    assert _resumo(client, headers, id_midia) is None


def test_job_volta_a_ler_o_jogo_que_falhou(usuario, fontes, jogos, do_item):
    id_usuario, _ = usuario
    [(appid, id_midia, nome)] = jogos(1)
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: Resposta(500, {})})
    _conectar(id_usuario)
    _job(id_usuario)

    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: [conquista('A', obtida_em=QUANDO)]})
    _job(id_usuario)

    assert do_item(id_usuario, id_midia)['A']['obtida'] is True


# ============================================
# Esquema e raridade
# ============================================

def test_esquema_relido_so_quando_o_total_muda_e_raridade_a_cada_leitura(usuario, fontes, jogos, do_item):
    id_usuario, _ = usuario
    [(appid, id_midia, nome)] = jogos(1)
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: [conquista('A', raridade='50.0')]})
    _conectar(id_usuario)
    _job(id_usuario)

    mesma = fontes([jogo_steam(appid, nome, 900, HORA)],
                   conquistas={appid: [conquista('A', 'Nome novo', raridade='40.5')]})
    _job(id_usuario)
    depois_da_mesma = do_item(id_usuario, id_midia)

    maior = fontes([jogo_steam(appid, nome, 1200, HORA)],
                   conquistas={appid: [conquista('A', 'Nome novo', raridade='30.0'), conquista('B')]})
    _job(id_usuario)

    assert _lidas(mesma, 'GetSchemaForGame') == []
    assert (depois_da_mesma['A']['nome'], depois_da_mesma['A']['raridade']) == ('Conquista A', 40.5)
    assert _lidas(maior, 'GetSchemaForGame') == [appid]
    assert do_item(id_usuario, id_midia)['A']['nome'] == 'Nome novo'
    assert set(do_item(id_usuario, id_midia)) == {'A', 'B'}


def test_esquema_e_compartilhado_entre_usuarios_pela_appid(usuario, fontes, jogos, pg, do_item):
    from .test_repositorios_pg import _usuario

    id_usuario, _ = usuario
    [(appid, id_midia, nome)] = jogos(1)
    outro = _usuario(pg)
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: [conquista('A', obtida_em=QUANDO)]})
    _conectar(id_usuario)
    _job(id_usuario)

    sessao = fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: [conquista('A')]})
    _conectar(outro)
    _job(outro)

    assert _lidas(sessao, 'GetSchemaForGame') == []
    assert do_item(outro, id_midia)['A']['nome'] == 'Conquista A'
    assert do_item(outro, id_midia)['A']['obtida'] is False
    assert do_item(id_usuario, id_midia)['A']['obtida'] is True


def test_texto_longo_e_icone_fora_da_steam_sao_tratados(usuario, fontes, jogos, do_item):
    id_usuario, _ = usuario
    [(appid, id_midia, nome)] = jogos(1)
    sessao = fontes([jogo_steam(appid, nome, 600, HORA)],
                    conquistas={appid: [conquista('A', 'N' * 500, descricao='D' * 2000, raridade='abc')]})
    esquema = sessao.steam.rotas['GetSchemaForGame']

    def com_icone_estranho(p):
        corpo = esquema(p)
        [lida] = corpo['game']['availableGameStats']['achievements']
        lida['icon'] = 'http://evil.example/x.jpg'
        lida['icongray'] = 'https://cdn.fastly.steamstatic.com/x.jpg'  # da Steam, mas fora da CSP do web
        return corpo

    sessao.steam.rotas['GetSchemaForGame'] = com_icone_estranho
    _conectar(id_usuario)

    _job(id_usuario)

    lida = do_item(id_usuario, id_midia)['A']
    assert len(lida['nome']) <= 200 and len(lida['descricao']) <= 1000
    assert lida['icone'] is None and lida['raridade'] is None


# ============================================
# Conquista que some
# ============================================

def test_conquista_que_some_leva_junto_o_destaque(client, usuario, fontes, jogos):
    id_usuario, headers = usuario
    [(appid, id_midia, nome)] = jogos(1)
    fontes([jogo_steam(appid, nome, 600, HORA)],
           conquistas={appid: [conquista('A', obtida_em=QUANDO), conquista('B', obtida_em=QUANDO)]})
    _conectar(id_usuario)
    _job(id_usuario)
    id_lista = _id_lista(id_usuario, id_midia)
    banco.executar("INSERT INTO conquistas_destaques (id_lista, codigo) VALUES (%s, 'A'), (%s, 'B')",
                   (id_lista, id_lista))

    fontes([jogo_steam(appid, nome, 900, HORA)],
           conquistas={appid: [conquista('A', obtida_em=QUANDO), conquista('B')]})
    _job(id_usuario)

    destaques = banco.consultar('SELECT codigo FROM conquistas_destaques WHERE id_lista = %s', (id_lista,))
    assert [d['codigo'] for d in destaques] == ['A']
    assert _resumo(client, headers, id_midia) == {'obtidas': 1, 'total': 2}



def test_esquema_que_perde_uma_conquista_leva_as_obtidas_e_os_destaques_de_todos(client, usuario, fontes, jogos, pg,
                                                                                  make_token):
    from .test_repositorios_pg import _usuario

    id_usuario, headers = usuario
    [(appid, id_midia, nome)] = jogos(1)
    outro = _usuario(pg)
    do_outro = {'Authorization': f'Bearer {make_token(outro)}'}
    sete = [conquista(f'C{i}', obtida_em=QUANDO) for i in range(7)]
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: sete})
    _conectar(outro)
    _job(outro)
    for i in range(6):
        assert client.put(f'/api/usuario/conquistas/destaques/{appid}/C{i}', headers=do_outro).status_code == 200

    # A Steam tirou a C5 do jogo; quem lê agora é o outro Usuário, e o esquema muda para os dois.
    fontes([jogo_steam(appid, nome, 600, HORA)], conquistas={appid: sete[:5] + sete[6:]})
    _conectar(id_usuario)
    _job(id_usuario)

    perfil = client.get('/api/usuario/conquistas/destaques', headers=do_outro).get_json()
    assert [d['codigo'] for d in perfil['destaques']] == ['C0', 'C1', 'C2', 'C3', 'C4']
    assert perfil['total'] == {'conquistas': 6, 'jogos': 1}
    assert client.put(f'/api/usuario/conquistas/destaques/{appid}/C6', headers=do_outro).status_code == 200


# ============================================
# Erro inesperado num jogo
# ============================================

@pytest.fixture
def gravar_quebrado(monkeypatch):
    """`gravar_quebrado(appid)`: gravar as conquistas desse jogo dá um erro inesperado (do banco, por exemplo)."""
    def quebrar(alvo):
        original = conquistas.gravar_do_item

        def gravar(db, id_lista, appid, *args):
            if appid == alvo:
                raise RuntimeError('erro inesperado do banco')
            return original(db, id_lista, appid, *args)

        monkeypatch.setattr(conquistas, 'gravar_do_item', gravar)

    return quebrar


def test_erro_inesperado_num_jogo_no_job_vai_para_o_log_e_segue_para_o_proximo(client, usuario, fontes, jogos,
                                                                              gravar_quebrado, caplog):
    id_usuario, headers = usuario
    (a, ma, na), (b, mb, nb) = jogos(2)
    fontes([jogo_steam(a, na, 600, HORA), jogo_steam(b, nb, 600, HORA)],
           conquistas={a: [conquista('A', obtida_em=QUANDO)], b: [conquista('B', obtida_em=QUANDO)]})
    _conectar(id_usuario)
    gravar_quebrado(a)

    corpo = _job(id_usuario)

    assert corpo['novos'] + corpo['atualizados'] == 2
    assert _resumo(client, headers, ma) is None
    assert _resumo(client, headers, mb) == {'obtidas': 1, 'total': 1}
    assert 'erro inesperado do banco' in caplog.text
    [registro] = importacao_utils.ERROR_LOG_PATH.read_text(encoding='utf-8').splitlines()
    assert str(a) in registro and 'RuntimeError' in registro


def test_erro_inesperado_num_jogo_no_sincronizar_agora_nao_responde_500(client, usuario, fontes, jogos,
                                                                       gravar_quebrado):
    id_usuario, headers = usuario
    (a, ma, na), (b, mb, nb) = jogos(2)
    fontes([jogo_steam(a, na, 600, HORA), jogo_steam(b, nb, 600, HORA)],
           conquistas={a: [conquista('A')], b: [conquista('B')]})
    _conectar(id_usuario)
    _job(id_usuario)
    fontes([jogo_steam(a, na, 900, HORA), jogo_steam(b, nb, 900, HORA)],
           conquistas={a: [conquista('A', obtida_em=QUANDO)], b: [conquista('B', obtida_em=QUANDO)]})
    gravar_quebrado(a)

    corpo = _agora(client, headers)

    assert corpo['atualizados'] == 2
    assert _resumo(client, headers, ma) == {'obtidas': 0, 'total': 1}
    assert _resumo(client, headers, mb) == {'obtidas': 1, 'total': 1}
