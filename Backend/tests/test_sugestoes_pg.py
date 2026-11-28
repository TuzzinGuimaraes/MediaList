"""`GET /api/sugestoes` com o PostgreSQL real (spec `sugestoes`, ticket 02).

As obras e as recomendações entram pela Importação contra o AniList falso; a Lista do Usuário, por
SQL. Sem TEST_DATABASE_URL, pula. O Catálogo de teste pode ter outras Mídias (as do `seed_dev`, com
nota até 9,5): as obras do Em alta daqui têm Nota da fonte acima disso, e o resumo só olha as daqui.
"""
import pytest

import banco

from .helpers import criar_usuario
from .test_contrato_rotas_pg import CHAVES_MIDIA_CONTRATO
from .test_importacao_anilist_pg import (  # noqa: F401 (fixtures)
    BASE,
    TEST_DATABASE_URL,
    importar,
    pg,
)
from .test_recomendacoes_pg import _rec
from .test_relacoes_pg import _aresta, _id_midia, _importar_obras

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as Sugestões'
)


def _obra(anilist_id, *recomendacoes, relacoes=(), nota=None, **campos):
    """Obra do AniList falso com as recomendações, as Relações e a Nota da fonte (`meanScore`, 0–100)."""
    return (anilist_id, 1000 - anilist_id % 1000, {
        'relations': {'edges': list(relacoes)},
        'recommendations': {'nodes': list(recomendacoes)},
        **({'meanScore': nota} if nota is not None else {}),
        **campos,
    })


@pytest.fixture
def usuario(importar):  # noqa: F811
    """Um Usuário e o cabeçalho com o token dele; apagado no fim (a Lista vai em cascata)."""
    criados = {'usuarios': []}
    id_usuario = criar_usuario(criados)
    yield id_usuario
    for id_criado in criados['usuarios']:
        banco.executar('DELETE FROM usuarios WHERE id_usuario = %s', (id_criado,))


@pytest.fixture
def headers(usuario, make_token):
    return {'Authorization': f'Bearer {make_token(usuario)}'}


def _na_lista(id_usuario, tipo, anilist_id, *, nota=None, favorito=False, estado='completo'):
    banco.executar(
        'INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo, nota_usuario, favorito) '
        'VALUES (%s, %s, %s, %s, %s)',
        (id_usuario, _id_midia(tipo, anilist_id), estado, nota, favorito),
    )


def _sugestoes(client, headers, query=''):
    resposta = client.get(f'/api/sugestoes{query}', headers=headers)
    assert resposta.status_code == 200, resposta.get_json()
    return resposta.get_json()['sugestoes']


def _resumo(sugestoes):
    """(anilist_id, porque) de cada Sugestão daqui; o `anilist_id` sai do título 'Obra N' do AniList falso."""
    return [(int(s['titulo_original'].removeprefix('Obra ')), s['motivo']['porque'])
            for s in sugestoes if s['titulo_original'].startswith('Obra ')]


def _so_sugestoes(sugestoes):
    return [r for r in _resumo(sugestoes) if r[1] != 'em_alta']


def test_sem_sessao_401(client):
    assert client.get('/api/sugestoes').status_code == 401


def test_pontos_somam_entre_sementes_e_o_motivo_cita_a_mais_forte(client, importar, usuario, headers):  # noqa: F811
    _importar_obras(importar, 'anime', [
        _obra(BASE + 1, _rec('ANIME', BASE + 10, 100), _rec('ANIME', BASE + 11, 10),
              title={'romaji': f'Obra {BASE + 1}', 'english': 'Frieren'}),
        _obra(BASE + 2, _rec('ANIME', BASE + 11, 50)),
        _obra(BASE + 3, _rec('ANIME', BASE + 12, 500)),
        _obra(BASE + 10), _obra(BASE + 11), _obra(BASE + 12),
    ])
    _na_lista(usuario, 'anime', BASE + 1, nota=9)                 # B10: 900, B11: 90
    _na_lista(usuario, 'anime', BASE + 2, favorito=True)          # B11: +450 = 540
    _na_lista(usuario, 'anime', BASE + 3, nota=7.5)               # não é semente

    sugestoes = _sugestoes(client, headers)

    assert _so_sugestoes(sugestoes) == [(BASE + 10, 'nota'), (BASE + 11, 'favorito')]
    assert sugestoes[0]['motivo'] == {'porque': 'nota', 'nota': 9.0, 'titulo': 'Frieren'}
    assert sugestoes[1]['motivo'] == {'porque': 'favorito', 'nota': None, 'titulo': f'Obra {BASE + 2}'}
    assert set(sugestoes[0]) == CHAVES_MIDIA_CONTRATO | {'motivo'}


