"""Filtro por ano de GET /midias e o mapa de atividade de uma Mídia, pelo app, no PostgreSQL real.

Usa TEST_DATABASE_URL; sem ela, pula.
"""
import uuid
from datetime import date, timedelta

import pytest

import banco
from repositories import Catalogo

from .test_repositorios_pg import TEST_DATABASE_URL, _usuario, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o ano e a atividade'
)


@pytest.fixture
def prefixo():
    return f'ANO{uuid.uuid4().hex[:8]}'


def _midia(pg, prefixo, **dados):  # noqa: F811
    id_midia = Catalogo().criar('anime', {'titulo_original': f'{prefixo} {uuid.uuid4().hex}', **dados})
    pg['midias'].append(id_midia)
    return id_midia


def _ids(client, consulta):
    corpo = client.get(f'/api/midias?{consulta}&ordem=data_lancamento').get_json()
    return [m['id_midia'] for m in corpo['itens']], corpo['total']


def test_filtro_por_ano_inclui_os_extremos_e_o_total_acompanha(client, pg, prefixo):  # noqa: F811
    de_1999 = _midia(pg, prefixo, data_lancamento='1999-12-31')
    de_2000 = _midia(pg, prefixo, data_lancamento='2000-01-01')
    de_2005 = _midia(pg, prefixo, data_lancamento='2005-06-15')
    de_2010 = _midia(pg, prefixo, data_lancamento='2010-01-01')
    _midia(pg, prefixo)  # sem data: fica fora de qualquer filtro por ano

    assert _ids(client, f'busca={prefixo}&ano_min=2000&ano_max=2005') == ([de_2005, de_2000], 2)
    assert _ids(client, f'busca={prefixo}&ano_min=2005') == ([de_2010, de_2005], 2)
    assert _ids(client, f'busca={prefixo}&ano_max=1999') == ([de_1999], 1)
    assert _ids(client, f'busca={prefixo}&ano_min=2010&ano_max=2010') == ([de_2010], 1)
    assert _ids(client, f'busca={prefixo}&ano_min=&ano_max=')[1] == 5




def _dia(dias_atras):
    """Meio-dia de `dias_atras` antes de hoje no fuso da sessão: cai no dia certo ao virar date."""
    return banco.consultar_um("SELECT (CURRENT_DATE - %s) + time '12:00' AS instante", (dias_atras,))['instante']


def _na_lista(usuario, id_midia, adicao, conclusao=None):
    banco.executar(
        'INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo, data_adicao, data_conclusao) '
        "VALUES (%s, %s, 'completo', %s, CURRENT_DATE - %s::int)",
        (usuario, id_midia, _dia(adicao), conclusao),
    )


def _avaliada(usuario, id_midia, dias_atras):
    banco.executar(
        'INSERT INTO avaliacoes (id_usuario, id_midia, nota, data_avaliacao) VALUES (%s, %s, 8, %s)',
        (usuario, id_midia, _dia(dias_atras)),
    )


def test_atividade_soma_adicoes_avaliacoes_e_conclusoes_por_dia_nas_ultimas_52_semanas(client, pg, prefixo):  # noqa: F811
    hoje = banco.consultar_um('SELECT CURRENT_DATE AS hoje')['hoje']
    anime, outra = _midia(pg, prefixo), _midia(pg, prefixo)
    ana, bia, caio = _usuario(pg), _usuario(pg), _usuario(pg)
    # Ana: adicionou hoje; concluiu e avaliou há 10 dias.
    _na_lista(ana, anime, adicao=0, conclusao=10)
    _avaliada(ana, anime, 10)
    # Bia: adicionou no 1º dia da janela (há 363 dias); concluiu e avaliou fora dela.
    _na_lista(bia, anime, adicao=363, conclusao=364)
    _avaliada(bia, anime, 400)
    # Caio: adicionou há 10 dias, sem conclusão.
    _na_lista(caio, anime, adicao=10)
    # Atividade de outra Mídia não entra.
    _na_lista(ana, outra, adicao=0, conclusao=0)

    resposta = client.get(f'/api/midias/{anime}/atividade')

    assert resposta.status_code == 200
    assert resposta.get_json() == {
        'inicio': (hoje - timedelta(days=363)).isoformat(),
        'fim': hoje.isoformat(),
        'dias': [
            {'data': (hoje - timedelta(days=363)).isoformat(), 'total': 1},
            {'data': (hoje - timedelta(days=10)).isoformat(), 'total': 3},
            {'data': hoje.isoformat(), 'total': 1},
        ],
    }


def test_atividade_de_midia_sem_atividade_traz_a_janela_sem_dias(client, pg, prefixo):  # noqa: F811
    corpo = client.get(f'/api/midias/{_midia(pg, prefixo)}/atividade').get_json()

    assert corpo['dias'] == []
    assert date.fromisoformat(corpo['fim']) - date.fromisoformat(corpo['inicio']) == timedelta(days=363)


def test_atividade_de_midia_inexistente_responde_404(client, pg):  # noqa: F811
    resposta = client.get('/api/midias/00000000-0000-7000-8000-000000000000/atividade')

    assert resposta.status_code == 404
    assert resposta.get_json() == {'erro': 'Mídia não encontrada', 'codigo': 'nao_encontrado'}
