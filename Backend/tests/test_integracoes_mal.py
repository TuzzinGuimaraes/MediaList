"""Plataforma MyAnimeList: API v2 e XML exportado, casados pelo `idMal` do AniList (nada de rede)."""
import gzip
import logging

import pytest

from integracoes import mal as modulo_mal
from integracoes.mal import LIMITE_XML, MAL, ArquivoInvalido
from integracoes.plataforma import (
    Conta,
    OrigemIndisponivel,
    PerfilNaoEncontrado,
    PerfilPrivado,
    PlataformaIndisponivel,
)
from schemas.estado_consumo import CONCLUIDO, EM_PROGRESSO, PAUSADO, PLANEJADO

from .test_integracoes_anilist import SessaoFalsa as SessaoAniList
from .test_integracoes_anilist import _Resposta

CHAVE = 'mal-client-id-secreto-456'


class SessaoMal:
    """Responde cada GET com a próxima resposta da fila; guarda url, params e headers."""

    def __init__(self, *respostas):
        self.respostas = list(respostas)
        self.pedidos = []

    def get(self, url, params=None, headers=None, timeout=None):
        self.pedidos.append({'url': url, 'params': params, 'headers': headers})
        if not self.respostas:
            raise AssertionError('GET além do esperado')
        resposta = self.respostas.pop(0)
        if isinstance(resposta, Exception):
            raise resposta
        return resposta

    def close(self):
        pass


@pytest.fixture(autouse=True)
def chave(monkeypatch):
    monkeypatch.setenv('MAL_CLIENT_ID', CHAVE)


def _entrada_mal(id_, titulo='Frieren', **status):
    return {'node': {'id': id_, 'title': titulo}, 'list_status': {
        'status': 'watching', 'score': 8, 'num_episodes_watched': 5, 'is_rewatching': False,
        'start_date': '2026-10-01', **status,
    }}


def _pagina(*entradas, proxima=None):
    return _Resposta(200, {'data': list(entradas), 'paging': {'next': proxima} if proxima else {}})


def _media_anilist(id_mal, id_anilist=None):
    id_anilist = id_anilist or id_mal + 50000
    return {'id': id_anilist, 'idMal': id_mal, 'siteUrl': f'https://anilist.co/anime/{id_anilist}',
            'title': {'romaji': f'AL {id_mal}', 'english': None, 'native': None}}


def _page(*medias):
    return _Resposta(200, {'data': {'Page': {'media': list(medias)}}})


# ============================================
# Disponibilidade e conectar
# ============================================

def test_sem_chave_fica_indisponivel_e_nao_chega_na_rede(monkeypatch):
    monkeypatch.delenv('MAL_CLIENT_ID')
    sessao = SessaoMal()

    assert MAL(sessao=sessao).disponivel() is False
    with pytest.raises(PlataformaIndisponivel):
        MAL(sessao=sessao).conectar('fulano')
    assert sessao.pedidos == []


def test_conectar_le_a_lista_publica_com_a_chave_no_cabecalho():
    sessao = SessaoMal(_pagina())

    conta = MAL(sessao=sessao).conectar(' https://myanimelist.net/profile/Fulano ')

    assert conta == Conta('Fulano', 'Fulano')
    pedido = sessao.pedidos[0]
    assert pedido['url'] == 'https://api.myanimelist.net/v2/users/Fulano/animelist'
    assert pedido['headers'] == {'X-MAL-CLIENT-ID': CHAVE}
    assert CHAVE not in str(pedido['params'])


@pytest.mark.parametrize(('resposta', 'erro'), [
    (_Resposta(404, {'error': 'not_found'}), PerfilNaoEncontrado),
    (_Resposta(403, {'error': 'forbidden'}), PerfilPrivado),
    (_Resposta(500, {}), OrigemIndisponivel),
    (_Resposta(429, {}), OrigemIndisponivel),
    (ConnectionError('sem rede'), OrigemIndisponivel),
])
def test_erros_do_mal_sao_distinguiveis(resposta, erro):
    with pytest.raises(erro) as levantado:
        MAL(sessao=SessaoMal(resposta)).conectar('fulano')
    if erro is PerfilPrivado:
        assert 'pública' in str(levantado.value)


def test_nome_invalido_nao_chega_na_rede():
    sessao = SessaoMal()
    for nome in ('', '  ', 'a/../b', 'x' * 30):
        with pytest.raises(PerfilNaoEncontrado):
            MAL(sessao=sessao).conectar(nome)
    assert sessao.pedidos == []


