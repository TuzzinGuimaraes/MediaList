"""Relações de anime e mangá, da Importação do AniList até `GET /api/midias/<id>/relacoes` (spec `relacoes`).

As Relações entram pelo `run_import` contra o AniList falso (`fontes_falsas.AniListFalso`) e saem
pela rota, com o PostgreSQL real (TEST_DATABASE_URL); sem ela, pula. Página de 3 obras, como nos
outros testes da Importação do AniList.
"""
import pytest

import banco
from importacao import anilist

from .fontes_falsas import AniListFalso
from .helpers import criar_usuario
from .test_importacao_anilist_pg import (  # noqa: F401 (fixtures)
    BASE,
    TEST_DATABASE_URL,
    importar,
    pg,
)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as Relações'
)

CAPA = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg'


def _aresta(relacao, tipo, anilist_id, *, titulo=None, adulto=False, estreia=None, capa=CAPA, formato='TV'):
    return {'relationType': relacao, 'node': {
        'id': anilist_id, 'type': tipo, 'format': formato, 'title': {'romaji': titulo or f'Obra {anilist_id}'},
        'startDate': estreia or {'year': None, 'month': None, 'day': None}, 'isAdult': adulto,
        'coverImage': {'large': capa},
    }}


def _obra(anilist_id, *arestas, popularidade=None, **campos):
    return (anilist_id, popularidade or 1000 - anilist_id % 1000, {'relations': {'edges': list(arestas)}, **campos})


def _importar_obras(importar, tipo, obras):  # noqa: F811
    codigo, _, _ = importar(tipo, AniListFalso({tipo.upper(): obras}), '--paginas', '5', '--paginas-atualizacao', '0',
                            '--do-inicio')
    assert codigo == 0


def _id_midia(tipo, anilist_id):
    tabela = {'anime': 'animes', 'manga': 'mangas'}[tipo]
    linha = banco.consultar_um(f'SELECT id_midia FROM {tabela} WHERE anilist_id = %s', (anilist_id,))
    return linha and linha['id_midia']


def _relacoes(client, id_midia, headers=None):
    resposta = client.get(f'/api/midias/{id_midia}/relacoes', headers=headers or {})
    assert resposta.status_code == 200, resposta.get_json()
    return resposta.get_json()['relacoes']


def _resumo(relacoes):
    return {(r['relacao'], r['tipo'], r['titulo']) for r in relacoes}


def test_a_importacao_grava_as_relacoes_e_a_rota_as_devolve(client, importar):  # noqa: F811
    _importar_obras(importar, 'anime', [
        _obra(BASE + 1,
              _aresta('SEQUEL', 'ANIME', BASE + 2),
              _aresta('SOURCE', 'MANGA', BASE + 900, titulo='Mangá de origem',
                      estreia={'year': 2019, 'month': 3, 'day': None}, formato='MANGA'),
              _aresta('CHARACTER', 'ANIME', BASE + 3),
              _aresta('OTHER', 'ANIME', BASE + 4),
              _aresta('SIDE_STORY', 'ANIME', BASE + 5, adulto=True)),
        _obra(BASE + 2),
    ])

    relacoes = _relacoes(client, _id_midia('anime', BASE + 1))

    assert _resumo(relacoes) == {('SEQUEL', 'anime', f'Obra {BASE + 2}'), ('SOURCE', 'manga', 'Mangá de origem')}
    por_tipo = {r['tipo']: r for r in relacoes}
    assert por_tipo['anime']['id_midia'] == _id_midia('anime', BASE + 2)
    assert por_tipo['anime']['link_fonte'] is None
    assert por_tipo['manga'] == {
        'relacao': 'SOURCE', 'tipo': 'manga', 'titulo': 'Mangá de origem', 'poster_url': CAPA,
        'data_lancamento': '2019-03-01', 'id_midia': None, 'link_fonte': f'https://anilist.co/manga/{BASE + 900}',
        'status_consumo': None,
    }


