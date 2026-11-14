"""Nota média, Nota da fonte e a ordenação "mais bem avaliadas" no PostgreSQL real.

A Nota média é calculada na leitura (vw_notas_midia): criar, editar e apagar
Avaliação muda a média sem ninguém gravá-la. "Mais bem avaliadas" ordena por
COALESCE(nota_media, nota_fonte). Usa TEST_DATABASE_URL; sem ela, pula.
"""
import random
import uuid
from decimal import Decimal

import pytest

import banco
from repositories import Catalogo

from .test_repositorios_pg import TEST_DATABASE_URL, _usuario, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as notas'
)


def _midia(pg, tipo, prefixo, nota_fonte=None, **dados):  # noqa: F811
    id_midia = Catalogo().criar(
        tipo, {'titulo_original': f'{prefixo} {uuid.uuid4().hex}', **dados}
    )
    pg['midias'].append(id_midia)
    if nota_fonte is not None:
        # Só a Importação grava a Nota da fonte: aqui o teste faz o papel dela.
        banco.executar('UPDATE midias SET nota_fonte = %s WHERE id_midia = %s', (nota_fonte, id_midia))
    return id_midia


def _avaliar(usuario, id_midia, nota):
    banco.executar('INSERT INTO avaliacoes (id_usuario, id_midia, nota) VALUES (%s, %s, %s)', (usuario, id_midia, nota))


def _anilist_id():
    return random.randint(10**8, 2 * 10**9)


@pytest.fixture
def prefixo():
    return f'NOTA{uuid.uuid4().hex[:8]}'


def test_midia_sai_com_nota_da_fonte_e_a_origem_dela(pg, prefixo):  # noqa: F811
    anime = _midia(pg, 'anime', prefixo, nota_fonte=8.4, anilist_id=_anilist_id())
    manga = _midia(pg, 'manga', prefixo, nota_fonte=7, anilist_id=_anilist_id(), autor='X')
    jogo = _midia(pg, 'jogo', prefixo, nota_fonte=9.1, rawg_slug=f'jogo-{uuid.uuid4().hex}')
    sem_fonte = _midia(pg, 'anime', prefixo)
    repo = Catalogo()

    assert (repo.obter(anime)['nota_fonte'], repo.obter(anime)['origem_nota']) == (
        Decimal('8.4'), 'AniList',
    )
    assert repo.obter(manga)['origem_nota'] == 'AniList'
    assert (repo.obter(jogo)['nota_fonte'], repo.obter(jogo)['origem_nota']) == (Decimal('9.1'), 'RAWG')
    assert (repo.obter(sem_fonte)['nota_fonte'], repo.obter(sem_fonte)['origem_nota']) == (None, None)
    # A Nota da fonte não vira Nota média.
    assert repo.obter(anime)['nota_media'] is None


def test_mais_bem_avaliadas_usa_a_nota_da_fonte_como_fallback(pg, prefixo):  # noqa: F811
    usuario = _usuario(pg)
    media_alta_fonte_baixa = _midia(pg, 'anime', prefixo, nota_fonte=1, anilist_id=_anilist_id())
    so_fonte = _midia(pg, 'anime', prefixo, nota_fonte=9, anilist_id=_anilist_id())
    media_baixa = _midia(pg, 'anime', prefixo)
    sem_nota = _midia(pg, 'anime', prefixo)
    _avaliar(usuario, media_alta_fonte_baixa, 9.5)
    _avaliar(usuario, media_baixa, 6)

    listagem = Catalogo().buscar('anime', limite=50, filtros={'busca': prefixo, 'ordem': 'nota_media'})

    assert [m['id_midia'] for m in listagem] == [media_alta_fonte_baixa, so_fonte, media_baixa, sem_nota]


