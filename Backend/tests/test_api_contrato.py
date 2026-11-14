"""Contrato HTTP comum a todas as rotas: parâmetros, erros e serialização."""
import json
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

import banco
from routes import avaliacoes as avaliacoes_routes
from routes import midias as midias_routes

from .helpers import FakeCatalogo


@pytest.fixture
def busca(monkeypatch):
    catalogo = FakeCatalogo()
    monkeypatch.setattr(midias_routes, 'catalogo', catalogo)
    return catalogo


# ============================================
# Parâmetros de paginação
# ============================================

def test_pagina_que_nao_e_numero_responde_400(client):
    response = client.get('/api/midias?pagina=abc')

    assert response.status_code == 400
    assert response.get_json()['detalhes'] == {'pagina': 'Tipo inválido'}


def test_pagina_zero_responde_400(client):
    response = client.get('/api/midias?pagina=0')

    assert response.status_code == 400


def test_por_pagina_acima_do_teto_vira_50(client, busca):
    response = client.get('/api/midias?por_pagina=999')

    assert response.status_code == 200
    assert response.get_json()['por_pagina'] == 50
    assert busca.chamadas[0][3] == 50


def test_paginacao_padrao(client, busca):
    response = client.get('/api/midias')

    assert response.get_json()['pagina'] == 1
    assert busca.chamadas[0][1:4] == (None, 1, 20)


def test_limite_invalido_no_trending_responde_400(client):
    assert client.get('/api/midias/trending?limite=dez').status_code == 400


# ============================================
# Erros do banco
# ============================================

AVALIACAO = {'id_midia': '0190a3b2-0000-7000-8000-000000000001', 'nota': 8}


@pytest.fixture
def avaliacao_que_falha(monkeypatch):
    """O módulo de Avaliação levantando o erro que o banco levantaria."""
    def _instalar(erro):
        class Falha:
            def criar(self, *_args):
                raise erro

        monkeypatch.setattr(avaliacoes_routes, 'avaliacoes', Falha())

    return _instalar


@pytest.mark.parametrize('erro, status', [
    (banco.Conflito('Registro já existe'), 409),
    (banco.Integridade('Dados inválidos'), 400),
    (banco.Indisponivel('Banco indisponível'), 503),
])
def test_erro_de_banco_ao_gravar_nao_vira_201(client, auth_headers, avaliacao_que_falha, erro, status):
    avaliacao_que_falha(erro)

    response = client.post('/api/avaliacoes', headers=auth_headers, json=AVALIACAO)

    assert response.status_code == status
    assert 'erro' in response.get_json()


def test_erro_inesperado_responde_500_sem_detalhe(client, auth_headers, avaliacao_que_falha, caplog):
    avaliacao_que_falha(RuntimeError('relation "avaliacoes" segredo interno'))

    response = client.post('/api/avaliacoes', headers=auth_headers, json=AVALIACAO)

    assert response.status_code == 500
    assert response.get_json() == {'erro': 'Erro interno do servidor', 'codigo': 'erro_interno'}
    assert 'segredo interno' in caplog.text


def test_rota_inexistente_continua_404(client):
    assert client.get('/api/nao-existe').status_code == 404


def test_metodo_nao_permitido_continua_405(client):
    response = client.delete('/api/health')

    assert response.status_code == 405
    assert response.get_json() == {'erro': 'Método não permitido', 'codigo': 'metodo_nao_permitido'}


# ============================================
# Serialização
# ============================================

def test_json_com_datas_iso_e_numeros(app):
    """Fora do contrato (rota sem modelo, `jsonify`): o provedor JSON do app."""
    with app.app_context():
        corpo = app.json.dumps({
            'id': uuid.UUID('0190a3b2-0000-7000-8000-0000000000aa'),
            'instante': datetime(2026, 11, 13, 10, 30, tzinfo=timezone.utc),
            'data': date(2000, 1, 2),
            'nota': Decimal('8.50'),
        })

    assert json.loads(corpo) == {
        'id': '0190a3b2-0000-7000-8000-0000000000aa',
        'instante': '2026-11-13T10:30:00+00:00',
        'data': '2000-01-02',
        'nota': 8.5,
    }



# ============================================
# Logs
# ============================================

def test_log_em_producao_sai_em_json():
    import json
    import logging

    from app import FormatoJSON

    registro = logging.LogRecord('routes.auth', logging.WARNING, __file__, 1, 'Falhou %s', ('x',), None)

    linha = json.loads(FormatoJSON().format(registro))

    assert linha['nivel'] == 'WARNING'
    assert linha['logger'] == 'routes.auth'
    assert linha['mensagem'] == 'Falhou x'