def test_relacao_mostra_o_titulo_em_ingles_dentro_e_fora_do_catalogo(client, importar):  # noqa: F811
    fora = _aresta('SOURCE', 'MANGA', BASE + 900, formato='MANGA')
    fora['node']['title'] = {'romaji': 'Hagane no Renkinjutsushi', 'english': 'Fullmetal Alchemist', 'native': '鋼'}
    _importar_obras(importar, 'anime', [
        _obra(BASE + 1, _aresta('SEQUEL', 'ANIME', BASE + 2), fora),
        _obra(BASE + 2, title={'romaji': 'Zoku', 'english': 'Brotherhood', 'native': '続'}),
    ])

    relacoes = _relacoes(client, _id_midia('anime', BASE + 1))

    assert _resumo(relacoes) == {('SEQUEL', 'anime', 'Brotherhood'), ('SOURCE', 'manga', 'Fullmetal Alchemist')}
    [prequel] = _relacoes(client, _id_midia('anime', BASE + 2))
    assert prequel['titulo'] == f'Obra {BASE + 1}'


def test_relacao_aparece_nos_dois_sentidos(client, importar):  # noqa: F811
    _importar_obras(importar, 'anime', [_obra(BASE + 1, _aresta('SEQUEL', 'ANIME', BASE + 2)), _obra(BASE + 2)])

    [prequel] = _relacoes(client, _id_midia('anime', BASE + 2))

    assert (prequel['relacao'], prequel['id_midia']) == ('PREQUEL', _id_midia('anime', BASE + 1))


def test_a_relacao_cruza_tipos_nos_dois_sentidos(client, importar):  # noqa: F811
    _importar_obras(importar, 'manga', [_obra(BASE + 10, _aresta('ADAPTATION', 'ANIME', BASE + 1))])
    _importar_obras(importar, 'anime', [_obra(BASE + 1)])

    [original] = _relacoes(client, _id_midia('anime', BASE + 1))
    [adaptacao] = _relacoes(client, _id_midia('manga', BASE + 10))

    assert (original['relacao'], original['tipo'], original['id_midia']) == (
        'SOURCE', 'manga', _id_midia('manga', BASE + 10))
    assert (adaptacao['relacao'], adaptacao['tipo'], adaptacao['id_midia']) == (
        'ADAPTATION', 'anime', _id_midia('anime', BASE + 1))


def test_vale_o_lado_da_propria_midia(client, importar):  # noqa: F811
    _importar_obras(importar, 'anime', [
        _obra(BASE + 1, _aresta('PARENT', 'ANIME', BASE + 2)),
        _obra(BASE + 2, _aresta('SPIN_OFF', 'ANIME', BASE + 1)),
    ])

    assert [r['relacao'] for r in _relacoes(client, _id_midia('anime', BASE + 1))] == ['PARENT']
    assert [r['relacao'] for r in _relacoes(client, _id_midia('anime', BASE + 2))] == ['SPIN_OFF']


def test_obra_que_entra_no_catalogo_passa_a_ter_id_midia(client, importar):  # noqa: F811
    _importar_obras(importar, 'anime', [_obra(BASE + 1, _aresta('SEQUEL', 'ANIME', BASE + 2))])
    [antes] = _relacoes(client, _id_midia('anime', BASE + 1))
    assert (antes['id_midia'], antes['link_fonte']) == (None, f'https://anilist.co/anime/{BASE + 2}')

    _importar_obras(importar, 'anime', [_obra(BASE + 2, title={'romaji': 'Segunda temporada'})])

    [depois] = _relacoes(client, _id_midia('anime', BASE + 1))
    assert (depois['id_midia'], depois['link_fonte']) == (_id_midia('anime', BASE + 2), None)


def test_midia_excluida_some_e_volta_como_obra_fora_do_catalogo(client, importar):  # noqa: F811
    _importar_obras(importar, 'anime', [
        _obra(BASE + 1, _aresta('SEQUEL', 'ANIME', BASE + 2)),
        _obra(BASE + 2, _aresta('PREQUEL', 'ANIME', BASE + 1)),
    ])
    sequencia = _id_midia('anime', BASE + 2)

    banco.executar('DELETE FROM midias WHERE id_midia = %s', (sequencia,))

    [relacao] = _relacoes(client, _id_midia('anime', BASE + 1))
    assert (relacao['relacao'], relacao['id_midia'], relacao['link_fonte']) == (
        'SEQUEL', None, f'https://anilist.co/anime/{BASE + 2}')
    assert client.get(f'/api/midias/{sequencia}/relacoes').status_code == 404


