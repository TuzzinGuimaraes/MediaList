"""Importação de animes com Temporada, formato e Popularidade da fonte (spec `temporada`).

A gravação de hoje guarda a Temporada do AniList (desligando a estimativa), o formato e a
Popularidade da fonte; a passada das Temporadas traz inteiras a atual e as 4 seguintes. Roda o
`run_import` contra o AniList falso e o PostgreSQL real (TEST_DATABASE_URL); sem ela, pula.
"""
from datetime import date

import pytest

import banco

from .fontes_falsas import AniListFalso
from .test_importacao_anilist_pg import (  # noqa: F401 (fixtures)
    BASE,
    TEST_DATABASE_URL,
    _cursor,
    _importadas,
    importar,
    pg,
)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a Importação do AniList'
)

HOJE = date(2026, 11, 28)


@pytest.fixture(autouse=True)
def hoje(monkeypatch):
    from importacao import importar_animes

    monkeypatch.setattr(importar_animes, 'hoje', lambda: HOJE)


def _temporada(anilist_id):
    return banco.consultar_um(
        'SELECT temporada_estacao, temporada_ano, temporada_estimada, formato, popularidade_fonte '
        'FROM animes WHERE anilist_id = %s', (anilist_id,),
    )


def _da_temporada(estacao, ano, **campos):
    return {'season': estacao, 'seasonYear': ano, **campos}


def test_grava_a_temporada_do_anilist_e_desliga_a_estimativa(importar):  # noqa: F811
    obra = BASE + 1
    sem_temporada = {'format': 'TV', 'startDate': {'year': 2026, 'month': 9, 'day': 15}}
    importar('anime', AniListFalso({'ANIME': [(obra, 500, sem_temporada)]}), '--paginas', '1',
             '--paginas-atualizacao', '0')
    # Sem a Temporada do AniList, a estimada pela estreia (setembro: verão).
    assert _temporada(obra) == {'temporada_estacao': 'verao', 'temporada_ano': 2026, 'temporada_estimada': True,
                                'formato': 'TV', 'popularidade_fonte': 500}

    com_temporada = {**sem_temporada, 'season': 'FALL', 'seasonYear': 2026, 'format': 'ONA'}
    importar('anime', AniListFalso({'ANIME': [(obra, 750, com_temporada)]}), '--paginas', '1',
             '--paginas-atualizacao', '0', '--do-inicio')

    assert _temporada(obra) == {'temporada_estacao': 'outono', 'temporada_ano': 2026, 'temporada_estimada': False,
                                'formato': 'ONA', 'popularidade_fonte': 750}


@pytest.mark.parametrize('campos', [
    {'format': 'NOVEL', 'startDate': {'year': 2026, 'month': None, 'day': None}},
    {'format': None, 'startDate': None, 'season': 'WINTER', 'seasonYear': None},
    {'season': 'MONSOON', 'seasonYear': 2026},
])
def test_sem_temporada_nem_mes_de_estreia_fica_sem_temporada_e_formato_desconhecido_e_nulo(importar, campos):  # noqa: F811
    obra = BASE + 2
    importar('anime', AniListFalso({'ANIME': [(obra, 10, campos)]}), '--paginas', '1', '--paginas-atualizacao', '0')

    assert _temporada(obra) == {'temporada_estacao': None, 'temporada_ano': None, 'temporada_estimada': False,
                                'formato': None, 'popularidade_fonte': 10}


def _obras_das_temporadas():
    """Outono 2026 com 4 obras (2 páginas de 3) e uma adulta; uma em cada uma das seguintes até o
    inverno 2027; nada na primavera e no verão de 2027; e duas de temporadas passadas."""
    return [
        *[(BASE + 10 + i, 900 - i, _da_temporada('FALL', 2026)) for i in range(4)],
        (BASE + 20, 950, _da_temporada('FALL', 2026, isAdult=True)),
        (BASE + 30, 400, _da_temporada('WINTER', 2027, format='MOVIE')),
        (BASE + 40, 5, _da_temporada('FALL', 2027)),
        (BASE + 50, 999, _da_temporada('SPRING', 2026)),
        (BASE + 60, 999, _da_temporada('FALL', 2025)),
    ]


