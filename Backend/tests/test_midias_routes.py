import pytest

import database
from routes import midias as midias_routes

from .helpers import FakeBanco, FakeMongoCollection


def test_get_midias_repassa_filtros_ao_repository(client, monkeypatch):
    chamadas = []

    def fake_buscar(tipo, pagina, limite, filtros):
        chamadas.append((tipo, pagina, limite, filtros))
        return [{'id_midia': 'MID-1'}]

    monkeypatch.setattr(midias_routes.midia_repository, 'buscar_por_tipo', fake_buscar)

    response = client.get(
        '/api/midias?tipo=jogo&pagina=2&por_pagina=15&busca=zelda&genero=Aventura'
        '&status=lancado&plataforma=Switch&desenvolvedor=Nintendo&modo_jogo=single&ordem=titulo'
    )

    assert response.status_code == 200
    assert response.get_json()['midias'][0]['id_midia'] == 'MID-1'
    assert chamadas == [(
        'jogo',
        2,
        15,
        {
            'busca': 'zelda',
            'genero': 'Aventura',
            'status': 'lancado',
            'autor': None,
            'estudio': None,
            'demografia': None,
            'plataforma': 'Switch',
            'desenvolvedor': 'Nintendo',
            'modo_jogo': 'single',
            'artista': None,
            'ordem': 'titulo',
        },
    )]


def test_get_midia_por_id_normaliza_atualizacoes(client, monkeypatch):
    monkeypatch.setattr(midias_routes.midia_repository, 'buscar_por_id', lambda _id: {
        'id_midia': 'MID-1',
        'tipo': 'anime',
    })
    monkeypatch.setattr(midias_routes, '_carregar_atualizacoes', lambda _id: [{'titulo': 'Novo episodio'}])

    response = client.get('/api/midias/MID-1')

    assert response.status_code == 200
    assert response.get_json()['atualizacoes'][0]['titulo'] == 'Novo episodio'


def test_get_midia_por_id_retorna_404(client, monkeypatch):
    monkeypatch.setattr(midias_routes.midia_repository, 'buscar_por_id', lambda *_args, **_kwargs: None)

    response = client.get('/api/midias/MID-404')

    assert response.status_code == 404


def test_put_midia_atualiza_campos_validos(client, admin_headers, monkeypatch):
    monkeypatch.setattr(midias_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id, 'tipo': 'anime'})
    atualizados = []
    monkeypatch.setattr(
        midias_routes.midia_repository,
        'atualizar_midia_base',
        lambda id_midia, payload: atualizados.append((id_midia, payload)) or True,
    )
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})

    response = client.put('/api/midias/MID-1', headers=admin_headers, json={
        'titulo_original': 'Novo titulo',
        'numero_episodios': 24,
    })

    assert response.status_code == 200
    assert atualizados == [('MID-1', {'titulo_original': 'Novo titulo', 'numero_episodios': 24})]


@pytest.mark.parametrize('tipo', ['anime', 'manga', 'jogo'])
def test_put_midia_nao_grava_notas(client, admin_headers, monkeypatch, tipo):
    """Nota média é calculada das Avaliações; Nota da fonte só a Importação grava."""
    monkeypatch.setattr(midias_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id, 'tipo': tipo})
    atualizados = []
    monkeypatch.setattr(
        midias_routes.midia_repository,
        'atualizar_midia_base',
        lambda id_midia, payload: atualizados.append(payload) or True,
    )
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})

    response = client.put('/api/midias/MID-1', headers=admin_headers, json={
        'titulo_original': 'Novo titulo', 'nota_media': 9.9, 'nota_fonte': 1, 'total_avaliacoes': 3,
    })

    assert response.status_code == 200
    assert atualizados == [{'titulo_original': 'Novo titulo'}]


def test_put_midia_rejeita_payload_invalido(client, admin_headers, monkeypatch):
    monkeypatch.setattr(midias_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id, 'tipo': 'anime'})
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})

    response = client.put('/api/midias/MID-1', headers=admin_headers, json={'numero_episodios': 'vinte'})

    assert response.status_code == 400
    assert response.get_json()['erro'] == 'Payload inválido'


def test_delete_midia_retorna_404_quando_inexistente(client, admin_headers, monkeypatch):
    monkeypatch.setattr(midias_routes.midia_repository, 'deletar_midia', lambda _id: False)
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})

    response = client.delete('/api/midias/MID-404', headers=admin_headers)

    assert response.status_code == 404


def test_post_atualizacao_cria_notificacoes(client, admin_headers, monkeypatch):
    atualizacoes_collection = FakeMongoCollection()
    notificacoes_collection = FakeMongoCollection()
    database.mongo_db = object()
    database.atualizacoes_collection = atualizacoes_collection
    database.notificacoes_collection = notificacoes_collection

    monkeypatch.setattr(midias_routes.midia_repository, 'buscar_por_id', lambda _id: {
        'id_midia': _id,
        'tipo': 'anime',
        'titulo_portugues': 'Anime X',
    })
    FakeBanco({'FROM lista_usuarios': [
        {'id_usuario': 'USR-1'},
        {'id_usuario': 'USR-2'},
    ]}).instalar(monkeypatch, midias_routes)
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})

    response = client.post('/api/midias/MID-1/atualizacoes', headers=admin_headers, json={
        'tipo': 'episodio',
        'titulo': 'Episodio 12',
        'descricao': 'Saiu hoje',
    })

    data = response.get_json()
    assert response.status_code == 201
    assert data['notificacoes_enviadas'] == 2
    assert atualizacoes_collection.inserted[0]['titulo'] == 'Episodio 12'
    assert len(notificacoes_collection.inserted_many) == 2


def test_get_distribuicao_retorna_agregacao(client, monkeypatch):
    FakeBanco({'FROM lista_usuarios': [
        {'status_consumo': 'assistindo', 'total': 3},
        {'status_consumo': 'completo', 'total': 1},
    ]}).instalar(monkeypatch, midias_routes)

    response = client.get('/api/midias/MID-1/distribuicao')

    assert response.status_code == 200
    assert response.get_json()['distribuicao'] == [
        {'status_consumo': 'assistindo', 'total': 3},
        {'status_consumo': 'completo', 'total': 1},
    ]


def test_trending_limita_resultado(client, monkeypatch):
    chamadas = []
    monkeypatch.setattr(
        midias_routes.midia_repository,
        'buscar_por_tipo',
        lambda tipo, pagina, limite, filtros: (
            chamadas.append((tipo, pagina, limite, filtros)) or [{'id_midia': 'MID-1'}]
        ),
    )

    response = client.get('/api/midias/trending?tipo=anime&limite=99')

    assert response.status_code == 200
    assert chamadas == [('anime', 1, 50, {'ordem': 'nota_media'})]