def test_status_da_lista_so_com_sessao(client, importar, make_token):  # noqa: F811
    _importar_obras(importar, 'anime', [
        _obra(BASE + 1, _aresta('SEQUEL', 'ANIME', BASE + 2), _aresta('SIDE_STORY', 'ANIME', BASE + 3)),
        _obra(BASE + 2), _obra(BASE + 3),
    ])
    criados = {'usuarios': []}
    id_usuario = criar_usuario(criados)
    try:
        banco.executar("INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo) VALUES (%s, %s, 'completo')",
                       (id_usuario, _id_midia('anime', BASE + 2)))
        headers = {'Authorization': f'Bearer {make_token(id_usuario)}'}

        origem = _id_midia('anime', BASE + 1)
        com_sessao = {r['relacao']: r['status_consumo'] for r in _relacoes(client, origem, headers)}
        sem_sessao = {r['relacao']: r['status_consumo'] for r in _relacoes(client, origem)}
    finally:
        banco.executar('DELETE FROM usuarios WHERE id_usuario = %s', (id_usuario,))

    assert com_sessao == {'SEQUEL': 'completo', 'SIDE_STORY': None}
    assert sem_sessao == {'SEQUEL': None, 'SIDE_STORY': None}


def test_midia_sem_relacoes_devolve_lista_vazia_e_inexistente_404(client, importar):  # noqa: F811
    _importar_obras(importar, 'anime', [_obra(BASE + 1)])

    assert _relacoes(client, _id_midia('anime', BASE + 1)) == []
    assert client.get('/api/midias/00000000-0000-7000-8000-000000000000/relacoes').status_code == 404


def test_a_reimportacao_substitui_as_relacoes(client, importar):  # noqa: F811
    _importar_obras(importar, 'anime', [_obra(BASE + 1, _aresta('SEQUEL', 'ANIME', BASE + 2),
                                              _aresta('SUMMARY', 'ANIME', BASE + 3))])

    _importar_obras(importar, 'anime', [_obra(BASE + 1, _aresta('PREQUEL', 'ANIME', BASE + 2),
                                              _aresta('ALTERNATIVE', 'MANGA', BASE + 4))])

    assert {(r['relacao'], r['tipo']) for r in _relacoes(client, _id_midia('anime', BASE + 1))} == {
        ('PREQUEL', 'anime'), ('ALTERNATIVE', 'manga'),
    }


def test_a_reimportacao_com_a_mesma_relacao_a_mantem(client, importar):  # noqa: F811
    obra = _obra(BASE + 1, _aresta('SEQUEL', 'ANIME', BASE + 2), _aresta('SOURCE', 'MANGA', BASE + 900))
    _importar_obras(importar, 'anime', [obra])

    _importar_obras(importar, 'anime', [obra])

    assert {(r['relacao'], r['tipo']) for r in _relacoes(client, _id_midia('anime', BASE + 1))} == {
        ('SEQUEL', 'anime'), ('SOURCE', 'manga'),
    }


def test_manga_adulto_do_catalogo_nao_aparece_no_anime_para_o_qual_aponta(client, importar):  # noqa: F811
    _importar_obras(importar, 'manga', [
        _obra(BASE + 10, _aresta('ADAPTATION', 'ANIME', BASE + 1), isAdult=True),
        _obra(BASE + 11, _aresta('ADAPTATION', 'ANIME', BASE + 1)),
    ])
    _importar_obras(importar, 'anime', [_obra(BASE + 1)])

    assert [(r['relacao'], r['id_midia']) for r in _relacoes(client, _id_midia('anime', BASE + 1))] == [
        ('SOURCE', _id_midia('manga', BASE + 11)),
    ]


def test_dado_da_fonte_e_validado_antes_de_gravar(client, importar):  # noqa: F811
    _importar_obras(importar, 'anime', [_obra(
        BASE + 1,
        _aresta('SEQUEL', 'ANIME', BASE + 2, capa='javascript:alert(1)', titulo='x' * 1000,
                estreia={'year': 2021, 'month': 2, 'day': 30}),
        _aresta('PREQUEL', 'ANIME', BASE + 3, capa='https://exemplo.com/capa.jpg'),
        _aresta('ADAPTATION', 'NOVEL', BASE + 4),
        _aresta('sequel; DROP', 'ANIME', BASE + 5),
        {'relationType': 'SEQUEL', 'node': None},
        _aresta('SIDE_STORY', 'ANIME', BASE + 2),  # o mesmo destino de novo: vale a primeira
    )])

    relacoes = {r['relacao']: r for r in _relacoes(client, _id_midia('anime', BASE + 1))}

    assert set(relacoes) == {'SEQUEL', 'PREQUEL'}
    assert relacoes['SEQUEL']['poster_url'] is None
    assert len(relacoes['SEQUEL']['titulo']) <= 300
    assert relacoes['SEQUEL']['data_lancamento'] is None
    assert relacoes['PREQUEL']['poster_url'] is None


