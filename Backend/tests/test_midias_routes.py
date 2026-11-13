"""Rotas de /midias com o Catálogo e as Atualizações trocados por falsos em memória.

O SQL do Catálogo é provado contra o PostgreSQL em `test_repositorios_pg.py` e
`test_notas_pg.py`; aqui só o que a rota faz: ler parâmetros, chamar, responder.
"""
import pytest

from routes import midias as midias_routes

from .helpers import FakeAtualizacoes, FakeCatalogo

ANIME_X = {'tipo': 'anime', 'titulo_portugues': 'Anime X'}


@pytest.fixture
def catalogo(monkeypatch):
    def _instalar(midias=None, **extra):
        falso = FakeCatalogo(midias if midias is not None else {'MID-1': dict(ANIME_X)}, **extra)
        monkeypatch.setattr(midias_routes, 'catalogo', falso)
        return falso

    return _instalar


@pytest.fixture
def atualizacoes(monkeypatch):
    def _instalar(**dados):
        falso = FakeAtualizacoes(**dados)
        monkeypatch.setattr(midias_routes, 'atualizacoes', falso)
        return falso

    return _instalar


@pytest.fixture
def admin(monkeypatch, admin_headers):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    return admin_headers


def test_get_midias_repassa_filtros_ao_catalogo(client, catalogo):
    falso = catalogo({'MID-J': {'tipo': 'jogo'}})

    response = client.get(
        '/api/midias?tipo=jogo&pagina=1&por_pagina=15&busca=zelda&genero=Aventura'
        '&status=lancado&plataforma=Switch&desenvolvedor=Nintendo&modo_jogo=single&ordem=titulo'
    )

    assert response.status_code == 200
    assert response.get_json() == {
        'midias': [{'id_midia': 'MID-J', 'tipo': 'jogo'}], 'tipo': 'jogo', 'pagina': 1, 'por_pagina': 15,
    }
    assert falso.chamadas == [('buscar', 'jogo', 1, 15, {
        'busca': 'zelda', 'genero': 'Aventura', 'status': 'lancado', 'autor': None, 'estudio': None,
        'demografia': None, 'plataforma': 'Switch', 'desenvolvedor': 'Nintendo', 'modo_jogo': 'single',
        'artista': None, 'ordem': 'titulo',
    })]


def test_get_midias_sem_ordem_usa_nota_media(client, catalogo):
    falso = catalogo()

    client.get('/api/midias')

    assert falso.chamadas[0][4]['ordem'] == 'nota_media'


def test_detalhe_traz_as_atualizacoes_recentes(client, catalogo, atualizacoes):
    catalogo()
    falso = atualizacoes(recentes=[{'titulo': 'Ep 12'}])

    response = client.get('/api/midias/MID-1')

    assert response.status_code == 200
    assert response.get_json() == {**ANIME_X, 'id_midia': 'MID-1', 'atualizacoes': [{'titulo': 'Ep 12'}]}
    assert falso.chamadas == [('recentes', 'MID-1')]


def test_detalhe_de_midia_inexistente_responde_404(client, catalogo):
    catalogo({})

    response = client.get('/api/midias/MID-404')

    assert (response.status_code, response.get_json()) == (404, {'erro': 'Mídia não encontrada'})


def test_put_midia_atualiza_campos_validos(client, admin, catalogo):
    falso = catalogo()

    response = client.put('/api/midias/MID-1', headers=admin, json={
        'titulo_original': 'Novo titulo', 'numero_episodios': 24,
    })

    assert (response.status_code, response.get_json()) == (200, {'mensagem': 'Mídia atualizada com sucesso'})
    assert falso.chamadas == [('atualizar', 'MID-1', {'titulo_original': 'Novo titulo', 'numero_episodios': 24})]


@pytest.mark.parametrize('tipo', ['anime', 'manga', 'jogo'])
def test_put_midia_nao_grava_notas(client, admin, catalogo, tipo):
    """Nota média é calculada das Avaliações; Nota da fonte só a Importação grava."""
    falso = catalogo({'MID-1': {'tipo': tipo}})

    response = client.put('/api/midias/MID-1', headers=admin, json={
        'titulo_original': 'Novo titulo', 'nota_media': 9.9, 'nota_fonte': 1, 'total_avaliacoes': 3,
    })

    assert response.status_code == 200
    assert falso.chamadas == [('atualizar', 'MID-1', {'titulo_original': 'Novo titulo'})]