# ============================================
# Ler pela API
# ============================================

def test_ler_pagina_normaliza_e_casa_pelo_idmal():
    sessao = SessaoMal(
        _pagina(_entrada_mal(1), proxima='https://api.myanimelist.net/v2/users/fulano/animelist?offset=1000'),
        _pagina(_entrada_mal(2, 'Sem par', status='plan_to_watch', score=0, num_episodes_watched=0)),
        _pagina({'node': {'id': 3, 'title': 'Berserk'}, 'list_status': {
            'status': 'completed', 'score': 10, 'num_chapters_read': 380, 'num_volumes_read': 41,
            'is_rereading': False, 'finish_date': '2025-03-09', 'start_date': '2020-05',
        }}),
    )
    anilist = SessaoAniList(_page(_media_anilist(1)), _page({**_media_anilist(3), 'siteUrl': None}))

    itens = MAL(sessao=sessao, sessao_anilist=anilist).ler(Conta('fulano'))

    assert [(i.tipo, i.origem_id) for i in itens] == [('anime', '1'), ('anime', '2'), ('manga', '3')]
    frieren, sem_par, berserk = itens
    assert (frieren.status, frieren.progresso, frieren.nota, frieren.data_inicio) == (
        EM_PROGRESSO, 5, 8.0, '2026-10-01',
    )
    assert frieren.link == 'https://myanimelist.net/anime/1'
    assert (frieren.catalogo.fonte, frieren.catalogo.id_fonte) == ('anilist', '50001')
    assert frieren.catalogo.dados['idMal'] == 1
    assert (sem_par.status, sem_par.nota, sem_par.catalogo) == (PLANEJADO, None, None)
    assert (berserk.status, berserk.progresso, berserk.nota) == (CONCLUIDO, 380, 10.0)
    assert (berserk.data_inicio, berserk.data_conclusao) == (None, '2025-03-09')
    assert berserk.link == 'https://myanimelist.net/manga/3'

    urls = [p['url'] for p in sessao.pedidos]
    assert urls[1] == 'https://api.myanimelist.net/v2/users/fulano/animelist?offset=1000'
    assert urls[2] == 'https://api.myanimelist.net/v2/users/fulano/mangalist'
    assert sessao.pedidos[0]['params'] == {'fields': 'list_status', 'limit': 1000, 'nsfw': 'true'}
    assert all(p['headers'] == {'X-MAL-CLIENT-ID': CHAVE} for p in sessao.pedidos)
    assert [e['variables'] for e in anilist.enviados] == [
        {'ids': [1, 2], 'tipo': 'ANIME', 'porPagina': 50},
        {'ids': [3], 'tipo': 'MANGA', 'porPagina': 50},
    ]
    assert 'idMal_in' in anilist.enviados[0]['query']


def test_proxima_pagina_fora_da_api_do_mal_e_ignorada():
    sessao = SessaoMal(_pagina(_entrada_mal(1), proxima='https://evil.test/steal'), _pagina())

    MAL(sessao=sessao, sessao_anilist=SessaoAniList(_page())).ler(Conta('fulano'))

    assert [p['url'] for p in sessao.pedidos] == [
        'https://api.myanimelist.net/v2/users/fulano/animelist',
        'https://api.myanimelist.net/v2/users/fulano/mangalist',
    ]


def test_rewatching_e_em_progresso():
    sessao = SessaoMal(_pagina(_entrada_mal(1, status='completed', is_rewatching=True)), _pagina())

    item = MAL(sessao=sessao, sessao_anilist=SessaoAniList(_page())).ler(Conta('fulano'))[0]

    assert item.status == EM_PROGRESSO


def test_casamento_em_lotes_de_50():
    ids = list(range(1, 121))
    anilist = SessaoAniList(_page(), _page(), _page())

    itens = modulo_mal.casar([modulo_mal._item(i, 'anime', f'T{i}', 'watching', 1, 0) for i in ids], anilist)

    assert [len(e['variables']['ids']) for e in anilist.enviados] == [50, 50, 20]
    assert all(i.catalogo is None for i in itens)


def test_anilist_fora_do_ar_no_casamento_e_origem_indisponivel():
    with pytest.raises(OrigemIndisponivel):
        modulo_mal.casar([modulo_mal._item(1, 'anime', 'T', 'watching', 1, 0)],
                         SessaoAniList(_Resposta(500, {'errors': [{'message': 'x'}]})))


# ============================================
# XML exportado
# ============================================

