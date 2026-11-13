from datetime import datetime, timezone

import pytest

from routes import midias as midias_routes

from .helpers import FakeBanco


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


ANIME_X = {'tipo': 'anime', 'titulo_portugues': 'Anime X'}


def _midia(monkeypatch, midia):
    monkeypatch.setattr(
        midias_routes.midia_repository, 'buscar_por_id', lambda _id: midia and {'id_midia': _id, **midia},
    )
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})


def test_post_atualizacao_grava_e_notifica_quem_tem_a_midia_na_mesma_transacao(client, admin_headers, monkeypatch):
    _midia(monkeypatch, ANIME_X)
    fake = FakeBanco({
        'INSERT INTO atualizacoes_midia': {'id_atualizacao': 'ATU-1'},
        'INSERT INTO notificacoes': 2,
    }).instalar(monkeypatch, midias_routes)

    response = client.post('/api/midias/MID-1/atualizacoes', headers=admin_headers, json={
        'tipo': 'episodio',
        'titulo': 'Episodio 12',
        'descricao': 'Saiu hoje',
        'dados_adicionais': {'episodio': 12},
    })

    assert response.status_code == 201
    assert response.get_json() == {'mensagem': 'Atualização adicionada!', 'notificacoes_enviadas': 2}
    assert fake.transacoes == 1
    assert [metodo for metodo, _, _ in fake.chamadas] == ['consultar_um', 'executar']
    assert fake.sql('INSERT INTO atualizacoes_midia')[0][2] == (
        'MID-1', 'episodio', 'Episodio 12', 'Saiu hoje', '{"episodio": 12}',
    )
    assert fake.sql('INSERT INTO notificacoes')[0][2] == ('ATU-1', 'MID-1', ['assistindo', 'planejado'])


def test_post_atualizacao_de_midia_inexistente_responde_404_sem_gravar(client, admin_headers, monkeypatch):
    _midia(monkeypatch, None)
    fake = FakeBanco().instalar(monkeypatch, midias_routes)

    response = client.post('/api/midias/MID-404/atualizacoes', headers=admin_headers, json={
        'tipo': 'episodio', 'titulo': 'X',
    })

    assert response.status_code == 404
    assert fake.chamadas == []


def test_post_atualizacao_sem_tipo_ou_titulo_responde_400(client, admin_headers, monkeypatch):
    _midia(monkeypatch, ANIME_X)
    fake = FakeBanco().instalar(monkeypatch, midias_routes)

    response = client.post('/api/midias/MID-1/atualizacoes', headers=admin_headers, json={'tipo': 'episodio'})

    assert response.status_code == 400
    assert fake.chamadas == []


def test_detalhe_da_midia_traz_as_dez_atualizacoes_mais_recentes(client, monkeypatch):
    _midia(monkeypatch, ANIME_X)
    atualizacao = {
        'id_midia': 'MID-1', 'tipo_midia': 'anime', 'tipo_atualizacao': 'episodio', 'titulo': 'Ep 12',
        'descricao': None, 'dados_adicionais': {}, 'data_atualizacao': datetime(2026, 11, 13, tzinfo=timezone.utc),
    }
    fake = FakeBanco({'FROM atualizacoes_midia': [atualizacao]}).instalar(monkeypatch, midias_routes)

    response = client.get('/api/midias/MID-1')

    assert response.get_json()['atualizacoes'] == [{**atualizacao, 'data_atualizacao': '2026-11-13T00:00:00+00:00'}]
    _, sql, params = fake.sql('FROM atualizacoes_midia')[0]
    assert params == ('MID-1',)
    assert 'LIMIT 10' in sql


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
