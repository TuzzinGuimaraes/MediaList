"""Estatísticas do perfil pela rota, com o PostgreSQL real: cada Rótulo de cada Tipo conta onde deve.

Concluídos = Concluído + Platinado; Em andamento = Em progresso. Usa TEST_DATABASE_URL; sem ela, pula.
"""
import pytest

from repositories.itens_lista import ItensLista
from schemas.estado_consumo import CONCLUIDO, EM_PROGRESSO, PLATINADO, ROTULOS_POR_TIPO

from .test_contrato_rotas_pg import entrar  # noqa: F401 (fixture)
from .test_repositorios_pg import TEST_DATABASE_URL, _midia, _usuario, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL')


def test_cada_rotulo_de_cada_tipo_conta_nos_concluidos_ou_em_andamento(client, pg, entrar):  # noqa: F811
    usuario = _usuario(pg)
    itens = ItensLista()
    esperado = {}
    for tipo, rotulos in ROTULOS_POR_TIPO.items():
        for rotulo in rotulos.values():
            itens.criar_item(usuario, _midia(pg, tipo), {'status_consumo': rotulo})
        esperado[tipo] = {
            'total_midias': len(rotulos),
            'concluidos': sum(estado in (CONCLUIDO, PLATINADO) for estado in rotulos),
            'em_andamento': sum(estado == EM_PROGRESSO for estado in rotulos),
        }

    resposta = client.get('/api/usuario/estatisticas', headers=entrar(usuario))

    assert resposta.status_code == 200
    obtido = {
        e['tipo']: {chave: e[chave] for chave in ('total_midias', 'concluidos', 'em_andamento')}
        for e in resposta.get_json()['estatisticas']
    }
    assert obtido == esperado
    assert esperado == {
        'anime': {'total_midias': 5, 'concluidos': 1, 'em_andamento': 1},
        'manga': {'total_midias': 5, 'concluidos': 1, 'em_andamento': 1},
        'jogo': {'total_midias': 6, 'concluidos': 2, 'em_andamento': 1},
    }
