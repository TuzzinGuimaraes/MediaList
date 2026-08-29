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


def test_get_avaliacoes_lista_vazia(client, monkeypatch):
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id})
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'obter_avaliacoes', lambda _id: [])

    response = client.get('/api/avaliacoes/MID-1')

    assert response.status_code == 200
    assert response.get_json()['avaliacoes'] == []


def test_post_avaliacao_cria_registro(client, auth_headers, monkeypatch):
    respostas = [
        [],
        [{'id_avaliacao': 'AVL-1'}],
        [{'nota_media': 9.0, 'total_avaliacoes': 4}],
    ]

    def fake_execute(_query, _params=None, fetch=True):
        if not fetch:
            return None
        return respostas.pop(0)

    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id})
    monkeypatch.setattr(avaliacoes_routes, 'execute_query', fake_execute)

    response = client.post('/api/avaliacoes', headers=auth_headers, json={
        'id_midia': 'MID-1',
        'nota': 9,
        'titulo_avaliacao': 'Excelente',
    })

    data = response.get_json()
    assert response.status_code == 201
    assert data['id_avaliacao'] == 'AVL-1'
    assert data['nota_media_atualizada'] == 9.0


def test_post_avaliacao_rejeita_duplicada(client, auth_headers, monkeypatch):
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id})
    monkeypatch.setattr(avaliacoes_routes, 'execute_query', lambda *_args, **_kwargs: [{'id_avaliacao': 'AVL-1'}])

    response = client.post('/api/avaliacoes', headers=auth_headers, json={
        'id_midia': 'MID-1',
        'nota': 8,
    })

    assert response.status_code == 400


def test_put_avaliacao_restringe_edicao_ao_autor(client, auth_headers, monkeypatch):
    monkeypatch.setattr(avaliacoes_routes, 'execute_query', lambda *_args, **_kwargs: [{'id_usuario': 'USR-OUTRO', 'id_midia': 'MID-1'}])

    response = client.put('/api/avaliacoes/AVL-1', headers=auth_headers, json={'nota': 7})

    assert response.status_code == 403


def test_delete_avaliacao_permite_moderador(client, auth_headers, monkeypatch):
    chamadas = []

    def fake_execute(query, params=None, fetch=True):
        chamadas.append((query, params, fetch))
        if query.startswith('SELECT id_usuario'):
            return [{'id_usuario': 'USR-OUTRO'}]
        return None

    monkeypatch.setattr(avaliacoes_routes, 'execute_query', fake_execute)
    monkeypatch.setattr(avaliacoes_routes, 'get_user_permissions', lambda _user_id: {'pode_moderar': 1})

    response = client.delete('/api/avaliacoes/AVL-1', headers=auth_headers)

    assert response.status_code == 200
    assert any(query.startswith('DELETE FROM avaliacoes') for query, _params, _fetch in chamadas)


def test_get_usuario_perfil_retorna_dados(client, auth_headers, monkeypatch):
    monkeypatch.setattr(usuario_routes, 'execute_query', lambda *_args, **_kwargs: [{'id_usuario': 'USR-TEST-0001', 'nome_completo': 'Perfil'}])

    response = client.get('/api/usuario/perfil', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()['perfil']['nome_completo'] == 'Perfil'


def test_get_usuario_estatisticas_monta_resumo(client, auth_headers, monkeypatch):
    monkeypatch.setattr(usuario_routes, 'call_procedure', lambda *_args, **_kwargs: [
        {'tipo': 'anime', 'total_midias': 2, 'concluidos': 1, 'em_andamento': 1, 'favoritos': 1},
        {'tipo': 'jogo', 'total_midias': 3, 'concluidos': 2, 'em_andamento': 1, 'favoritos': 0},
    ])

    response = client.get('/api/usuario/estatisticas', headers=auth_headers)

    data = response.get_json()
    assert response.status_code == 200
    assert data['resumo'] == {
        'total_midias': 5,
        'concluidos': 3,
        'em_andamento': 2,
        'favoritos': 1,
    }


def test_utils_generos_filtra_por_tipo(client, monkeypatch):
    chamadas = []
    monkeypatch.setattr(utils_routes, 'execute_query', lambda query, params=None, fetch=True: chamadas.append((query, params)) or [{'nome_genero': 'Ação'}])

    response = client.get('/api/generos?tipo=anime')

    assert response.status_code == 200
    assert response.get_json()['generos'][0]['nome_genero'] == 'Ação'
    # O filtro é só FIND_IN_SET; o LIKE '%tipo%' que existia aqui era redundante
    # e casava substrings ('nim' encontrava 'anime').
    assert chamadas[0][1] == ('anime',)


def test_utils_health_reporta_estado_conectado(client, monkeypatch):
    monkeypatch.setattr(utils_routes, 'execute_query', lambda *_args, **_kwargs: [{'test': 1}])
    database.mongo_db = object()

    response = client.get('/api/health')

    assert response.status_code == 200
    assert response.get_json()['status'] == 'healthy'


def test_preferencias_cria_defaults_quando_nao_existirem(client, auth_headers):
    preferencias = FakeMongoCollection()
    database.mongo_db = object()
    database.preferencias_collection = preferencias

    response = client.get('/api/preferencias', headers=auth_headers)

    data = response.get_json()['preferencias']
    assert response.status_code == 200
    assert data['tema'] == 'light'
    assert preferencias.inserted[0]['id_usuario'] == 'USR-TEST-0001'


def test_preferencias_update_rejeita_payload_vazio(client, auth_headers):
    database.mongo_db = object()
    database.preferencias_collection = FakeMongoCollection()

    response = client.put('/api/preferencias', headers=auth_headers, json={'invalido': True})

    assert response.status_code == 400


def test_noticias_lista_vazia_quando_mongo_indisponivel(client):
    database.mongo_db = None
    database.noticias_collection = None

    response = client.get('/api/noticias')

    assert response.status_code == 200
    assert response.get_json()['noticias'] == []


def test_noticias_cria_registro_quando_autorizado(client, admin_headers, monkeypatch):
    noticias = FakeMongoCollection()
    database.mongo_db = object()
    database.noticias_collection = noticias
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})

    response = client.post('/api/noticias', headers=admin_headers, json={
        'titulo': 'Nova noticia',
        'conteudo': 'Texto',
    })

    assert response.status_code == 201
    assert noticias.inserted[0]['titulo'] == 'Nova noticia'