XML = b"""<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_name>Fulano</user_name><user_export_type>1</user_export_type></myinfo>
  <anime>
    <series_animedb_id>1</series_animedb_id>
    <series_title><![CDATA[Cowboy Bebop]]></series_title>
    <series_episodes>26</series_episodes>
    <my_watched_episodes>26</my_watched_episodes>
    <my_start_date>2020-01-02</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
    <my_rewatching>0</my_rewatching>
  </anime>
  <anime>
    <series_animedb_id>2</series_animedb_id>
    <series_title>Pausado</series_title>
    <my_watched_episodes>3</my_watched_episodes>
    <my_start_date>2021-05-00</my_start_date>
    <my_score>0</my_score>
    <my_status>On-Hold</my_status>
  </anime>
  <manga>
    <manga_mangadb_id>3</manga_mangadb_id>
    <manga_title><![CDATA[Berserk]]></manga_title>
    <my_read_chapters>100</my_read_chapters>
    <my_read_volumes>10</my_read_volumes>
    <my_score>10</my_score>
    <my_status>Reading</my_status>
    <my_rereading>0</my_rereading>
  </manga>
</myanimelist>
"""


def test_xml_normaliza_anime_e_manga():
    itens = modulo_mal.ler_xml(XML)

    assert [(i.tipo, i.origem_id, i.titulo) for i in itens] == [
        ('anime', '1', 'Cowboy Bebop'), ('anime', '2', 'Pausado'), ('manga', '3', 'Berserk'),
    ]
    bebop, pausado, berserk = itens
    assert (bebop.status, bebop.progresso, bebop.nota, bebop.data_inicio, bebop.data_conclusao) == (
        CONCLUIDO, 26, 9.0, '2020-01-02', None,
    )
    assert (pausado.status, pausado.nota, pausado.data_inicio) == (PAUSADO, None, None)
    assert (berserk.status, berserk.progresso, berserk.link) == (EM_PROGRESSO, 100, 'https://myanimelist.net/manga/3')


def test_xml_gzip_e_aceito():
    assert len(modulo_mal.ler_xml(gzip.compress(XML))) == 3


def test_xml_pela_plataforma_casa_sem_a_chave_do_mal(monkeypatch):
    monkeypatch.delenv('MAL_CLIENT_ID')
    anilist = SessaoAniList(_page(_media_anilist(1)), _page())

    itens = MAL(sessao_anilist=anilist).itens_do_xml(XML)

    assert [i.catalogo.id_fonte if i.catalogo else None for i in itens] == ['50001', None, None]


@pytest.mark.parametrize('conteudo', [
    b'',
    b'isto nao e xml',
    b'<outra><anime/></outra>',
    gzip.compress(b'<myanimelist><anime>'),
    b'<?xml version="1.0"?><!DOCTYPE m [<!ENTITY e SYSTEM "file:///etc/passwd">]><myanimelist>&e;</myanimelist>',
    b'<?xml version="1.0"?><!DOCTYPE m [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><myanimelist>&b;</myanimelist>',
])
def test_xml_invalido_ou_perigoso_e_recusado(conteudo):
    with pytest.raises(ArquivoInvalido):
        modulo_mal.ler_xml(conteudo)


def test_xml_grande_demais_e_recusado_inclusive_descomprimido():
    with pytest.raises(ArquivoInvalido):
        modulo_mal.ler_xml(b' ' * (LIMITE_XML + 1))
    bomba = gzip.compress(b'<myanimelist>' + b' ' * (modulo_mal.LIMITE_XML_DESCOMPRIMIDO + 1) + b'</myanimelist>')
    assert len(bomba) < LIMITE_XML
    with pytest.raises(ArquivoInvalido):
        modulo_mal.ler_xml(bomba)


def test_entrada_sem_id_e_ignorada():
    xml = b'<myanimelist><anime><series_title>X</series_title></anime></myanimelist>'

    assert modulo_mal.ler_xml(xml) == []


# ============================================
# A chave nunca sai em log
# ============================================

def test_chave_do_mal_nao_aparece_no_log(caplog):
    erro = ConnectionError(f"HTTPSConnectionPool: headers={{'X-MAL-CLIENT-ID': '{CHAVE}'}}")
    with caplog.at_level(logging.DEBUG):
        for resposta in (_Resposta(500, {'detalhe': CHAVE}), erro):
            with pytest.raises(OrigemIndisponivel) as levantado:
                MAL(sessao=SessaoMal(resposta)).conectar('fulano')
            assert CHAVE not in str(levantado.value)

    assert caplog.records
    assert all(CHAVE not in r.getMessage() for r in caplog.records)
