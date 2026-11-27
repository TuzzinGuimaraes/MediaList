"""Mesma série nos jogos, do RAWG até `GET /api/midias/<id>/relacoes` (spec `relacoes`, ticket 02).

A Importação de jogos, a Sincronização da Steam e a passada lenta rodam contra um RAWG falso
(sessão HTTP em memória, nada de rede) e o PostgreSQL real (TEST_DATABASE_URL); sem ela, pula.
O detalhe traz o `game_series_count`; `game-series` só é chamado com contagem maior que zero
e diferente da gravada.
"""
import re
import uuid

import pytest

import banco
from importacao import importar_jogos, serie_jogos
from integracoes import repositorio
from integracoes.plataforma import Conta

from .fontes_falsas import STEAMID, appdetails, jogo_steam, resultado_rawg
from .helpers import criar_usuario
from .test_importacao_jogos_pg import TEST_DATABASE_URL, _Resposta, _SemEspera
from .test_integracoes_steam_pg import loja_com

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a série dos jogos'
)

CAPA = 'https://media.rawg.io/media/games/x.jpg'


class _Rawg:
    """`/games` (uma página), `/games/<slug>`, `/games/<slug>/game-series` e `/games/<slug>/stores`.

    `contagens`: slug → `game_series_count` do detalhe (None: o detalhe não a traz); `series`:
    slug → jogos da série (em páginas de 40; com `sem_fim`, toda página diz que há a seguinte);
    `serie_falha`: slugs cujo `game-series` responde 502. Slug desconhecido: 404.
    """

    def __init__(self, jogos=(), contagens=None, series=None, sem_fim=False, lojas=None, serie_falha=()):
        self.jogos = {j['slug']: j for j in jogos}
        self.contagens = contagens or {}
        self.series = series or {}
        self.sem_fim = sem_fim
        self.lojas = lojas or {}
        self.serie_falha = set(serie_falha)
        self.chamadas = []

    def get(self, url, params=None, timeout=None):
        caminho = url.rsplit('/api', 1)[-1]
        params = dict(params or {})
        self.chamadas.append((caminho, params))
        if caminho == '/games':
            return _Resposta(200, {'results': list(self.jogos.values()), 'next': None})
        serie = re.fullmatch(r'/games/([^/]+)/game-series', caminho)
        if serie and serie.group(1) in self.serie_falha:
            return _Resposta(502)
        if serie:
            jogos, pagina = self.series.get(serie.group(1), []), params['page']
            assert params['page_size'] == 40
            fatia = jogos[(pagina - 1) * 40:pagina * 40]
            proxima = self.sem_fim or pagina * 40 < len(jogos)
            return _Resposta(200, {'count': len(jogos), 'results': fatia, 'next': 'x' if proxima else None})
        lojas = re.fullmatch(r'/games/([^/]+)/stores', caminho)
        if lojas:
            return _Resposta(200, {'results': [
                {'url': f'https://store.steampowered.com/app/{a}/'} for a in self.lojas.get(lojas.group(1), [])]})
        detalhe = re.fullmatch(r'/games/([^/]+)', caminho)
        slug = detalhe and detalhe.group(1)
        if slug not in self.jogos:
            return _Resposta(404, {'detail': 'Not found.'})
        detalhe = {**self.jogos[slug], 'description_raw': 'Um jogo.', 'tags': [],
                   'game_series_count': self.contagens.get(slug, 0)}
        if detalhe['game_series_count'] is None:
            del detalhe['game_series_count']
        return _Resposta(200, detalhe)

    def close(self):
        pass

    def series_pedidas(self):
        return [(c.split('/')[2], p['page']) for c, p in self.chamadas if c.endswith('/game-series')]

    def detalhes_pedidos(self):
        return [c.split('/')[2] for c, _ in self.chamadas if re.fullmatch(r'/games/[^/]+', c)]


@pytest.fixture
def slugs(pg):
    """Slugs únicos do teste; as Mídias deles são apagadas no fim."""
    usados = []

    def novo(nome='Jogo'):
        slug = f'serie-{uuid.uuid4().hex[:12]}'
        usados.append(slug)
        return slug

    yield novo
    banco.executar('DELETE FROM midias WHERE id_midia IN (SELECT id_midia FROM jogos WHERE rawg_slug = ANY(%s))',
                   (usados,))