def test_relations_so_na_consulta_da_importacao():
    assert 'relations' not in anilist.CAMPOS_MEDIA
    consulta, _ = anilist._consulta({'season': 'FALL', 'seasonYear': 2026, 'isAdult': False})
    assert 'relations' in consulta
    # Sem a versão 3 do enum o AniList devolve ADAPTATION nos dois lados e nunca SOURCE.
    assert 'relationType(version: 3)' in consulta


@pytest.mark.parametrize('tipo', ['anime', 'manga'])
def test_carga_unica_grava_so_as_relacoes_em_lotes_por_id(client, importar, monkeypatch, tipo):  # noqa: F811
    from importacao import relacoes

    monkeypatch.setattr(relacoes, 'LOTE', 2)
    fonte_tipo = tipo.upper()
    ids = [BASE + 1, BASE + 2, BASE + 3]
    _importar_obras(importar, tipo, [_obra(i) for i in ids])
    fonte = AniListFalso({fonte_tipo: [
        _obra(BASE + 1, _aresta('SEQUEL', fonte_tipo, BASE + 2), title={'romaji': 'Outro título'}),
        _obra(BASE + 3, _aresta('ALTERNATIVE', 'ANIME', BASE + 50)),
    ]})
    monkeypatch.setattr(relacoes, 'criar_sessao_http', lambda **kw: fonte)
    monkeypatch.setattr(relacoes, 'RateLimiter', _SemEspera)

    codigo, _, resumo = importar(tipo, fonte, '--so-relacoes')

    assert codigo == 0
    # Todo o Catálogo do Tipo, por `anilist_id`, em lotes de `LOTE`.
    catalogo = [linha['anilist_id'] for linha in banco.consultar(
        f"SELECT anilist_id FROM {'animes' if tipo == 'anime' else 'mangas'} "
        'WHERE anilist_id IS NOT NULL ORDER BY anilist_id')]
    assert set(ids) <= set(catalogo)
    assert [i for p in fonte.pedidos for i in p['idIn']] == catalogo
    assert {len(p['idIn']) for p in fonte.pedidos[:-1]} == {2}
    # A obra que o AniList não devolveu (BASE + 2) fica como estava.
    assert 'sucessos=2 falhas=0' in resumo
    # Só as Relações: a Mídia não muda.
    assert banco.consultar_um('SELECT titulo_original FROM midias WHERE id_midia = %s',
                              (_id_midia(tipo, BASE + 1),))['titulo_original'] == f'Obra {BASE + 1}'
    assert {r['relacao'] for r in _relacoes(client, _id_midia(tipo, BASE + 1))} == {'SEQUEL'}
    assert {r['relacao'] for r in _relacoes(client, _id_midia(tipo, BASE + 3))} == {'ALTERNATIVE'}


def test_carga_unica_segue_depois_de_um_lote_com_falha_e_sai_com_erro(client, importar, monkeypatch):  # noqa: F811
    from importacao import relacoes

    monkeypatch.setattr(relacoes, 'LOTE', 1)
    _importar_obras(importar, 'anime', [_obra(BASE + 1), _obra(BASE + 2)])
    fonte = AniListFalso({'ANIME': [_obra(BASE + 2, _aresta('SEQUEL', 'ANIME', BASE + 3))]}, falha_em={1})
    monkeypatch.setattr(relacoes, 'criar_sessao_http', lambda **kw: fonte)
    monkeypatch.setattr(relacoes, 'RateLimiter', _SemEspera)

    codigo, _, resumo = importar('anime', fonte, '--so-relacoes')

    assert codigo == 1
    assert 'paginas_com_falha=[1]' in resumo
    assert {r['relacao'] for r in _relacoes(client, _id_midia('anime', BASE + 2))} == {'SEQUEL'}


class _SemEspera:
    def __init__(self, *args):
        pass

    def wait(self):
        pass
