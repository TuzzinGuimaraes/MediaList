"""Relações de uma Mídia na leitura (`dominio.relacoes`): inverso, filtro e o lado da própria Mídia."""
from datetime import date

import pytest

from dominio.relacoes import inversa, relacoes_da_midia


def _linha(relacao, anilist_id=None, *, tipo='anime', slug=None, id_midia=None, adulto=False, status=None,
           titulo=None, data=None):
    return {
        'relacao': relacao, 'tipo': tipo, 'anilist_id': anilist_id, 'rawg_slug': slug, 'adulto': adulto,
        'id_midia': id_midia, 'titulo': titulo or f'Obra {anilist_id or slug}', 'poster_url': None,
        'data_lancamento': data, 'status_consumo': status,
    }


@pytest.mark.parametrize('relacao, nome_inverso', [
    ('SEQUEL', 'PREQUEL'), ('PREQUEL', 'SEQUEL'),
    ('ADAPTATION', 'SOURCE'), ('SOURCE', 'ADAPTATION'),
    ('SIDE_STORY', 'PARENT'), ('SPIN_OFF', 'PARENT'), ('PARENT', 'SIDE_STORY'),
    ('ALTERNATIVE', 'ALTERNATIVE'), ('SUMMARY', 'SUMMARY'), ('COMPILATION', 'COMPILATION'),
    ('CONTAINS', 'CONTAINS'), ('MESMA_SERIE', 'MESMA_SERIE'), ('CHARACTER', 'CHARACTER'), ('OTHER', 'OTHER'),
])
def test_inversa(relacao, nome_inverso):
    assert inversa(relacao) == nome_inverso


def test_o_contrato_lista_as_relacoes_que_a_leitura_mostra():
    from typing import get_args

    from dominio.relacoes import VISIVEIS
    from schemas.midias import NomeRelacao

    assert get_args(NomeRelacao) == VISIVEIS


def test_a_relacao_de_outra_midia_volta_com_o_nome_inverso():
    # A Mídia 2 tem a Sequência 1 (a de que se lê as Relações): para a 1, a 2 é o Prequel.
    [relacao] = relacoes_da_midia([], [_linha('SEQUEL', 2, id_midia='m2', status='assistindo')])

    assert relacao == {
        'relacao': 'PREQUEL', 'tipo': 'anime', 'titulo': 'Obra 2', 'poster_url': None, 'data_lancamento': None,
        'id_midia': 'm2', 'link_fonte': None, 'status_consumo': 'assistindo',
    }


def test_vale_o_lado_da_propria_midia_quando_os_dois_existem():
    proprias = [_linha('SIDE_STORY', 2, id_midia='m2')]
    de_outras = [_linha('SPIN_OFF', 2, id_midia='m2')]

    assert [r['relacao'] for r in relacoes_da_midia(proprias, de_outras)] == ['SIDE_STORY']


def test_o_lado_da_propria_midia_vence_mesmo_quando_ele_fica_de_fora():
    # A própria diz OTHER (fora da leitura); a outra diz SEQUEL. Vale a própria: a obra não aparece.
    assert relacoes_da_midia([_linha('OTHER', 2)], [_linha('SEQUEL', 2, id_midia='m2')]) == []


def test_mesmo_id_em_outro_tipo_e_outra_obra():
    proprias = [_linha('ADAPTATION', 2, tipo='manga')]
    de_outras = [_linha('PREQUEL', 2, id_midia='m2')]

    assert {(r['relacao'], r['tipo']) for r in relacoes_da_midia(proprias, de_outras)} == {
        ('ADAPTATION', 'manga'), ('SEQUEL', 'anime'),
    }


@pytest.mark.parametrize('relacao', ['CHARACTER', 'OTHER', 'CODIGO_NOVO'])
def test_relacoes_fora_da_leitura_nao_saem(relacao):
    assert relacoes_da_midia([_linha(relacao, 2)], [_linha(relacao, 3, id_midia='m3')]) == []


def test_obra_adulta_nao_sai():
    adultas = [_linha('SEQUEL', 2, adulto=True)], [_linha('SEQUEL', 3, id_midia='m3', adulto=True)]
    assert relacoes_da_midia(*adultas) == []


@pytest.mark.parametrize('tipo, anilist_id, slug, link', [
    ('anime', 21, None, 'https://anilist.co/anime/21'),
    ('manga', 30002, None, 'https://anilist.co/manga/30002'),
    ('jogo', None, 'portal-2', 'https://rawg.io/games/portal-2'),
])
def test_obra_fora_do_catalogo_sai_com_o_link_da_fonte_e_sem_status(tipo, anilist_id, slug, link):
    [relacao] = relacoes_da_midia([_linha('MESMA_SERIE', anilist_id, tipo=tipo, slug=slug, status='completo')], [])

    assert (relacao['id_midia'], relacao['link_fonte'], relacao['status_consumo']) == (None, link, None)


def test_obra_do_catalogo_sai_sem_link():
    [relacao] = relacoes_da_midia([_linha('SEQUEL', 2, id_midia='m2', status='planejado')], [])

    assert (relacao['id_midia'], relacao['link_fonte'], relacao['status_consumo']) == ('m2', None, 'planejado')


def test_ordem_estavel_por_estreia_e_titulo():
    proprias = [
        _linha('SEQUEL', 3, titulo='C', data=date(2022, 1, 1)),
        _linha('ADAPTATION', 4, tipo='manga', titulo='B'),
        _linha('PREQUEL', 2, titulo='A', data=date(2020, 1, 1)),
    ]

    assert [r['titulo'] for r in relacoes_da_midia(proprias, [])] == ['A', 'C', 'B']