@pytest.fixture
def rawg(pg, monkeypatch):
    """Instala o RAWG falso na Importação e na passada lenta; zera o cursor dos jogos."""
    banco.executar("DELETE FROM importacao_cursor WHERE tipo_midia = 'jogo'")

    def instalar(fonte):
        monkeypatch.setattr(importar_jogos, 'RAWG_API_KEY', 'chave-de-teste')
        monkeypatch.setattr(importar_jogos, 'criar_sessao_http', lambda **kw: fonte)
        monkeypatch.setattr(importar_jogos, 'RateLimiter', _SemEspera)
        monkeypatch.setattr(importar_jogos, '_obter_sessao_rawg_worker', lambda: fonte)
        return fonte

    yield instalar
    banco.executar("DELETE FROM importacao_cursor WHERE tipo_midia = 'jogo'")


def _jogo(slug, nome=None, released='2011-04-19'):
    return {
        'slug': slug, 'name': nome or f'Jogo {slug}', 'released': released, 'rating': 4.0,
        'background_image': CAPA, 'platforms': [{'platform': {'name': 'PC'}}], 'genres': [{'name': 'Action'}],
    }


def _da_serie(slug, nome=None, released='2005-01-01', capa=CAPA, esrb=None):
    return {'slug': slug, 'name': nome or f'Série {slug}', 'released': released, 'background_image': capa,
            'esrb_rating': {'slug': esrb} if esrb else None}


def _id(slug):
    linha = banco.consultar_um('SELECT id_midia FROM jogos WHERE rawg_slug = %s', (slug,))
    return linha and linha['id_midia']


def _contagem(slug):
    return banco.consultar_um('SELECT game_series_count FROM jogos WHERE rawg_slug = %s', (slug,))['game_series_count']


def _relacoes(client, id_midia):
    resposta = client.get(f'/api/midias/{id_midia}/relacoes')
    assert resposta.status_code == 200, resposta.get_json()
    return resposta.get_json()['relacoes']


def _importar(paginas=1):
    return importar_jogos.importar_jogos(paginas=paginas, workers=1)


# ============================================
# Importação de jogos
# ============================================

def test_jogo_novo_com_serie_grava_mesma_serie_e_a_rota_a_devolve(client, rawg, slugs):
    a, b, fora = slugs(), slugs(), slugs()
    fonte = rawg(_Rawg([_jogo(a), _jogo(b)], contagens={a: 2, b: 0},
                       series={a: [_da_serie(b), _da_serie(fora, 'Fora do Catálogo', released='2003-05-06')]}))

    stats = _importar()

    assert stats.sucessos == 2 and not stats.paginas_com_falha
    assert fonte.series_pedidas() == [(a, 1)]
    assert (_contagem(a), _contagem(b)) == (2, 0)
    relacoes = _relacoes(client, _id(a))
    assert {r['relacao'] for r in relacoes} == {'MESMA_SERIE'}
    por_titulo = {r['titulo']: r for r in relacoes}
    assert por_titulo[f'Jogo {b}']['id_midia'] == _id(b)
    assert por_titulo['Fora do Catálogo'] == {
        'relacao': 'MESMA_SERIE', 'tipo': 'jogo', 'titulo': 'Fora do Catálogo', 'poster_url': CAPA,
        'data_lancamento': '2003-05-06', 'id_midia': None, 'link_fonte': f'https://rawg.io/games/{fora}',
        'status_consumo': None,
    }
    # Simétrica: B, que não tem série gravada, mostra A pela Relação de A.
    assert [(r['relacao'], r['id_midia']) for r in _relacoes(client, _id(b))] == [('MESMA_SERIE', _id(a))]


