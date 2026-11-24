"""Limites das Integrações dentro da requisição (função de 300 s) e o que vem da origem sem confiança.

Prazo total por requisição, timeouts e retries curtos, tetos de leitura (`lista_grande_demais`),
links só das plataformas esperadas, MAL sem seguir redirect, slug do RAWG escapado no path,
casamento ambíguo pelo `idMal`. Nada de rede nem de banco.
"""
import pytest

from integracoes import anilist as modulo_anilist
from integracoes import mal as modulo_mal
from integracoes import prazo
from integracoes.anilist import AniList
from integracoes.mal import MAL
from integracoes.plataforma import (
    MAXIMO_ITENS,
    Conta,
    ItemDeOrigem,
    ListaGrandeDemais,
    OrigemIndisponivel,
    link_seguro,
)
from integracoes.rawg import Rawg

from .fontes_falsas import CHAVE_RAWG, SessaoGet, resultado_rawg
from .test_integracoes_anilist import SessaoFalsa, _colecao, _entrada, _media
from .test_integracoes_mal import SessaoMal, _entrada_mal, _media_anilist, _page, _pagina


class Relogio:
    """Relógio manual: `avancar(s)`."""

    def __init__(self):
        self.agora = 1000.0

    def __call__(self):
        return self.agora

    def avancar(self, segundos):
        self.agora += segundos


@pytest.fixture
def relogio(monkeypatch):
    falso = Relogio()
    monkeypatch.setattr(prazo, 'relogio', falso)
    return falso


# ============================================
# Prazo da requisição
# ============================================

def test_fora_da_requisicao_nao_ha_prazo_e_valem_os_timeouts_longos():
    assert prazo.restante() is None
    prazo.conferir()
    assert prazo.timeout(30) == 30
    assert prazo.retries(2, 1.0) == (2, 1.0)


def test_dentro_da_requisicao_timeout_curto_e_prazo_vencido_levanta(relogio):
    with prazo.na_requisicao(240):
        assert prazo.timeout(30) == prazo.TIMEOUT_NA_REQUISICAO
        assert prazo.retries(2, 1.0) == (1, 0.5)
        relogio.avancar(235)
        assert prazo.timeout(30) == pytest.approx(5)
        relogio.avancar(5)
        with pytest.raises(prazo.TempoEsgotado) as erro:
            prazo.conferir()
    assert isinstance(erro.value, OrigemIndisponivel)
    assert 'demorou' in str(erro.value)
    assert prazo.restante() is None


def test_anilist_para_de_ler_quando_o_prazo_acaba(relogio):
    respostas = [_colecao((False, [_entrada(_media(i))]), proximo=True) for i in range(1, 4)]
    sessao = SessaoFalsa(*respostas)

    class Avanca(SessaoFalsa):
        def post(self, *a, **kw):
            relogio.avancar(100)
            return sessao.post(*a, **kw)

    with prazo.na_requisicao(240), pytest.raises(prazo.TempoEsgotado):
        AniList(sessao=Avanca()).ler(Conta('fulano'))
    assert len(sessao.enviados) == 3  # 0 s, 100 s, 200 s; a quarta (300 s) não sai
    assert all(t <= prazo.TIMEOUT_NA_REQUISICAO for t in sessao.timeouts)


def test_mal_usa_timeout_curto_na_requisicao_e_nao_segue_redirect(monkeypatch, relogio):
    monkeypatch.setenv('MAL_CLIENT_ID', 'x')
    sessao = SessaoMal(_pagina())

    with prazo.na_requisicao(240):
        MAL(sessao=sessao).conectar('fulano')

    assert sessao.pedidos[0]['allow_redirects'] is False
    assert sessao.pedidos[0]['timeout'] <= prazo.TIMEOUT_NA_REQUISICAO


def test_mal_redirect_e_origem_indisponivel(monkeypatch):
    from .test_integracoes_anilist import _Resposta

    monkeypatch.setenv('MAL_CLIENT_ID', 'x')
    with pytest.raises(OrigemIndisponivel):
        MAL(sessao=SessaoMal(_Resposta(302, {}))).conectar('fulano')


# ============================================
# Tetos de leitura
# ============================================

def test_anilist_com_chunks_demais_e_lista_grande_demais(monkeypatch):
    monkeypatch.setattr(modulo_anilist, 'MAXIMO_CHUNKS', 2)
    sessao = SessaoFalsa(*[_colecao((False, [_entrada(_media(i))]), proximo=True) for i in range(1, 4)])

    with pytest.raises(ListaGrandeDemais, match=str(MAXIMO_ITENS)):
        AniList(sessao=sessao).ler(Conta('fulano'))
    assert len(sessao.enviados) == 2


