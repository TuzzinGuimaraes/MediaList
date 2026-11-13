"""Contrato HTTP comum a todas as rotas: parâmetros, erros e serialização."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

import banco
from routes import avaliacoes as avaliacoes_routes
from routes import midias as midias_routes
from routes import usuario as usuario_routes

from .helpers import FakeBanco


@pytest.fixture
def busca(monkeypatch):
    chamadas = []

    def fake_buscar(tipo, pagina, limite, filtros):
        chamadas.append({'tipo': tipo, 'pagina': pagina, 'limite': limite})
        return []

    monkeypatch.setattr(midias_routes.midia_repository, 'buscar_por_tipo', fake_buscar)
    return chamadas


# ============================================
# Parâmetros de paginação
# ============================================

@pytest.mark.parametrize('rota', ['/api/midias', '/api/animes', '/api/mangas', '/api/jogos'])
def test_pagina_que_nao_e_numero_responde_400(client, rota):
    response = client.get(f'{rota}?pagina=abc')

    assert response.status_code == 400
    assert 'pagina' in response.get_json()['erro']


def test_pagina_zero_responde_400(client):
    response = client.get('/api/midias?pagina=0')

    assert response.status_code == 400


def test_por_pagina_acima_do_teto_vira_50(client, busca):
    response = client.get('/api/midias?por_pagina=999')

    assert response.status_code == 200
    assert response.get_json()['por_pagina'] == 50
    assert busca[0]['limite'] == 50


def test_paginacao_padrao(client, busca):
    response = client.get('/api/midias')

    assert response.get_json()['pagina'] == 1
    assert busca[0] == {'tipo': None, 'pagina': 1, 'limite': 20}


def test_limite_invalido_no_trending_responde_400(client):
    assert client.get('/api/midias/trending?limite=dez').status_code == 400


# ============================================
# Erros do banco
# ============================================

AVALIACAO = {'id_midia': '0190a3b2-0000-7000-8000-000000000001', 'nota': 8}


@pytest.fixture
def com_midia(monkeypatch):
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id})


@pytest.mark.parametrize('erro, status', [
    (banco.Conflito('Registro já existe'), 409),
    (banco.Integridade('Dados inválidos'), 400),
    (banco.Indisponivel('Banco indisponível'), 503),
])
def test_erro_de_banco_ao_gravar_nao_vira_201(client, auth_headers, monkeypatch, com_midia, erro, status):
    FakeBanco({'INSERT INTO avaliacoes': erro}).instalar(monkeypatch, avaliacoes_routes)

    response = client.post('/api/avaliacoes', headers=auth_headers, json=AVALIACAO)

    assert response.status_code == status
    assert 'erro' in response.get_json()


def test_erro_inesperado_responde_500_sem_detalhe(client, auth_headers, monkeypatch, com_midia, caplog):
    FakeBanco({'INSERT INTO avaliacoes': RuntimeError('relation "avaliacoes" segredo interno')}).instalar(
        monkeypatch, avaliacoes_routes
    )

    response = client.post('/api/avaliacoes', headers=auth_headers, json=AVALIACAO)

    assert response.status_code == 500
    assert response.get_json() == {'erro': 'Erro interno do servidor'}
    assert 'segredo interno' in caplog.text


def test_rota_inexistente_continua_404(client):
    assert client.get('/api/nao-existe').status_code == 404


def test_metodo_nao_permitido_continua_405(client):
    assert client.delete('/api/health').status_code == 405


# ============================================
# Serialização
# ============================================

def test_json_com_datas_iso_e_numeros(client, auth_headers, monkeypatch):
    id_usuario = uuid.UUID('0190a3b2-0000-7000-8000-0000000000aa')
    FakeBanco({'vw_perfil_usuario': {
        'id_usuario': id_usuario,
        'data_cadastro': datetime(2026, 11, 13, 10, 30, tzinfo=timezone.utc),
        'data_nascimento': date(2000, 1, 2),
        'nota_media_usuario': Decimal('8.50'),
        'total_midias': 3,
    }}).instalar(monkeypatch, usuario_routes)

    perfil = client.get('/api/usuario/perfil', headers=auth_headers).get_json()['perfil']

    assert perfil == {
        'id_usuario': '0190a3b2-0000-7000-8000-0000000000aa',
        'data_cadastro': '2026-11-13T10:30:00+00:00',
        'data_nascimento': '2000-01-02',
        'nota_media_usuario': 8.5,
        'total_midias': 3,
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