def test_contagem_igual_nao_chama_e_contagem_nova_chama_e_troca(client, rawg, slugs):
    a, b, c = slugs(), slugs(), slugs()
    rawg(_Rawg([_jogo(a)], contagens={a: 1}, series={a: [_da_serie(b)]}))
    _importar()

    igual = rawg(_Rawg([_jogo(a)], contagens={a: 1}, series={a: [_da_serie(c)]}))
    _importar()
    assert igual.series_pedidas() == []
    assert [r['titulo'] for r in _relacoes(client, _id(a))] == [f'Série {b}']

    nova = rawg(_Rawg([_jogo(a)], contagens={a: 2}, series={a: [_da_serie(b), _da_serie(c)]}))
    _importar()
    assert nova.series_pedidas() == [(a, 1)]
    assert {r['titulo'] for r in _relacoes(client, _id(a))} == {f'Série {b}', f'Série {c}'}


def test_contagem_zero_nao_chama_e_limpa_a_serie_que_havia(client, rawg, slugs):
    a, b = slugs(), slugs()
    rawg(_Rawg([_jogo(a)], contagens={a: 1}, series={a: [_da_serie(b)]}))
    _importar()

    zero = rawg(_Rawg([_jogo(a)], contagens={a: 0}))
    _importar()

    assert zero.series_pedidas() == []
    assert _contagem(a) == 0
    assert _relacoes(client, _id(a)) == []


def test_serie_le_no_maximo_2_paginas_80_jogos(client, rawg, slugs):
    a = slugs()
    serie = [_da_serie(f'{a}-s{i:03}', released=f'{1990 + i % 30}-01-01') for i in range(120)]
    fonte = rawg(_Rawg([_jogo(a)], contagens={a: 120}, series={a: serie}, sem_fim=True))

    _importar()

    assert fonte.series_pedidas() == [(a, 1), (a, 2)]
    assert len(_relacoes(client, _id(a))) == 80


def test_serie_sem_o_proprio_jogo_sem_adulto_e_sem_slug_invalido(client, rawg, slugs):
    a, b, adulto = slugs(), slugs(), slugs()
    rawg(_Rawg([_jogo(a)], contagens={a: 4}, series={a: [
        _da_serie(a), _da_serie(b, capa='https://outro.host/x.jpg'), _da_serie(adulto, esrb='adults-only'),
        _da_serie('../../fora', 'Inválido'),
    ]}))

    _importar()

    relacoes = _relacoes(client, _id(a))
    assert [(r['titulo'], r['poster_url']) for r in relacoes] == [(f'Série {b}', None)]


def test_detalhe_sem_contagem_nao_apaga_a_gravada(client, rawg, slugs):
    a, b = slugs(), slugs()
    rawg(_Rawg([_jogo(a)], contagens={a: 1}, series={a: [_da_serie(b)]}))
    _importar()

    sem = rawg(_Rawg([_jogo(a)], contagens={a: None}))
    _importar()

    assert sem.series_pedidas() == []
    assert _contagem(a) == 1
    assert [r['titulo'] for r in _relacoes(client, _id(a))] == [f'Série {b}']


def test_falha_na_serie_nao_e_falha_do_jogo_e_a_contagem_fica_como_estava(client, rawg, slugs):
    antigo, novo, b, c = slugs(), slugs(), slugs(), slugs()
    rawg(_Rawg([_jogo(antigo)], contagens={antigo: 1}, series={antigo: [_da_serie(b)]}))
    _importar()

    rawg(_Rawg([_jogo(antigo), _jogo(novo)], contagens={antigo: 2, novo: 3},
               series={antigo: [_da_serie(b), _da_serie(c)]}, serie_falha={antigo, novo}))
    stats = _importar()

    assert (stats.sucessos, stats.falhas) == (2, 0)
    assert (_contagem(antigo), _contagem(novo)) == (1, None)
    assert [r['titulo'] for r in _relacoes(client, _id(antigo))] == [f'Série {b}']
    assert _relacoes(client, _id(novo)) == []

    # A próxima importação tenta de novo.
    de_novo = rawg(_Rawg([_jogo(antigo)], contagens={antigo: 2}, series={antigo: [_da_serie(b), _da_serie(c)]}))
    _importar()
    assert de_novo.series_pedidas() == [(antigo, 1)]
    assert _contagem(antigo) == 2


