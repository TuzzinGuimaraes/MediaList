import database
from routes import animes as animes_routes
from routes import avaliacoes as avaliacoes_routes
from routes import jogos as jogos_routes
from routes import mangas as mangas_routes
from routes import moderacao as moderacao_routes
from routes import noticias as noticias_routes
from routes import preferencias as preferencias_routes
from routes import usuario as usuario_routes
from routes import utils as utils_routes

from .helpers import FakeMongoCollection


def test_put_avaliacao_atualiza_campos_e_retorna_nota_media(client, auth_headers, monkeypatch):
    chamadas = []

    def fake_execute(query, params=None, fetch=True):
        chamadas.append((query, params, fetch))
        if query.startswith('SELECT id_usuario, id_midia'):
            return [{'id_usuario': 'USR-TEST-0001', 'id_midia': 'MID-1'}]
        if query.startswith('SELECT nota_media'):
            return [{'nota_media': 8.7}]
        return None

    monkeypatch.setattr(avaliacoes_routes, 'execute_query', fake_execute)

    response = client.put('/api/avaliacoes/AVL-1', headers=auth_headers, json={
        'nota': 9,
        'titulo_avaliacao': 'Atualizada',
    })

    assert response.status_code == 200
    assert response.get_json()['nota_media_atualizada'] == 8.7
    assert any(query.startswith('UPDATE avaliacoes SET') for query, _params, _fetch in chamadas)


def test_delete_avaliacao_bloqueia_usuario_sem_permissao(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        avaliacoes_routes,
        'execute_query',
        lambda query, params=None, fetch=True: [{'id_usuario': 'USR-OUTRO'}] if query.startswith('SELECT id_usuario') else None,
    )
    monkeypatch.setattr(avaliacoes_routes, 'get_user_permissions', lambda _user_id: {'pode_moderar': 0})

    response = client.delete('/api/avaliacoes/AVL-1', headers=auth_headers)

    assert response.status_code == 403
    assert response.get_json()['erro'] == 'Sem permissão para deletar esta avaliação'


def test_usuario_permissoes_retorna_payload(client, auth_headers, monkeypatch):
    monkeypatch.setattr(usuario_routes, 'get_user_permissions', lambda _user_id: {
        'nivel_acesso': 'admin',
        'grupos': 'Administradores',
        'pode_criar': 1,
        'pode_editar': 1,
        'pode_deletar': 1,
        'pode_moderar': 1,
    })

    response = client.get('/api/usuario/permissoes', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()['permissoes']['nivel_acesso'] == 'admin'


def test_usuario_perfil_retorna_404_quando_view_nao_tem_registro(client, auth_headers, monkeypatch):
    monkeypatch.setattr(usuario_routes, 'execute_query', lambda *_args, **_kwargs: [])

    response = client.get('/api/usuario/perfil', headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json()['erro'] == 'Perfil não encontrado'


def test_preferencias_update_salva_campos_validos(client, auth_headers):
    preferencias = FakeMongoCollection([
        {'id_usuario': 'USR-TEST-0001', 'tema': 'light', 'idioma': 'pt-BR', 'notificacoes_ativas': True},
    ])
    database.mongo_db = object()
    database.preferencias_collection = preferencias

    response = client.put('/api/preferencias', headers=auth_headers, json={
        'tema': 'dark',
        'notificacoes_ativas': False,
    })

    assert response.status_code == 200
    assert response.get_json()['modificado'] is True
    assert preferencias.items[0]['tema'] == 'dark'
    assert preferencias.items[0]['notificacoes_ativas'] is False


def test_noticias_lista_registros_do_mongo(client):
    noticias = FakeMongoCollection([
        {'titulo': 'Notícia A', 'categoria': 'geral'},
        {'titulo': 'Notícia B', 'categoria': 'anime'},
    ])
    database.mongo_db = object()
    database.noticias_collection = noticias

    response = client.get('/api/noticias?limite=1')

    assert response.status_code == 200
    assert response.get_json()['noticias'][0]['titulo'] == 'Notícia A'


def test_noticias_rejeita_criacao_sem_titulo(client, admin_headers, monkeypatch):
    database.mongo_db = object()
    database.noticias_collection = FakeMongoCollection()
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})

    response = client.post('/api/noticias', headers=admin_headers, json={'conteudo': 'Sem título'})

    assert response.status_code == 400
    assert response.get_json()['erro'] == 'Título é obrigatório'