def test_moderacao_bloqueia_usuario_comum(client, auth_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'usuario', 'pode_moderar': 0})

    response = client.get('/api/moderacao/usuarios', headers=auth_headers)

    assert response.status_code == 403


def test_moderacao_lista_usuarios_para_admin(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    monkeypatch.setattr(moderacao_routes, 'execute_query', lambda *_args, **_kwargs: [{'id_usuario': 'USR-1'}])

    response = client.get('/api/moderacao/usuarios', headers=admin_headers)

    assert response.status_code == 200
    assert response.get_json()['usuarios'][0]['id_usuario'] == 'USR-1'


def test_rotas_de_tipo_listam_e_validam_payload(client, admin_headers, monkeypatch):
    monkeypatch.setattr(animes_routes.anime_repository, 'buscar_por_tipo', lambda *_args, **_kwargs: [{'id_midia': 'MID-A'}])
    monkeypatch.setattr(mangas_routes.manga_repository, 'buscar_por_tipo', lambda *_args, **_kwargs: [{'id_midia': 'MID-M'}])
    monkeypatch.setattr(jogos_routes.jogo_repository, 'buscar_por_tipo', lambda *_args, **_kwargs: [{'id_midia': 'MID-J'}])
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})

    assert client.get('/api/animes').status_code == 200
    assert client.get('/api/mangas').status_code == 200
    assert client.get('/api/jogos').status_code == 200

    assert client.post('/api/animes', headers=admin_headers, json={}).status_code == 400
    assert client.post('/api/mangas', headers=admin_headers, json={'titulo_original': 'Teste'}).status_code == 400
    assert client.post('/api/jogos', headers=admin_headers, json={}).status_code == 400


def test_generos_serializa_coluna_set_do_mysql(client, monkeypatch):
    """`aplicavel_a` chega como set do conector; sem conversão o jsonify quebra."""
    from routes import utils as utils_routes

    monkeypatch.setattr(
        utils_routes,
        'execute_query',
        lambda *_args, **_kwargs: [
            {'id_genero': 1, 'nome_genero': 'Ação', 'aplicavel_a': {'jogo', 'anime', 'manga'}},
        ],
    )

    response = client.get('/api/generos')

    assert response.status_code == 200
    assert response.get_json()['generos'][0]['aplicavel_a'] == ['anime', 'jogo', 'manga']


def test_generos_filtra_por_tipo_sem_casar_substring(client, monkeypatch):
    """'?tipo=nim' não pode casar com 'anime': o filtro é por elemento inteiro."""
    from routes import utils as utils_routes

    consultas = []

    def fake_execute_query(query, params=None, fetch=True):
        consultas.append((query, params))
        return []

    monkeypatch.setattr(utils_routes, 'execute_query', fake_execute_query)

    client.get('/api/generos?tipo=anime')

    query, params = consultas[0]
    assert 'FIND_IN_SET' in query
    assert 'LIKE' not in query
    assert params == ('anime',)