def _relacoes_que_o_banco_recusa(monkeypatch):
    """`da_serie` devolve uma Relação que fere a CHECK do código: a gravação das Relações falha."""
    from importacao import relacoes

    original = relacoes.da_serie
    monkeypatch.setattr(relacoes, 'da_serie',
                        lambda *a, **kw: [{**r, 'relacao': 'invalida'} for r in original(*a, **kw)])


def test_falha_ao_gravar_a_serie_nao_e_falha_do_jogo_e_a_contagem_nao_muda(client, rawg, slugs, monkeypatch):
    a, b = slugs(), slugs()
    rawg(_Rawg([_jogo(a)], contagens={a: 1}, series={a: [_da_serie(b)]}))
    _relacoes_que_o_banco_recusa(monkeypatch)

    stats = _importar()

    assert (stats.sucessos, stats.falhas) == (1, 0)
    assert _id(a) is not None and _contagem(a) is None


# ============================================
# Sincronização da Steam (importação sob demanda pelo RAWG)
# ============================================

def test_jogo_que_a_steam_traz_pelo_rawg_ganha_a_serie(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    appid, slug, nome = jogo('Com série')
    _, irmao, _ = jogo('Irmão')
    detalhe = {**_jogo(slug, nome), 'description_raw': 'Um jogo.', 'tags': [], 'game_series_count': 1}
    sessao = fontes([jogo_steam(appid, nome, 120, 1_000_000_000)], {
        r'/games$': {'results': [resultado_rawg(slug, nome)]},
        rf'/games/{slug}/stores$': {'results': [{'url': f'https://store.steampowered.com/app/{appid}/'}]},
        rf'/games/{slug}/game-series$': {'results': [_da_serie(irmao, 'Irmão')], 'next': None},
        rf'/games/{slug}$': detalhe,
    })
    repositorio.gravar_conta(id_usuario, 'steam', _conta())

    resposta = client.post('/api/integracoes/steam/sincronizar', headers=headers)

    assert resposta.status_code == 200, resposta.get_json()
    assert [c for c in sessao.caminhos() if c.endswith('/game-series')]
    assert _contagem(slug) == 1
    assert [(r['relacao'], r['titulo']) for r in _relacoes(client, _id(slug))] == [('MESMA_SERIE', 'Irmão')]


def test_falha_na_serie_do_jogo_que_a_steam_traz_pelo_rawg_nao_impede_a_importacao(client, usuario, fontes, jogo):
    from .fontes_falsas import Resposta

    id_usuario, headers = usuario
    appid, slug, nome = jogo('Série fora do ar')
    detalhe = {**_jogo(slug, nome), 'description_raw': 'Um jogo.', 'tags': [], 'game_series_count': 1}
    fontes([jogo_steam(appid, nome, 120, 1_000_000_000)], {
        r'/games$': {'results': [resultado_rawg(slug, nome)]},
        rf'/games/{slug}/stores$': {'results': [{'url': f'https://store.steampowered.com/app/{appid}/'}]},
        rf'/games/{slug}/game-series$': Resposta(502, {}),
        rf'/games/{slug}$': detalhe,
    })
    repositorio.gravar_conta(id_usuario, 'steam', _conta())

    resposta = client.post('/api/integracoes/steam/sincronizar', headers=headers)

    assert resposta.status_code == 200, resposta.get_json()
    assert _id(slug) is not None and _contagem(slug) is None
    assert _relacoes(client, _id(slug)) == []


def test_falha_ao_gravar_a_serie_do_jogo_que_a_steam_traz_nao_impede_a_importacao(
        client, usuario, fontes, jogo, monkeypatch):
    id_usuario, headers = usuario
    appid, slug, nome = jogo('Série recusada')
    _, irmao, _ = jogo('Irmão')
    detalhe = {**_jogo(slug, nome), 'description_raw': 'Um jogo.', 'tags': [], 'game_series_count': 1}
    fontes([jogo_steam(appid, nome, 120, 1_000_000_000)], {
        r'/games$': {'results': [resultado_rawg(slug, nome)]},
        rf'/games/{slug}/stores$': {'results': [{'url': f'https://store.steampowered.com/app/{appid}/'}]},
        rf'/games/{slug}/game-series$': {'results': [_da_serie(irmao, 'Irmão')], 'next': None},
        rf'/games/{slug}$': detalhe,
    })
    repositorio.gravar_conta(id_usuario, 'steam', _conta())
    _relacoes_que_o_banco_recusa(monkeypatch)

    assert client.post('/api/integracoes/steam/sincronizar', headers=headers).status_code == 200

    assert _id(slug) is not None and _contagem(slug) is None


def test_jogo_que_entra_so_pela_loja_da_steam_fica_sem_relacoes(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    appid, _, nome = jogo('Só na loja')
    sessao = fontes([jogo_steam(appid, nome, 120, 1_000_000_000)], {r'/games$': {'results': []}},
                    loja=loja_com(appdetails(appid, nome)))
    repositorio.gravar_conta(id_usuario, 'steam', _conta())

    assert client.post('/api/integracoes/steam/sincronizar', headers=headers).status_code == 200

    midia = banco.consultar_um('SELECT id_midia, game_series_count FROM jogos WHERE steam_appid = %s', (appid,))
    assert midia['game_series_count'] is None
    assert not [c for c in sessao.caminhos() if 'game-series' in c]
    assert _relacoes(client, midia['id_midia']) == []


def _conta():
    return Conta(STEAMID, 'Fulano')


# ============================================
# Passada lenta
# ============================================

def _antigo(slug, usuarios=(), contagem=None, nota=None):
    """Um jogo do Catálogo de antes da feature (sem contagem lida), com `usuarios` na Lista."""
    id_midia = importar_jogos.processar_e_inserir_jogo(_jogo(slug), {'tags': []})['id_midia']
    banco.executar('UPDATE jogos SET game_series_count = %s WHERE id_midia = %s', (contagem, id_midia))
    banco.executar('UPDATE midias SET nota_fonte = %s WHERE id_midia = %s', (nota, id_midia))
    for id_usuario in usuarios:
        banco.executar("INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo) VALUES (%s, %s, 'zerado')",
                       (id_usuario, id_midia))
    return id_midia


def test_passada_vai_dos_mais_populares_aos_menos_e_termina_sem_candidatos(client, pg, rawg, slugs):
    pessoas = [criar_usuario(pg) for _ in range(4)]
    a, b, c, ja_lido, fora, irmao = slugs(), slugs(), slugs(), slugs(), slugs(), slugs()
    _antigo(a, pessoas[:3])
    _antigo(b, pessoas[:2], nota=9)
    _antigo(ja_lido, pessoas, contagem=0)
    _antigo(c, pessoas[:1], nota=5)
    _antigo(fora, pessoas[:1], nota=1)
    jogos = [_jogo(s) for s in (a, b, c, ja_lido)]

    primeira = rawg(_Rawg(jogos, contagens={a: 1, b: 0, c: 0}, series={a: [_da_serie(irmao, 'Irmão')]}))
    stats = serie_jogos.passada(limite=2)

    assert primeira.detalhes_pedidos() == [a, b]
    assert primeira.series_pedidas() == [(a, 1)]
    assert (_contagem(a), _contagem(b), _contagem(c)) == (1, 0, None)
    assert [r['titulo'] for r in _relacoes(client, _id(a))] == ['Irmão']
    assert stats.sucessos == 2

    # A segunda vai até o fim: C e os outros jogos sem contagem do banco. O que o RAWG não tem
    # mais (404) fica com 0 e não volta.
    segunda = rawg(_Rawg(jogos, contagens={c: 0}))
    serie_jogos.passada(limite=100_000)
    assert segunda.detalhes_pedidos()[0] == c
    assert ja_lido not in segunda.detalhes_pedidos() and a not in segunda.detalhes_pedidos()
    assert (_contagem(c), _contagem(fora)) == (0, 0)

    terceira = rawg(_Rawg(jogos))
    stats = serie_jogos.passada(limite=2)
    assert terceira.chamadas == []
    assert stats.pulado


def test_jogo_que_sobe_na_popularidade_depois_ainda_e_visitado(client, pg, rawg, slugs):
    pessoas = [criar_usuario(pg) for _ in range(5)]
    a, b = slugs(), slugs()
    _antigo(a, pessoas[:4])
    id_b = _antigo(b, pessoas[:3])
    rawg(_Rawg([_jogo(a), _jogo(b)]))
    serie_jogos.passada(limite=1)
    assert (_contagem(a), _contagem(b)) == (0, None)

    banco.executar("INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo) VALUES (%s, %s, 'zerado')",
                   (pessoas[4], id_b))
    segunda = rawg(_Rawg([_jogo(a), _jogo(b)]))
    serie_jogos.passada(limite=1)

    assert segunda.detalhes_pedidos() == [b]
    assert _contagem(b) == 0


def test_passada_com_falha_no_detalhe_nao_grava_e_tenta_de_novo(client, pg, rawg, slugs):
    pessoas = [criar_usuario(pg) for _ in range(6)]
    a = slugs()
    _antigo(a, pessoas)
    fonte = _Rawg([_jogo(a)])
    fonte.get = lambda url, params=None, timeout=None: _Resposta(502)
    rawg(fonte)

    stats = serie_jogos.passada(limite=1)

    assert stats.paginas_com_falha
    assert _contagem(a) is None
    de_novo = rawg(_Rawg([_jogo(a)]))
    serie_jogos.passada(limite=1)
    assert de_novo.detalhes_pedidos() == [a]


def test_passada_com_falha_na_serie_deixa_o_jogo_sem_contagem_e_segue(client, pg, rawg, slugs):
    pessoas = [criar_usuario(pg) for _ in range(7)]
    a, b, irmao = slugs(), slugs(), slugs()
    _antigo(a, pessoas)
    _antigo(b, pessoas[:6])
    rawg(_Rawg([_jogo(a), _jogo(b)], contagens={a: 2, b: 1}, series={b: [_da_serie(irmao)]}, serie_falha={a}))

    stats = serie_jogos.passada(limite=2)

    assert (_contagem(a), _contagem(b)) == (None, 1)
    assert _relacoes(client, _id(a)) == []
    assert [r['titulo'] for r in _relacoes(client, _id(b))] == [f'Série {irmao}']
    assert (stats.sucessos, stats.falhas) == (1, 1)


def test_passada_com_falha_ao_gravar_nao_muda_a_contagem(client, pg, rawg, slugs, monkeypatch):
    pessoas = [criar_usuario(pg) for _ in range(8)]
    a, irmao = slugs(), slugs()
    _antigo(a, pessoas)
    rawg(_Rawg([_jogo(a)], contagens={a: 1}, series={a: [_da_serie(irmao)]}))
    _relacoes_que_o_banco_recusa(monkeypatch)

    stats = serie_jogos.passada(limite=1)

    assert stats.paginas_com_falha
    assert _contagem(a) is None


def test_run_import_de_jogo_roda_a_passada_depois_da_importacao(pg, rawg, slugs, monkeypatch, capsys):
    import sys

    from importacao import run_import

    pessoas = [criar_usuario(pg) for _ in range(6)]
    antigo, novo = slugs(), slugs()
    _antigo(antigo, pessoas)
    fonte = rawg(_Rawg([_jogo(novo), _jogo(antigo)], contagens={antigo: 0, novo: 0}))
    fonte.jogos = {novo: fonte.jogos[novo]}  # a listagem traz só o novo; o detalhe do antigo continua
    original = fonte.get
    detalhe_do_antigo = {**_jogo(antigo), 'tags': [], 'game_series_count': 0}
    fonte.get = lambda url, params=None, timeout=None: (
        _Resposta(200, detalhe_do_antigo) if url.endswith(f'/games/{antigo}') else original(url, params, timeout))
    monkeypatch.setattr(sys, 'argv', ['run_import', '--tipo', 'jogo', '--paginas', '1', '--serie-jogos', '1'])

    run_import.main()

    assert (_contagem(novo), _contagem(antigo)) == (0, 0)
    assert 'Passada lenta da série' in capsys.readouterr().out