def test_exclusoes(client, importar, usuario, headers):  # noqa: F811
    _importar_obras(importar, 'manga', [_obra(BASE + 50, isAdult=True)])
    _importar_obras(importar, 'anime', [
        _obra(BASE + 1,
              _rec('ANIME', BASE + 10, 90),                 # fica
              _rec('ANIME', BASE + 11, 80),                 # na Lista (Abandonado)
              _rec('ANIME', BASE + 12, 70, adulto=True),    # adulta pela fonte
              _rec('ANIME', BASE + 13, 60),                 # adulta no Catálogo
              _rec('MANGA', BASE + 50, 60),                 # mangá adulto no Catálogo
              _rec('ANIME', BASE + 99, 50),                 # fora do Catálogo
              _rec('ANIME', BASE + 14, 40),                 # Sequência da semente
              _rec('ANIME', BASE + 15, 30),                 # aponta para a semente
              relacoes=[_aresta('SEQUEL', 'ANIME', BASE + 14)]),
        _obra(BASE + 10), _obra(BASE + 11), _obra(BASE + 12), _obra(BASE + 13), _obra(BASE + 14),
        _obra(BASE + 15, relacoes=[_aresta('SIDE_STORY', 'ANIME', BASE + 1)]),
    ])
    banco.executar("UPDATE animes SET classificacao_etaria = '18' WHERE anilist_id = %s", (BASE + 13,))
    _na_lista(usuario, 'anime', BASE + 1, nota=10)
    _na_lista(usuario, 'anime', BASE + 11, estado='abandonado')

    sugestoes = _sugestoes(client, headers)

    assert _so_sugestoes(sugestoes) == [(BASE + 10, 'nota')]
    # O Em alta que completa também deixa de fora o que está na Lista e o adulto do Catálogo.
    ids = [s['titulo_original'] for s in sugestoes]
    for fora in (BASE + 1, BASE + 11, BASE + 13, BASE + 50):
        assert f'Obra {fora}' not in ids


def test_recorte_por_tipo(client, importar, usuario, headers):  # noqa: F811
    _importar_obras(importar, 'manga', [_obra(BASE + 20, _rec('ANIME', BASE + 10, 10)), _obra(BASE + 21)])
    _importar_obras(importar, 'anime', [
        _obra(BASE + 1, _rec('ANIME', BASE + 10, 100), _rec('MANGA', BASE + 21, 50)), _obra(BASE + 10),
    ])
    _na_lista(usuario, 'anime', BASE + 1, nota=8)
    _na_lista(usuario, 'manga', BASE + 20, favorito=True)

    assert _so_sugestoes(_sugestoes(client, headers)) == [(BASE + 10, 'nota'), (BASE + 21, 'nota')]
    assert _so_sugestoes(_sugestoes(client, headers, '?tipo=anime')) == [(BASE + 10, 'nota')]
    assert _so_sugestoes(_sugestoes(client, headers, '?tipo=manga')) == [(BASE + 21, 'nota')]
    assert {s['tipo'] for s in _sugestoes(client, headers, '?tipo=manga')} == {'manga'}
    resposta = client.get('/api/sugestoes?tipo=jogo', headers=headers)
    assert resposta.status_code == 400
    assert resposta.get_json()['codigo'] == 'dados_invalidos'


def test_complemento_com_em_alta(client, importar, usuario, headers):  # noqa: F811
    _importar_obras(importar, 'manga', [_obra(BASE + 30, nota=99)])
    _importar_obras(importar, 'anime', [
        _obra(BASE + 1, _rec('ANIME', BASE + 10, 100), nota=100),
        _obra(BASE + 10, nota=99),
        _obra(BASE + 11, nota=97),
        _obra(BASE + 12, nota=98),
        _obra(BASE + 13, nota=100),
        _obra(BASE + 14, nota=96),
    ])
    banco.executar("UPDATE animes SET classificacao_etaria = '18' WHERE anilist_id = %s", (BASE + 13,))
    _na_lista(usuario, 'anime', BASE + 1, nota=9)

    sugestoes = _sugestoes(client, headers, '?tipo=anime')

    # Em alta pela nota (a Nota da fonte, sem Avaliações): sem a semente (na Lista), sem a adulta,
    # sem repetir a Sugestão.
    assert _resumo(sugestoes) == [
        (BASE + 10, 'nota'), (BASE + 12, 'em_alta'), (BASE + 11, 'em_alta'), (BASE + 14, 'em_alta'),
    ]
    assert sugestoes[1]['motivo'] == {'porque': 'em_alta', 'nota': None, 'titulo': None}
    assert {s['tipo'] for s in sugestoes} == {'anime'}
    assert (BASE + 30, 'em_alta') in _resumo(_sugestoes(client, headers))


def test_sem_sementes_so_em_alta_ate_12(client, importar, usuario, headers):  # noqa: F811
    # Duas Importações: a página do AniList falso tem 3 obras e a janela, 4 páginas.
    _importar_obras(importar, 'anime', [_obra(BASE + i, nota=96 + i % 5) for i in range(1, 8)])
    _importar_obras(importar, 'anime', [_obra(BASE + i, nota=96 + i % 5) for i in range(8, 15)])
    _na_lista(usuario, 'anime', BASE + 14, nota=7)

    sugestoes = _sugestoes(client, headers)

    assert len(sugestoes) == 12
    resumo = _resumo(sugestoes)
    assert len(resumo) == 12
    assert {porque for _, porque in resumo} == {'em_alta'}
    assert {i for i, _ in resumo} < {BASE + i for i in range(1, 14)}
