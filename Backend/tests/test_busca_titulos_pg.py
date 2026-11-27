"""Busca de GET /midias nos três Títulos e por relevância, no PostgreSQL real (spec `ajustes-titulos`).

Usa TEST_DATABASE_URL; sem ela, pula.
"""
import uuid

import pytest

import banco
from repositories import Catalogo

from .test_repositorios_pg import TEST_DATABASE_URL

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a busca'
)


@pytest.fixture
def marca():
    """Pedaço único dos títulos do teste, para a busca não achar Mídias de outros testes."""
    return f'q{uuid.uuid4().hex[:8]}'


def _midia(pg, nota_fonte=None, **titulos):
    id_midia = Catalogo().criar('anime', titulos)
    pg['midias'].append(id_midia)
    if nota_fonte is not None:
        banco.executar('UPDATE midias SET nota_fonte = %s WHERE id_midia = %s', (nota_fonte, id_midia))
    return id_midia


def _ids(client, busca, **consulta):
    corpo = client.get('/api/midias', query_string={'por_pagina': 50, 'busca': busca, **consulta}).get_json()
    return [m['id_midia'] for m in corpo['itens']]


@pytest.fixture
def fma(pg, marca):
    return _midia(
        pg,
        titulo_original=f'鋼の錬金術師 {marca}',
        titulo_romaji=f'Hagane no Renkinjutsushi: {marca} FULLMETAL ALCHEMIST',
        titulo_ingles=f'Fullmetal Alchemist: {marca} Brotherhood',
    )


@pytest.mark.parametrize('termo', [
    lambda marca: f'{marca} brotherhood',  # inglês, outra caixa
    lambda marca: f'RENKINJUTSUSHI: {marca.upper()}',  # romaji, outra caixa
    lambda marca: f'錬金術師 {marca}',  # japonês
])
def test_acha_pelos_tres_titulos_sem_caixa(client, fma, marca, termo):
    assert _ids(client, termo(marca)) == [fma]


def test_acha_sem_acento_nem_macron(client, pg, marca):
    shonen = _midia(pg, titulo_original=f'少年 {marca}', titulo_romaji=f'Shōnen {marca}', titulo_ingles=f'Ação {marca}')

    assert _ids(client, f'shonen {marca}') == [shonen]
    assert _ids(client, f'ACAO {marca}') == [shonen]
    assert _ids(client, f'ação {marca}') == [shonen]


def test_nao_acha_so_pela_sinopse(client, pg, marca):
    _midia(pg, titulo_original='Outro', sinopse=f'A sinopse cita {marca}.')

    assert _ids(client, f'{marca}') == []


def test_prefixo_do_titulo_vem_antes_de_quem_so_contem(client, pg, marca):
    contem = _midia(pg, nota_fonte=9.5, titulo_original=f'Zeta {marca}')
    prefixo = _midia(pg, nota_fonte=5, titulo_original='Alfa', titulo_romaji=f'{marca} Alfa')

    assert _ids(client, f'{marca}') == [prefixo, contem]
    # A ordem escolhida pelo Usuário continua valendo.
    assert _ids(client, f'{marca}', ordem='nota_fonte') == [contem, prefixo]


def test_ordem_alfabetica_e_pelo_titulo_exibido(client, pg, marca):
    # Pelo romaji, `b` viria antes; pelo título exibido (o inglês), `aa` vem antes de `b`.
    b = _midia(pg, titulo_original=f'{marca} z', titulo_romaji=f'{marca} a', titulo_ingles=f'{marca} b')
    aa = _midia(pg, titulo_original=f'{marca} y', titulo_romaji=f'{marca} aa', titulo_ingles='')

    assert _ids(client, f'{marca}', ordem='titulo') == [aa, b]
