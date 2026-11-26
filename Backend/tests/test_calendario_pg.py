"""Calendário da semana (spec `calendario`): `GET /midias/calendario` no PostgreSQL real.

Os episódios de uma janela: os já exibidos (Atualizações `episodio`) e os próximos
(`animes.proximo_episodio_em`, episódio `episodios_lancados + 1`). Usa TEST_DATABASE_URL; sem
ela, pula. O banco pode ter outros animes: as janelas ficam no ano 2700, que nenhum outro usa.
"""
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import pytest

import banco
from repositories import Catalogo
from repositories.atualizacoes import Atualizacoes

from .test_repositorios_pg import TEST_DATABASE_URL

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o Calendário'
)

INICIO = datetime(2700, 3, 1, 3, 0, tzinfo=UTC)
FIM = INICIO + timedelta(days=7)


def _midia(pg, tipo='anime', **dados):
    id_midia = Catalogo().criar(tipo, {'titulo_original': f'Calendário {uuid.uuid4().hex}', **dados})
    pg['midias'].append(id_midia)
    return id_midia


def _anime(pg, lancados=None, proximo_em=None, **dados):
    id_midia = _midia(pg, **dados)
    banco.executar(
        'UPDATE animes SET episodios_lancados = %s, proximo_episodio_em = %s WHERE id_midia = %s',
        (lancados, proximo_em, id_midia),
    )
    return id_midia


def _exibido(id_midia, episodio, quando):
    with banco.transacao() as t:
        Atualizacoes().publicar_episodio(t, id_midia, episodio, f'Episódio {episodio} foi ao ar', quando.isoformat())


def _calendario(client, headers, de=INICIO, ate=FIM):
    return client.get(f'/api/midias/calendario?{urlencode({"de": de.isoformat(), "ate": ate.isoformat()})}',
                      headers=headers)


def _nossos(corpo, ids):
    return [(e['id_midia'], e['episodio'], e['exibido']) for e in corpo['episodios'] if e['id_midia'] in ids]


def test_traz_exibidos_e_proximos_da_janela_em_ordem(client, pg, usuario):
    _, headers = usuario
    exibido = _anime(pg, lancados=4, proximo_em=INICIO + timedelta(days=8),
                     titulo_portugues='Exibido', poster_url='https://s4.anilist.co/capa.jpg')
    _exibido(exibido, 4, INICIO + timedelta(hours=5))
    proximo = _anime(pg, lancados=9, proximo_em=INICIO + timedelta(hours=2))
    estreia = _anime(pg, lancados=None, proximo_em=INICIO + timedelta(days=6))

    resposta = _calendario(client, headers)

    assert resposta.status_code == 200
    corpo = resposta.get_json()
    assert _nossos(corpo, {exibido, proximo, estreia}) == [
        (proximo, 10, False), (exibido, 4, True), (estreia, 1, False),
    ]
    episodio = next(e for e in corpo['episodios'] if e['id_midia'] == exibido)
    assert episodio == {
        'id_midia': exibido, 'tipo': 'anime', 'titulo_original': episodio['titulo_original'],
        'titulo_ingles': None, 'titulo_portugues': 'Exibido', 'poster_url': 'https://s4.anilist.co/capa.jpg',
        'episodio': 4, 'instante': '2700-03-01T08:00:00Z', 'exibido': True,
    }


def test_fora_da_janela_nao_vem(client, pg, usuario):
    _, headers = usuario
    antes = _anime(pg, lancados=1, proximo_em=INICIO - timedelta(minutes=1))
    _exibido(antes, 1, INICIO - timedelta(minutes=1))
    depois = _anime(pg, lancados=1, proximo_em=FIM)
    _exibido(depois, 2, FIM)
    sem_data = _anime(pg, lancados=3)

    corpo = _calendario(client, headers).get_json()

    assert _nossos(corpo, {antes, depois, sem_data}) == []


def test_exibido_e_proximo_do_mesmo_episodio_vem_uma_vez_so(client, pg, usuario):
    # O job gravou a Atualização do 5, mas o anime ainda aponta para ele como o próximo.
    _, headers = usuario
    anime = _anime(pg, lancados=4, proximo_em=INICIO + timedelta(hours=1))
    _exibido(anime, 5, INICIO + timedelta(hours=1))

    corpo = _calendario(client, headers).get_json()

    assert _nossos(corpo, {anime}) == [(anime, 5, True)]


def test_so_anime(client, pg, usuario):
    _, headers = usuario
    manga = _midia(pg, 'manga')
    _exibido(manga, 3, INICIO + timedelta(hours=1))

    corpo = _calendario(client, headers).get_json()

    assert _nossos(corpo, {manga}) == []


def test_exige_login(client, pg):
    assert _calendario(client, {}).status_code == 401


def test_atualizacao_episodio_fora_do_formato_fica_de_fora_sem_derrubar_o_calendario(client, pg, usuario):
    # A publicação manual (admin) aceita qualquer `dados_adicionais`.
    _, headers = usuario
    anime = _anime(pg)
    valido = _anime(pg)
    _exibido(valido, 2, INICIO + timedelta(hours=1))
    for dados in ({'episodio': 'sete', 'exibido_em': INICIO.isoformat()}, {'episodio': 3, 'exibido_em': 'ontem'},
                  {'episodio': 4}):
        Atualizacoes().publicar(anime, 'anime', 'episodio', 'Manual', dados_adicionais=dados)

    resposta = _calendario(client, headers)

    assert resposta.status_code == 200
    assert _nossos(resposta.get_json(), {anime, valido}) == [(valido, 2, True)]


@pytest.mark.parametrize('consulta', [
    {},
    {'de': INICIO.isoformat()},
    {'de': 'ontem', 'ate': FIM.isoformat()},
    {'de': '2700-03-01T03:00:00', 'ate': '2700-03-08T03:00:00'},
    {'de': FIM.isoformat(), 'ate': INICIO.isoformat()},
    {'de': INICIO.isoformat(), 'ate': INICIO.isoformat()},
    {'de': INICIO.isoformat(), 'ate': (INICIO + timedelta(days=8, seconds=1)).isoformat()},
])
def test_janela_invalida_ou_longa_demais_responde_400(client, pg, usuario, consulta):
    _, headers = usuario

    resposta = client.get(f'/api/midias/calendario?{urlencode(consulta)}', headers=headers)

    assert resposta.status_code == 400
    assert resposta.get_json()['codigo'] == 'dados_invalidos'


def test_janela_de_8_dias_vale(client, pg, usuario):
    _, headers = usuario

    assert _calendario(client, headers, ate=INICIO + timedelta(days=8)).status_code == 200