def test_moderacao_lista_avaliacoes_para_admin(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    monkeypatch.setattr(moderacao_routes, 'execute_query', lambda *_args, **_kwargs: [{'id_avaliacao': 'AVL-1'}])

    response = client.get('/api/moderacao/avaliacoes', headers=admin_headers)

    assert response.status_code == 200
    assert response.get_json()['avaliacoes'][0]['id_avaliacao'] == 'AVL-1'


def test_utils_notificacoes_filtra_nao_lidas(client, auth_headers):
    notificacoes = FakeMongoCollection([
        {'id_usuario': 'USR-TEST-0001', 'titulo': 'Lida', 'lida': True},
        {'id_usuario': 'USR-TEST-0001', 'titulo': 'Nova', 'lida': False},
        {'id_usuario': 'USR-OUTRO', 'titulo': 'Outro usuário', 'lida': False},
    ])
    database.mongo_db = object()
    database.notificacoes_collection = notificacoes

    response = client.get('/api/notificacoes?nao_lidas=true', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()['notificacoes'] == [{'id_usuario': 'USR-TEST-0001', 'titulo': 'Nova', 'lida': False}]


def test_utils_marcar_todas_lidas_atualiza_documentos(client, auth_headers):
    notificacoes = FakeMongoCollection([
        {'id_usuario': 'USR-TEST-0001', 'titulo': 'Nova 1', 'lida': False},
        {'id_usuario': 'USR-TEST-0001', 'titulo': 'Nova 2', 'lida': False},
    ])
    database.mongo_db = object()
    database.notificacoes_collection = notificacoes

    response = client.put('/api/notificacoes/marcar-todas-lidas', headers=auth_headers)

    assert response.status_code == 200
    assert all(item['lida'] is True for item in notificacoes.items)
    assert '2 notificações' in response.get_json()['mensagem']


def test_utils_populares_e_temporada_consultam_views(client, monkeypatch):
    chamadas = []

    def fake_execute(query, params=None, fetch=True):
        chamadas.append((query, params, fetch))
        if 'vw_animes_temporada_atual' in query:
            return [{'id_midia': 'MID-TEMP'}]
        return [{'id_midia': 'MID-POP'}]

    monkeypatch.setattr(utils_routes, 'execute_query', fake_execute)

    response_populares = client.get('/api/midias/populares?tipo=anime')
    response_animes_populares = client.get('/api/animes/populares')
    response_temporada = client.get('/api/animes/temporada')

    assert response_populares.status_code == 200
    assert response_animes_populares.status_code == 200
    assert response_temporada.status_code == 200
    assert response_populares.get_json()['midias'][0]['id_midia'] == 'MID-POP'
    assert response_temporada.get_json()['animes'][0]['id_midia'] == 'MID-TEMP'
    assert any('vw_midias_populares' in query for query, _params, _fetch in chamadas)
    assert any('vw_animes_temporada_atual' in query for query, _params, _fetch in chamadas)


def test_animes_crud_e_atualizacao(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    monkeypatch.setattr(animes_routes, 'get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    monkeypatch.setattr(animes_routes.anime_repository, 'buscar_anime_completo', lambda anime_id: {
        'id_midia': anime_id,
        'codigo_midia': 'ANI-001',
    })
    monkeypatch.setattr(animes_routes, '_carregar_atualizacoes', lambda _id: [{'titulo': 'Ep 1'}])
    monkeypatch.setattr(animes_routes.anime_repository, 'inserir_anime', lambda _base, _payload: 'MID-A1')
    monkeypatch.setattr(animes_routes.anime_repository, 'atualizar_anime', lambda _id, _payload: True)
    monkeypatch.setattr(animes_routes.anime_repository, 'deletar_midia', lambda _id: True)
    monkeypatch.setattr(animes_routes, '_criar_atualizacao_midia', lambda anime_id: ({'id_midia': anime_id}, 201))

    detalhes = client.get('/api/animes/MID-A1')
    criar = client.post('/api/animes', headers=admin_headers, json={
        'titulo_original': 'Anime Teste',
        'status_anime': 'finalizado',
    })
    editar = client.put('/api/animes/MID-A1', headers=admin_headers, json={'numero_episodios': 24})
    deletar = client.delete('/api/animes/MID-A1', headers=admin_headers)
    atualizacao = client.post('/api/animes/MID-A1/atualizacoes', headers=admin_headers, json={})

    assert detalhes.status_code == 200
    assert detalhes.get_json()['atualizacoes'][0]['titulo'] == 'Ep 1'
    assert criar.status_code == 201
    assert criar.get_json()['codigo_midia'] == 'ANI-001'
    assert editar.status_code == 200
    assert deletar.status_code == 200
    assert atualizacao.status_code == 201


def test_mangas_endpoints_de_busca_e_criacao(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    monkeypatch.setattr(mangas_routes.manga_repository, 'buscar_manga_completo', lambda manga_id: {'id_midia': manga_id})
    monkeypatch.setattr(mangas_routes.manga_repository, 'buscar_por_autor', lambda autor: [{'autor': autor}])
    monkeypatch.setattr(mangas_routes.manga_repository, 'buscar_por_demografia', lambda demografia: [{'demografia': demografia}])
    monkeypatch.setattr(mangas_routes.manga_repository, 'inserir_manga', lambda _base, _payload: 'MID-M1')

    detalhes = client.get('/api/mangas/MID-M1')
    por_autor = client.get('/api/mangas/autor/Urasawa')
    por_demografia = client.get('/api/mangas/demografia/seinen')
    criar = client.post('/api/mangas', headers=admin_headers, json={
        'titulo_original': 'Manga Teste',
        'autor': 'Autor Teste',
        'status_manga': 'finalizado',
        'demografia': 'seinen',
    })

    assert detalhes.status_code == 200
    assert por_autor.status_code == 200
    assert por_autor.get_json()['mangas'][0]['autor'] == 'Urasawa'
    assert por_demografia.status_code == 200
    assert por_demografia.get_json()['mangas'][0]['demografia'] == 'seinen'
    assert criar.status_code == 201


def test_jogos_endpoints_de_busca_e_criacao(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    monkeypatch.setattr(jogos_routes.jogo_repository, 'buscar_jogo_completo', lambda jogo_id: {'id_midia': jogo_id})
    monkeypatch.setattr(jogos_routes.jogo_repository, 'buscar_por_plataforma', lambda plataforma: [{'plataforma': plataforma}])
    monkeypatch.setattr(jogos_routes.jogo_repository, 'inserir_jogo', lambda _base, _payload: 'MID-J1')

    detalhes = client.get('/api/jogos/MID-J1')
    por_plataforma = client.get('/api/jogos/plataforma/Switch')
    criar = client.post('/api/jogos', headers=admin_headers, json={
        'titulo_original': 'Jogo Teste',
        'status_jogo': 'lancado',
        'modo_jogo': 'single',
        'plataformas': 'Switch',
    })

    assert detalhes.status_code == 200
    assert por_plataforma.status_code == 200
    assert por_plataforma.get_json()['jogos'][0]['plataforma'] == 'Switch'
    assert criar.status_code == 201