def _temporadas_pedidas(fonte):
    pedidas = []
    for variaveis in fonte.pedidos:
        if 'season' in variaveis:
            assert variaveis['isAdult'] is False
            pedidas.append((variaveis['season'], variaveis['seasonYear'], variaveis['page']))
    return pedidas


def test_traz_inteiras_a_temporada_atual_e_as_4_seguintes(importar):  # noqa: F811
    fonte = AniListFalso({'ANIME': _obras_das_temporadas()})

    codigo, _, resumo = importar('anime', fonte, '--paginas', '0', '--paginas-atualizacao', '0', '--temporadas', '5')

    assert codigo == 0
    assert _temporadas_pedidas(fonte) == [
        ('FALL', 2026, 1), ('FALL', 2026, 2), ('WINTER', 2027, 1), ('SPRING', 2027, 1), ('SUMMER', 2027, 1),
        ('FALL', 2027, 1),
    ]
    assert _importadas('anime') == {BASE + 10, BASE + 11, BASE + 12, BASE + 13, BASE + 30, BASE + 40}
    assert 'sucessos=6 falhas=0' in resumo
    # A passada das Temporadas não tem cursor.
    assert _cursor('anime') is None

    # Rodar de novo atualiza as mesmas Mídias, sem duplicar.
    _, _, resumo = importar('anime', fonte, '--paginas', '0', '--paginas-atualizacao', '0', '--temporadas', '5')
    assert 'ja_existia=6' in resumo


def test_falha_de_uma_temporada_nao_derruba_as_outras_nem_o_cursor(importar):  # noqa: F811
    obras = _obras_das_temporadas()
    # Chamada 1: o crescimento (topo, página 1); chamada 2: o outono 2026, página 1.
    fonte = AniListFalso({'ANIME': obras}, falha_em={2})

    codigo, _, resumo = importar('anime', fonte, '--paginas', '1', '--paginas-atualizacao', '0', '--temporadas', '5')

    assert codigo == 1
    assert 'paginas_com_falha=[1]' in resumo
    assert _temporadas_pedidas(fonte) == [
        ('FALL', 2026, 1), ('WINTER', 2027, 1), ('SPRING', 2027, 1), ('SUMMER', 2027, 1), ('FALL', 2027, 1),
    ]
    # O crescimento leu as 3 mais populares e o cursor dele avançou; as do outono 2026 que só a
    # passada traria ficam para a próxima execução.
    mais_populares = sorted(obras, key=lambda o: (-o[1], o[0]))[:3]
    assert _cursor('anime')['crescimento_id'] == mais_populares[-1][0]
    assert _importadas('anime') == {o[0] for o in mais_populares} | {BASE + 30, BASE + 40}


def test_falha_da_passada_principal_nao_impede_as_temporadas_e_sai_com_erro(importar):  # noqa: F811
    # Chamada 1: o crescimento, que recebe uma resposta que a Importação não entende e para.
    fonte = AniListFalso({'ANIME': _obras_das_temporadas()}, quebra_em={1})

    codigo, _, _ = importar('anime', fonte, '--paginas', '1', '--paginas-atualizacao', '0', '--temporadas', '5')

    assert codigo == 1
    assert _temporadas_pedidas(fonte) == [
        ('FALL', 2026, 1), ('FALL', 2026, 2), ('WINTER', 2027, 1), ('SPRING', 2027, 1), ('SUMMER', 2027, 1),
        ('FALL', 2027, 1),
    ]
    assert _importadas('anime') == {BASE + 10, BASE + 11, BASE + 12, BASE + 13, BASE + 30, BASE + 40}
    assert _cursor('anime') is None
