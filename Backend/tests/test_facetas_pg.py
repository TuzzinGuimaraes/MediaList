"""Facetas do catálogo (`GET /midias/facetas`, Q78 do ticket 19): plataformas e estúdios
distintos, no PostgreSQL real.

Usa TEST_DATABASE_URL; sem ela, pula. O banco pode ter outras Mídias: os testes conferem
os valores que criam, a ordem entre eles e que nenhum se repete.
"""
import uuid

import pytest

from repositories import Catalogo

from .test_repositorios_pg import TEST_DATABASE_URL

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as facetas'
)


@pytest.fixture
def prefixo():
    return f'FAC{uuid.uuid4().hex[:8]}'


def _midia(pg, tipo, **dados):  # noqa: F811
    id_midia = Catalogo().criar(tipo, {'titulo_original': f'Faceta {uuid.uuid4().hex}', **dados})
    pg['midias'].append(id_midia)
    return id_midia


def _nossos(lista, prefixo):
    return [valor for valor in lista if valor.startswith(prefixo)]


def test_facetas_dos_jogos_trazem_as_plataformas_distintas_e_ordenadas(client, pg, prefixo):  # noqa: F811
    _midia(pg, 'jogo', plataformas=f'{prefixo} Switch, {prefixo} PC')
    _midia(pg, 'jogo', plataformas=f'{prefixo} PC')
    _midia(pg, 'anime', estudio=f'{prefixo} Bones')

    resposta = client.get('/api/midias/facetas?tipo=jogo')

    assert resposta.status_code == 200
    corpo = resposta.get_json()
    assert _nossos(corpo['plataformas'], prefixo) == [f'{prefixo} PC', f'{prefixo} Switch']
    assert len(corpo['plataformas']) == len(set(corpo['plataformas']))
    assert corpo['estudios'] == []


def test_facetas_dos_animes_trazem_os_estudios_e_nenhuma_plataforma(client, pg, prefixo):  # noqa: F811
    _midia(pg, 'anime', estudio=f'{prefixo} Madhouse')
    _midia(pg, 'anime', estudio=f'{prefixo} Bones')
    _midia(pg, 'anime', estudio=f'{prefixo} Bones')
    _midia(pg, 'anime', estudio='')
    _midia(pg, 'jogo', plataformas=f'{prefixo} PC')

    corpo = client.get('/api/midias/facetas?tipo=anime').get_json()

    assert _nossos(corpo['estudios'], prefixo) == [f'{prefixo} Bones', f'{prefixo} Madhouse']
    assert '' not in corpo['estudios']
    assert len(corpo['estudios']) == len(set(corpo['estudios']))
    assert corpo['plataformas'] == []


def test_facetas_dos_mangas_vem_vazias(client, pg, prefixo):  # noqa: F811
    _midia(pg, 'anime', estudio=f'{prefixo} Bones')

    assert client.get('/api/midias/facetas?tipo=manga').get_json() == {
        'plataformas': [], 'estudios': [], 'temporada_mais_antiga': None,
    }


def test_facetas_sem_tipo_trazem_as_duas(client, pg, prefixo):  # noqa: F811
    _midia(pg, 'anime', estudio=f'{prefixo} Bones')
    _midia(pg, 'jogo', plataformas=f'{prefixo} PC')

    corpo = client.get('/api/midias/facetas').get_json()

    assert _nossos(corpo['estudios'], prefixo) == [f'{prefixo} Bones']
    assert _nossos(corpo['plataformas'], prefixo) == [f'{prefixo} PC']


def test_facetas_com_tipo_desconhecido_responde_400(client):
    resposta = client.get('/api/midias/facetas?tipo=livro')

    assert resposta.status_code == 400
    assert resposta.get_json()['codigo'] == 'dados_invalidos'