def test_anilist_com_itens_demais_e_lista_grande_demais(monkeypatch):
    monkeypatch.setattr(modulo_anilist, 'MAXIMO_ITENS', 2)
    sessao = SessaoFalsa(_colecao((False, [_entrada(_media(i)) for i in range(1, 4)])))

    with pytest.raises(ListaGrandeDemais):
        AniList(sessao=sessao).ler(Conta('fulano'))


def test_mal_com_paginas_demais_e_lista_grande_demais(monkeypatch):
    monkeypatch.setenv('MAL_CLIENT_ID', 'x')
    monkeypatch.setattr(modulo_mal, 'MAXIMO_PAGINAS', 2)
    proxima = 'https://api.myanimelist.net/v2/users/fulano/animelist?offset=1'
    sessao = SessaoMal(*[_pagina(_entrada_mal(i), proxima=proxima) for i in range(1, 4)])

    with pytest.raises(ListaGrandeDemais):
        MAL(sessao=sessao, sessao_anilist=SessaoFalsa()).ler(Conta('fulano'))
    assert len(sessao.pedidos) == 2


def test_xml_com_itens_demais_e_lista_grande_demais_sem_chamar_o_anilist(monkeypatch):
    monkeypatch.setattr(modulo_mal, 'MAXIMO_ITENS', 2)
    xml = b'<myanimelist>' + b''.join(
        f'<anime><series_animedb_id>{i}</series_animedb_id><my_status>Watching</my_status></anime>'.encode()
        for i in range(1, 4)
    ) + b'</myanimelist>'
    anilist = SessaoFalsa()

    with pytest.raises(ListaGrandeDemais):
        MAL(sessao_anilist=anilist).itens_do_xml(xml)
    assert anilist.enviados == []


# ============================================
# Casamento ambíguo pelo idMal (Q109)
# ============================================

def test_idmal_que_casa_com_mais_de_uma_obra_vai_para_nao_encontrados():
    anilist = SessaoFalsa(_page(_media_anilist(1, 501), _media_anilist(1, 502), _media_anilist(2, 600)))
    itens = [modulo_mal._item(i, 'anime', f'T{i}', 'watching', 1, 0) for i in (1, 2)]

    ambiguo, unico = modulo_mal.casar(itens, anilist)

    assert ambiguo.catalogo is None
    assert unico.catalogo.id_fonte == '600'


# ============================================
# Links e paths vindos da origem
# ============================================

@pytest.mark.parametrize(('link', 'esperado'), [
    ('https://anilist.co/anime/1', 'https://anilist.co/anime/1'),
    ('https://myanimelist.net/manga/3', 'https://myanimelist.net/manga/3'),
    ('https://store.steampowered.com/app/10', 'https://store.steampowered.com/app/10'),
    ('https://rawg.io/games/portal', 'https://rawg.io/games/portal'),
    ('https://www.myanimelist.net/anime/1', 'https://www.myanimelist.net/anime/1'),
    ('http://anilist.co/anime/1', None),
    ('javascript:alert(1)', None),
    ('https://anilist.co.evil.test/x', None),
    ('https://evil.test/anilist.co', None),
    ('https://user@evil.test/', None),
    ('https://anilist.co@evil.test/', None),
    ('//anilist.co/x', None),
    ('', None),
    (None, None),
])
def test_link_so_https_das_plataformas_esperadas(link, esperado):
    assert link_seguro(link) == esperado


def test_item_de_origem_com_link_estranho_fica_sem_link():
    assert ItemDeOrigem('1', 'anime', 'X', 'javascript:alert(1)').link is None
    assert ItemDeOrigem('1', 'anime', 'X', 'https://anilist.co/anime/1').link == 'https://anilist.co/anime/1'


def test_slug_do_rawg_vai_escapado_no_path():
    slug = '../../users?x=1#'
    sessao = SessaoGet({
        r'/games$': {'results': [resultado_rawg(slug, 'Jogo')]},
        r'/games/[^/]+/stores$': {'results': []},
    })

    Rawg(sessao=sessao, chave=CHAVE_RAWG).casar(1, 'Jogo')

    url = sessao.caminhos()[1]
    assert url.endswith('/games/..%2F..%2Fusers%3Fx%3D1%23/stores')
