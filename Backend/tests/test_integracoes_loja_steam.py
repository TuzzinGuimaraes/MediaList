"""Loja da Steam (`appdetails`) com sessão falsa, e o jogo da loja no formato da Importação. Nada de rede."""
from datetime import date

import pytest

from importacao.importar_jogos import appid_da_steam, dados_do_jogo_steam
from integracoes import prazo
from integracoes.loja_steam import LojaSteam
from integracoes.plataforma import OrigemIndisponivel

from .fontes_falsas import Resposta, SessaoGet, appdetails


def _loja(rotas, **kw):
    sessao = SessaoGet(rotas)
    return LojaSteam(sessao=sessao, **kw), sessao


def test_jogo_traz_os_dados_da_loja_em_portugues():
    loja, sessao = _loja({r'/api/appdetails': appdetails(400, 'Portal')})

    dados = loja.detalhes(400)

    assert dados['type'] == 'game' and dados['name'] == 'Portal'
    url, params = sessao.chamadas[0]
    assert url == 'https://store.steampowered.com/api/appdetails'
    assert params == {'appids': 400, 'l': 'portuguese'}


@pytest.mark.parametrize('tipo', ['dlc', 'music', 'application', 'demo'])
def test_outros_tipos_tambem_voltam_e_quem_decide_e_a_sincronizacao(tipo):
    loja, _ = _loja({r'appdetails': appdetails(400, 'Trilha', tipo=tipo)})

    assert loja.detalhes(400)['type'] == tipo


@pytest.mark.parametrize('corpo', [{'400': {'success': False}}, {}, None, []])
def test_success_false_ou_corpo_vazio_e_none(corpo):
    loja, _ = _loja({r'appdetails': corpo})

    assert loja.detalhes(400) is None


@pytest.mark.parametrize('falha', [Resposta(429, {}), Resposta(500, {}), ConnectionError('caiu'),
                                   Resposta(200, ValueError('não é JSON'))])
def test_loja_fora_do_ar_ou_limite_e_origem_indisponivel(falha):
    loja, _ = _loja({r'appdetails': falha})

    with pytest.raises(OrigemIndisponivel):
        loja.detalhes(400)


def test_antes_de_chamar_roda_antes_de_cada_get_e_pode_barrar():
    class Barrado(OrigemIndisponivel):
        pass

    def barrar():
        raise Barrado('orçamento')

    loja, sessao = _loja({r'appdetails': appdetails(400, 'Portal')}, antes_de_chamar=barrar)

    with pytest.raises(Barrado):
        loja.detalhes(400)
    assert sessao.chamadas == []


def test_prazo_da_requisicao_vale_para_a_loja(monkeypatch):
    agora = [0.0]
    monkeypatch.setattr(prazo, 'relogio', lambda: agora[0])
    loja, sessao = _loja({r'appdetails': appdetails(400, 'Portal')})

    with prazo.na_requisicao(5):
        loja.detalhes(400)
        agora[0] = 6
        with pytest.raises(prazo.TempoEsgotado):
            loja.detalhes(400)
    assert len(sessao.chamadas) == 1 and sessao.timeouts[0] <= 5


# ============================================
# O jogo da loja no formato da Importação
# ============================================

def test_dados_do_jogo_da_loja():
    dados, generos = dados_do_jogo_steam(appdetails(
        400, 'Portal', data='21 ago. 2012', desenvolvedoras=['Valve', 'Hidden Path'], publicadoras=['Valve'],
        generos=[('1', 'Ação'), ('25', 'Aventura'), ('37', 'Grátis para Jogar'), ('23', 'Indie')],
        plataformas={'windows': True, 'mac': True, 'linux': False}, categorias=[2, 1],
        descricao='Um &quot;jogo&quot; de <b>portais</b>.',
    )['400']['data'])

    assert dados == {
        'titulo_original': 'Portal', 'titulo_portugues': 'Portal', 'sinopse': 'Um "jogo" de portais.',
        'data_lancamento': date(2012, 8, 21), 'nota_fonte': None,
        'poster_url': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/400/header.jpg',
        'banner_url': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/400/header.jpg',
        'desenvolvedor': 'Valve', 'publicadora': 'Valve', 'plataformas': ['PC', 'macOS'],
        'status_jogo': 'lancado', 'modo_jogo': 'ambos', 'classificacao': None,
        'rawg_slug': None, 'steam_appid': 400, 'trailer_url': None,
    }
    # Pelo id do gênero da Steam, com os nomes que a Importação do RAWG grava; "Grátis para Jogar" não é gênero.
    assert generos == ['Ação', 'Aventura', 'Indie']


@pytest.mark.parametrize(('texto', 'esperada'), [
    ('21 ago. 2012', date(2012, 8, 21)),
    ('3 fev. 2020', date(2020, 2, 3)),
    ('21 Aug, 2012', date(2012, 8, 21)),
    ('Aug 21, 2012', date(2012, 8, 21)),
    ('ago. 2012', None),
    ('2025', None),
    ('Em breve', None),
    ('', None),
    ('31 fev. 2020', None),
])
def test_data_da_loja_so_entra_completa(texto, esperada):
    dados, _ = dados_do_jogo_steam(appdetails(400, 'Portal', data=texto)['400']['data'])

    assert dados['data_lancamento'] == esperada