def test_rotas_de_ranking_ordenam_com_fallback_e_trazem_a_origem(pg, prefixo, client):  # noqa: F811
    usuario = _usuario(pg)
    so_fonte = _midia(pg, 'jogo', prefixo, nota_fonte=9.9, rawg_slug=f'jogo-{uuid.uuid4().hex}')
    avaliada = _midia(pg, 'jogo', prefixo)
    _avaliar(usuario, avaliada, 9.8)
    # Populares: as duas na Lista de um Usuário, mesma Popularidade; a nota desempata.
    for id_midia in (avaliada, so_fonte):
        banco.executar(
            "INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo) VALUES (%s, %s, 'na_fila')",
            (usuario, id_midia),
        )

    midias = client.get(f'/api/midias?tipo=jogo&busca={prefixo}&ordem=nota_media').get_json()['midias']
    assert [m['id_midia'] for m in midias] == [so_fonte, avaliada]
    assert (midias[0]['nota_fonte'], midias[0]['origem_nota'], midias[0]['nota_media']) == (9.9, 'RAWG', None)

    populares = client.get('/api/midias/populares?tipo=jogo').get_json()['midias']
    nossos = [m for m in populares if m['id_midia'] in (so_fonte, avaliada)]
    assert [m['id_midia'] for m in nossos] == [so_fonte, avaliada]
    assert nossos[0]['origem_nota'] == 'RAWG' and nossos[1]['origem_nota'] is None


def test_nota_media_recalculada_ao_criar_editar_e_apagar_avaliacao(pg, prefixo, client, make_token):  # noqa: F811
    anime = _midia(pg, 'anime', prefixo, nota_fonte=5, anilist_id=_anilist_id())
    ana, bia = _usuario(pg), _usuario(pg)
    cabecalho = {u: {'Authorization': f'Bearer {make_token(u)}'} for u in (ana, bia)}

    def notas():
        midia = client.get(f'/api/midias/{anime}').get_json()
        return midia['nota_media'], midia['total_avaliacoes'], midia['nota_fonte']

    criada = client.post('/api/avaliacoes', headers=cabecalho[ana], json={'id_midia': anime, 'nota': 8})
    assert criada.status_code == 201 and criada.get_json()['nota_media_atualizada'] == 8.0
    id_ana = criada.get_json()['id_avaliacao']
    client.post('/api/avaliacoes', headers=cabecalho[bia], json={'id_midia': anime, 'nota': '9,5'})
    assert notas() == (8.75, 2, 5.0)

    editada = client.put(f'/api/avaliacoes/{id_ana}', headers=cabecalho[ana], json={'nota': 10})
    assert editada.get_json()['nota_media_atualizada'] == 9.75
    assert notas() == (9.75, 2, 5.0)

    recusada = client.put(f'/api/avaliacoes/{id_ana}', headers=cabecalho[ana], json={'nota': 8.55})
    assert recusada.status_code == 400
    assert notas() == (9.75, 2, 5.0)

    client.delete(f'/api/avaliacoes/{id_ana}', headers=cabecalho[ana])
    assert notas() == (9.5, 1, 5.0)

    id_bia = client.get(f'/api/avaliacoes/{anime}').get_json()['itens'][0]['id_avaliacao']
    client.delete(f'/api/avaliacoes/{id_bia}', headers=cabecalho[bia])
    # Sem Avaliações a Nota média é NULL (não 0); a Nota da fonte fica.
    assert notas() == (None, None, 5.0)



def test_avaliacao_repetida_responde_409_e_nao_muda_a_nota(pg, prefixo, client, make_token):  # noqa: F811
    anime = _midia(pg, 'anime', prefixo, anilist_id=_anilist_id())
    ana = _usuario(pg)
    cabecalho = {'Authorization': f'Bearer {make_token(ana)}'}

    assert client.post('/api/avaliacoes', headers=cabecalho, json={'id_midia': anime, 'nota': 8}).status_code == 201
    repetida = client.post('/api/avaliacoes', headers=cabecalho, json={'id_midia': anime, 'nota': 3})

    assert repetida.status_code == 409
    assert repetida.get_json() == {'erro': 'Você já avaliou esta mídia', 'codigo': 'conflito'}
    assert client.get(f'/api/midias/{anime}').get_json()['nota_media'] == 8.0
