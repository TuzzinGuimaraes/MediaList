"""Recomendações do AniList gravadas pela Importação e pela carga `--so-relacoes` (spec `sugestoes`).

As recomendações entram pelo `run_import` contra o AniList falso (`fontes_falsas.AniListFalso`),
com o PostgreSQL real (TEST_DATABASE_URL); sem ela, pula. Ainda não há rota que as leia (ticket 02),
então o teste confere o que ficou gravado.
"""
import pytest

import banco
from importacao import anilist

from .fontes_falsas import AniListFalso
from .test_importacao_anilist_pg import (  # noqa: F401 (fixtures)
    BASE,
    TEST_DATABASE_URL,
    importar,
    pg,
)
from .test_relacoes_pg import _aresta, _id_midia, _importar_obras, _relacoes, _SemEspera

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as recomendações'
)


def _rec(tipo, anilist_id, rating, *, adulto=False):
    return {'rating': rating, 'mediaRecommendation': {'id': anilist_id, 'type': tipo, 'isAdult': adulto}}


def _obra(anilist_id, *recomendacoes, relacoes=(), **campos):
    return (anilist_id, 1000 - anilist_id % 1000, {
        'relations': {'edges': list(relacoes)},
        'recommendations': {'nodes': list(recomendacoes)},
        **campos,
    })


def _recomendacoes(tipo, anilist_id):
    return {(r['tipo_destino'], r['destino_anilist_id'], r['rating'], r['adulto']) for r in banco.consultar(
        'SELECT tipo_destino, destino_anilist_id, rating, adulto FROM recomendacoes_midia WHERE id_midia = %s',
        (_id_midia(tipo, anilist_id),),
    )}


@pytest.mark.parametrize('tipo', ['anime', 'manga'])
def test_a_importacao_grava_as_recomendacoes_de_rating_positivo(importar, tipo):  # noqa: F811
    fonte = tipo.upper()
    _importar_obras(importar, tipo, [
        _obra(BASE + 1,
              _rec(fonte, BASE + 2, 120),
              _rec('MANGA', BASE + 900, 7, adulto=True),
              _rec(fonte, BASE + 3, 0),
              _rec(fonte, BASE + 4, -2)),
        _obra(BASE + 2),
    ])

    assert _recomendacoes(tipo, BASE + 1) == {(tipo, BASE + 2, 120, False), ('manga', BASE + 900, 7, True)}
    assert _recomendacoes(tipo, BASE + 2) == set()


def test_a_reimportacao_substitui_as_recomendacoes(importar):  # noqa: F811
    _importar_obras(importar, 'anime', [_obra(BASE + 1, _rec('ANIME', BASE + 2, 50), _rec('ANIME', BASE + 3, 9))])

    _importar_obras(importar, 'anime', [_obra(BASE + 1, _rec('ANIME', BASE + 2, 60), _rec('ANIME', BASE + 4, 1))])

    assert _recomendacoes('anime', BASE + 1) == {('anime', BASE + 2, 60, False), ('anime', BASE + 4, 1, False)}


def test_dado_da_fonte_e_validado_antes_de_gravar(importar):  # noqa: F811
    _importar_obras(importar, 'anime', [_obra(
        BASE + 1,
        _rec('ANIME', BASE + 2, 30),
        _rec('ANIME', BASE + 2, 10),  # o mesmo destino de novo: vale a primeira
        _rec('NOVEL', BASE + 3, 10),
        _rec('ANIME', 0, 10),
        _rec('ANIME', BASE + 5, '10'),
        _rec('ANIME', BASE + 6, True),
        {'rating': 10, 'mediaRecommendation': None},
        None,
    )])

    assert _recomendacoes('anime', BASE + 1) == {('anime', BASE + 2, 30, False)}


def test_recommendations_so_na_consulta_da_importacao():
    assert 'recommendations' not in anilist.CAMPOS_MEDIA
    consulta, _ = anilist._consulta({'season': 'FALL', 'seasonYear': 2026, 'isAdult': False})
    assert 'recommendations(sort: RATING_DESC, perPage: 10)' in consulta


@pytest.mark.parametrize('tipo', ['anime', 'manga'])
def test_carga_unica_grava_relacoes_e_recomendacoes(client, importar, monkeypatch, tipo):  # noqa: F811
    from importacao import relacoes

    monkeypatch.setattr(relacoes, 'LOTE', 2)
    fonte_tipo = tipo.upper()
    _importar_obras(importar, tipo, [_obra(BASE + 1, _rec(fonte_tipo, BASE + 9, 5)), _obra(BASE + 2), _obra(BASE + 3)])
    fonte = AniListFalso({fonte_tipo: [
        _obra(BASE + 1, _rec(fonte_tipo, BASE + 3, 40), relacoes=[_aresta('SEQUEL', fonte_tipo, BASE + 2)]),
        _obra(BASE + 3, _rec(fonte_tipo, BASE + 1, 0)),
    ]})
    monkeypatch.setattr(relacoes, 'criar_sessao_http', lambda **kw: fonte)
    monkeypatch.setattr(relacoes, 'RateLimiter', _SemEspera)

    codigo, _, _ = importar(tipo, fonte, '--so-relacoes')

    assert codigo == 0
    assert {r['relacao'] for r in _relacoes(client, _id_midia(tipo, BASE + 1))} == {'SEQUEL'}
    assert _recomendacoes(tipo, BASE + 1) == {(tipo, BASE + 3, 40, False)}
    assert _recomendacoes(tipo, BASE + 3) == set()