def test_em_breve_e_em_desenvolvimento_e_so_multijogador_e_multi():
    dados, _ = dados_do_jogo_steam(appdetails(400, 'Portal', em_breve=True, categorias=[1, 36])['400']['data'])

    assert dados['status_jogo'] == 'em_desenvolvimento'
    assert dados['modo_jogo'] == 'multi'


def test_jogo_da_loja_sem_campos_opcionais():
    dados, generos = dados_do_jogo_steam({'type': 'game', 'name': 'Mínimo', 'steam_appid': 7})

    assert dados['titulo_original'] == 'Mínimo' and dados['steam_appid'] == 7
    assert (dados['poster_url'], dados['desenvolvedor'], dados['data_lancamento']) == (None, None, None)
    assert dados['plataformas'] == [] and dados['modo_jogo'] == 'single' and generos == []


@pytest.mark.parametrize(('lojas', 'esperada'), [
    ([{'url': 'https://store.steampowered.com/app/400/Portal/'}], 400),
    ([{'url': ''}, {'url': 'https://www.xbox.com/x'}, {'url': 'http://store.steampowered.com/app/10'}], 10),
    ([{'url': ''}], None),
    (None, None),
])
def test_appid_da_steam_nas_lojas_do_rawg(lojas, esperada):
    assert appid_da_steam({'stores': lojas}) == esperada


# ============================================
# Dados da loja validados (revisão)
# ============================================

def test_steam_appid_diferente_do_pedido_fica_o_pedido():
    resposta = appdetails(400, 'Portal')
    resposta['400']['data']['steam_appid'] = 999
    loja, _ = _loja({r'appdetails': resposta})

    assert loja.detalhes(400)['steam_appid'] == 400


@pytest.mark.parametrize('url', [
    'http://shared.akamai.steamstatic.com/x/header.jpg',
    'https://evil.example.com/header.jpg',
    'https://steamstatic.com.evil.example/header.jpg',
    'javascript:alert(1)',
    'https://user@evil.example/?.steamstatic.com',
    42,
    ['https://cdn.akamai.steamstatic.com/x.jpg'],
])
def test_capa_fora_dos_hosts_da_steam_fica_nula(url):
    dados, _ = dados_do_jogo_steam({**appdetails(400, 'Portal')['400']['data'], 'header_image': url})

    assert (dados['poster_url'], dados['banner_url']) == (None, None)


@pytest.mark.parametrize('url', [
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/400/header.jpg',
    'https://cdn.cloudflare.steamstatic.com/steam/apps/400/header.jpg',
    'https://steamcdn-a.akamaihd.net/steam/apps/400/header.jpg',
])
def test_capa_dos_hosts_da_steam_entra(url):
    dados, _ = dados_do_jogo_steam({**appdetails(400, 'Portal')['400']['data'], 'header_image': url})

    assert (dados['poster_url'], dados['banner_url']) == (url, url)


def test_capa_vertical_confirmada_vira_o_poster_e_a_horizontal_o_banner():
    data = appdetails(400, 'Portal')['400']['data']
    vertical = 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/400/library_600x900.jpg'

    dados, _ = dados_do_jogo_steam({**data, 'capa_vertical': vertical})

    assert (dados['poster_url'], dados['banner_url']) == (vertical, data['header_image'])


def test_textos_da_loja_com_strip_teto_e_so_str():
    data = {**appdetails(400, 'Portal')['400']['data'], 'name': '  Portal  ',
            'developers': ['  ' + 'V' * 400], 'publishers': [{'nome': 'Valve'}]}

    dados, _ = dados_do_jogo_steam(data)

    assert dados['titulo_original'] == dados['titulo_portugues'] == 'Portal'
    assert dados['desenvolvedor'] == 'V' * 300
    assert dados['publicadora'] is None


def test_nome_que_nao_e_texto_fica_nulo():
    dados, _ = dados_do_jogo_steam({'type': 'game', 'name': ['x'], 'steam_appid': 7})

    assert dados['titulo_original'] is None


def test_capa_vertical_so_com_head_200():
    loja, sessao = _loja({})
    sessao.cabecas = {r'/400/library_600x900\.jpg$': 200, r'/401/': 404}

    assert loja.capa_vertical(400) == (
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/400/library_600x900.jpg')
    assert loja.capa_vertical(401) is None
    assert sessao.chamadas == [] and len(sessao.heads) == 2
    assert all(t <= 3 for t in sessao.timeouts_head)


@pytest.mark.parametrize('falha', [ConnectionError('caiu'), TimeoutError('lento')])
def test_capa_vertical_que_falha_e_none(falha):
    loja, sessao = _loja({})
    sessao.cabecas = {r'library': falha}

    assert loja.capa_vertical(400) is None


def test_capa_vertical_sem_orcamento_nao_chama_e_e_none():
    def barrar():
        raise OrigemIndisponivel('orçamento')

    loja, sessao = _loja({}, antes_de_chamar=barrar)

    assert loja.capa_vertical(400) is None
    assert sessao.heads == []
