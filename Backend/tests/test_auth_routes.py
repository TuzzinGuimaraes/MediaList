from werkzeug.security import generate_password_hash

from config import token_blocklist
from routes import auth as auth_routes

from .helpers import FakeConnection, FakeCursor


def test_registro_cria_usuario_e_grupo_padrao(client, monkeypatch):
    # fetchone na ordem em que a rota consulta: id do usuário, depois id do grupo.
    cursor = FakeCursor(fetchone_results=[{'id_usuario': 'USR-0001'}, {'id_grupo': 3}])
    connection = FakeConnection(cursor)

    monkeypatch.setattr(auth_routes, 'get_db_connection', lambda: connection)

    response = client.post('/api/auth/registro', json={
        'nome_completo': 'Teste',
        'email': 'teste@example.com',
        'senha': '123456',
        'biografia': 'Bio',
    })

    assert response.status_code == 201
    assert response.get_json()['id_usuario'] == 'USR-0001'
    assert connection.committed is True
    assert connection.rolled_back is False
    assert any('INSERT INTO usuarios' in query for query, _params in cursor.executed)

    # O grupo é localizado por nome, nunca por id fixo.
    busca_grupo = [
        (query, params) for query, params in cursor.executed
        if 'FROM grupos_usuarios' in query
    ]
    assert busca_grupo and busca_grupo[0][1] == (auth_routes.GRUPO_PADRAO,)

    # E o vínculo é criado na mesma transação, com o id que veio da busca.
    vinculo = [
        (query, params) for query, params in cursor.executed
        if 'INSERT INTO usuarios_grupos' in query
    ]
    assert vinculo and vinculo[0][1] == ('USR-0001', 3)


def test_registro_aborta_se_grupo_padrao_nao_existe(client, monkeypatch):
    """Sem grupo padrão o usuário ficaria sem permissão alguma: melhor não criar."""
    cursor = FakeCursor(fetchone_results=[{'id_usuario': 'USR-0002'}, None])
    connection = FakeConnection(cursor)

    monkeypatch.setattr(auth_routes, 'get_db_connection', lambda: connection)

    response = client.post('/api/auth/registro', json={
        'nome_completo': 'Teste',
        'email': 'orfao@example.com',
        'senha': '123456',
    })

    assert response.status_code == 500
    assert connection.committed is False
    assert connection.rolled_back is True


def test_registro_rejeita_payload_incompleto(client):
    response = client.post('/api/auth/registro', json={'email': 'faltando@example.com'})

    assert response.status_code == 400
    assert response.get_json()['erro'] == 'Campos obrigatórios faltando'


def test_login_autentica_e_retorna_token(client, monkeypatch):
    monkeypatch.setattr(
        auth_routes,
        'execute_query',
        lambda query, params=None, fetch=True: (
            [{
                'id_usuario': 'USR-LOGIN-1',
                'nome_completo': 'Usuário Login',
                'email': 'user@example.com',
                'senha_hash': generate_password_hash('senha123'),
                'ativo': True,
            }]
            if query.startswith('SELECT id_usuario')
            else None
        ),
    )
    monkeypatch.setattr(auth_routes, 'get_user_permissions', lambda _user_id: {
        'nivel_acesso': 'usuario',
        'grupos': 'Usuários',
        'pode_criar': 1,
        'pode_editar': 1,
        'pode_deletar': 0,
        'pode_moderar': 0,
    })

    response = client.post('/api/auth/login', json={
        'email': 'user@example.com',
        'senha': 'senha123',
    })

    data = response.get_json()
    assert response.status_code == 200
    assert data['token'] == data['access_token']
    assert data['usuario']['id'] == 'USR-LOGIN-1'
    assert data['usuario']['nivel_acesso'] == 'usuario'


def test_login_rejeita_senha_invalida(client, monkeypatch):
    monkeypatch.setattr(auth_routes, 'execute_query', lambda *_args, **_kwargs: [{
        'id_usuario': 'USR-LOGIN-1',
        'nome_completo': 'Usuário Login',
        'email': 'user@example.com',
        'senha_hash': generate_password_hash('correta'),
        'ativo': True,
    }])

    response = client.post('/api/auth/login', json={
        'email': 'user@example.com',
        'senha': 'errada',
    })

    assert response.status_code == 401
    assert response.get_json()['erro'] == 'Email ou senha incorretos'


def test_me_retorna_usuario_autenticado(client, auth_headers, monkeypatch):
    monkeypatch.setattr(auth_routes, 'execute_query', lambda *_args, **_kwargs: [{
        'id_usuario': 'USR-TEST-0001',
        'nome_completo': 'Usuário Atual',
        'email': 'atual@example.com',
        'foto_perfil': None,
    }])

    response = client.get('/api/auth/me', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()['usuario']['email'] == 'atual@example.com'


def test_me_sem_token_retorna_401(client):
    response = client.get('/api/auth/me')

    assert response.status_code == 401


def test_logout_revoga_token(client, make_token):
    token = make_token('USR-LOGOUT-1')
    response = client.post('/api/auth/logout', headers={'Authorization': f'Bearer {token}'})

    assert response.status_code == 200
    assert len(token_blocklist) == 1


def test_esqueci_senha_email_inexistente_nao_vaza_informacao(client, monkeypatch):
    monkeypatch.setattr(auth_routes, 'execute_query', lambda *_args, **_kwargs: [])

    response = client.post('/api/auth/esqueci-senha', json={'email': 'naoexiste@example.com'})

    assert response.status_code == 200
    assert 'instruções' in response.get_json()['mensagem']


def test_redefinir_senha_com_token_valido(client, make_token, monkeypatch):
    chamadas = []
    monkeypatch.setattr(auth_routes, 'execute_query', lambda query, params=None, fetch=True: chamadas.append((query, params, fetch)))

    token = make_token('USR-RESET-1', {'tipo': 'recuperacao_senha'})
    response = client.post(
        '/api/auth/redefinir-senha',
        headers={'Authorization': f'Bearer {token}'},
        json={'nova_senha': 'novaSenha123'},
    )

    assert response.status_code == 200
    assert response.get_json()['mensagem'] == 'Senha redefinida com sucesso!'
    assert chamadas[0][0].startswith('UPDATE usuarios SET senha_hash')
    assert chamadas[0][1][1] == 'USR-RESET-1'


def test_redefinir_senha_rejeita_token_de_tipo_errado(client, auth_headers):
    response = client.post(
        '/api/auth/redefinir-senha',
        headers=auth_headers,
        json={'nova_senha': 'novaSenha123'},
    )

    assert response.status_code == 403
    assert response.get_json()['erro'] == 'Token inválido para esta operação'