def test_put_midia_rejeita_payload_invalido(client, admin, catalogo):
    falso = catalogo()

    response = client.put('/api/midias/MID-1', headers=admin, json={'numero_episodios': 'vinte'})

    assert response.status_code == 400
    assert response.get_json()['erro'] == 'Payload inválido'
    assert falso.chamadas == []


def test_put_midia_inexistente_responde_404(client, admin, catalogo):
    catalogo({})

    assert client.put('/api/midias/MID-404', headers=admin, json={'titulo_original': 'X'}).status_code == 404


def test_delete_midia(client, admin, catalogo):
    falso = catalogo()

    assert client.delete('/api/midias/MID-1', headers=admin).get_json() == {'mensagem': 'Mídia removida com sucesso'}
    response = client.delete('/api/midias/MID-1', headers=admin)

    assert (response.status_code, response.get_json()) == (404, {'erro': 'Mídia não encontrada'})
    assert falso.midias == {}


def test_escrita_no_catalogo_exige_permissao(client, auth_headers, catalogo, monkeypatch):
    falso = catalogo()
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'usuario'})

    assert client.put('/api/midias/MID-1', headers=auth_headers, json={'titulo_original': 'X'}).status_code == 403
    assert client.delete('/api/midias/MID-1', headers=auth_headers).status_code == 403
    assert falso.chamadas == []


def test_post_atualizacao_publica_com_o_tipo_da_midia(client, admin, catalogo, atualizacoes):
    catalogo()
    falso = atualizacoes(notificados=2)

    response = client.post('/api/midias/MID-1/atualizacoes', headers=admin, json={
        'tipo': 'episodio', 'titulo': 'Episodio 12', 'descricao': 'Saiu hoje', 'dados_adicionais': {'episodio': 12},
    })

    assert response.status_code == 201
    assert response.get_json() == {'mensagem': 'Atualização adicionada!', 'notificacoes_enviadas': 2}
    assert falso.chamadas == [
        ('publicar', 'MID-1', 'anime', 'episodio', 'Episodio 12', 'Saiu hoje', {'episodio': 12}),
    ]


@pytest.mark.parametrize('midias, corpo, status, erro', [
    ({}, {'tipo': 'episodio', 'titulo': 'X'}, 404, 'Mídia não encontrada'),
    (None, {'tipo': 'episodio'}, 400, 'Tipo e título são obrigatórios'),
    (None, {'tipo': 'episodio', 'titulo': 'X', 'dados_adicionais': [1]}, 400, 'dados_adicionais deve ser um objeto'),
])
def test_post_atualizacao_invalida_nao_publica(client, admin, catalogo, atualizacoes, midias, corpo, status, erro):
    catalogo(midias)
    falso = atualizacoes()

    response = client.post('/api/midias/MID-1/atualizacoes', headers=admin, json=corpo)

    assert (response.status_code, response.get_json()) == (status, {'erro': erro})
    assert falso.chamadas == []


def test_get_distribuicao(client, catalogo):
    distribuicao = [{'status_consumo': 'assistindo', 'total': 3}, {'status_consumo': 'completo', 'total': 1}]
    falso = catalogo(distribuicao=distribuicao)

    response = client.get('/api/midias/MID-1/distribuicao')

    assert (response.status_code, response.get_json()) == (200, {'distribuicao': distribuicao})
    assert falso.chamadas == [('distribuicao', 'MID-1')]


def test_trending_ordena_por_nota_e_limita_ao_teto(client, catalogo):
    falso = catalogo()

    response = client.get('/api/midias/trending?tipo=anime&limite=99')

    assert response.status_code == 200
    assert response.get_json() == {'midias': [{**ANIME_X, 'id_midia': 'MID-1'}]}
    assert falso.chamadas == [('buscar', 'anime', 1, 50, {'ordem': 'nota_media'})]


def test_trending_sem_tipo_e_anime(client, catalogo):
    falso = catalogo()

    client.get('/api/midias/trending')

    assert falso.chamadas == [('buscar', 'anime', 1, 10, {'ordem': 'nota_media'})]
