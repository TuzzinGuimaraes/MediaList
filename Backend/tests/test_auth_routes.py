import logging

from werkzeug.security import generate_password_hash

import banco
from routes import auth as auth_routes

from .helpers import FakeBanco


def _banco(monkeypatch, respostas=None):
    return FakeBanco(respostas).instalar(monkeypatch, auth_routes)


def test_registro_cria_usuario_e_grupo_padrao(client, monkeypatch):
    fake = _banco(monkeypatch, {
        'INSERT INTO usuarios ': {'id_usuario': 'USR-0001'},
        'FROM grupos_usuarios': {'id_grupo': 3},
    })

    response = client.post('/api/auth/registro', json={
        'nome_completo': 'Teste',
        'email': 'teste@example.com',
        'senha': '123456',
        'biografia': 'Bio',
    })

    assert response.status_code == 201
    assert response.get_json()['id_usuario'] == 'USR-0001'
    # Usuário, busca do grupo e vínculo na mesma transação.
    assert fake.transacoes == 1

    # O grupo é localizado por nome, nunca por id fixo.
    busca_grupo = fake.sql('FROM grupos_usuarios')
    assert busca_grupo and busca_grupo[0][2] == (auth_routes.GRUPO_PADRAO,)

    # E o vínculo é criado com o id que veio do INSERT ... RETURNING.
    vinculo = fake.sql('INSERT INTO usuarios_grupos')
    assert vinculo and vinculo[0][2] == ('USR-0001', 3)


def test_registro_aborta_se_grupo_padrao_nao_existe(client, monkeypatch):
    """Sem grupo padrão o usuário ficaria sem permissão alguma: melhor não criar."""
    fake = _banco(monkeypatch, {'INSERT INTO usuarios ': {'id_usuario': 'USR-0002'}})

    response = client.post('/api/auth/registro', json={
        'nome_completo': 'Teste',
        'email': 'orfao@example.com',
        'senha': '123456',
    })

    assert response.status_code == 500
    assert fake.sql('INSERT INTO usuarios_grupos') == []


def test_registro_com_email_ja_cadastrado_responde_409(client, monkeypatch):
    _banco(monkeypatch, {'INSERT INTO usuarios ': banco.Conflito('Registro já existe', 'usuarios_email_key')})

    response = client.post('/api/auth/registro', json={
        'nome_completo': 'Teste',
        'email': 'repetido@example.com',
        'senha': '123456',
    })

    assert response.status_code == 409
    assert response.get_json()['erro'] == 'Email já cadastrado'


def test_registro_rejeita_payload_incompleto(client):
    response = client.post('/api/auth/registro', json={'email': 'faltando@example.com'})

    assert response.status_code == 400
    assert response.get_json()['erro'] == 'Campos obrigatórios faltando'


def test_login_autentica_e_retorna_token(client, monkeypatch):
    fake = _banco(monkeypatch, {'FROM usuarios WHERE email': {
        'id_usuario': 'USR-LOGIN-1',
        'nome_completo': 'Usuário Login',
        'email': 'user@example.com',
        'senha_hash': generate_password_hash('senha123'),
        'ativo': True,
    }})
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
    # Último acesso é escrito pela aplicação no login (era trigger no MySQL).
    ultimo_acesso = fake.sql('SET ultimo_acesso = now()')
    assert ultimo_acesso and ultimo_acesso[0][2] == ('USR-LOGIN-1',)


def test_login_rejeita_senha_invalida(client, monkeypatch):
    _banco(monkeypatch, {'FROM usuarios': {
        'id_usuario': 'USR-LOGIN-1',
        'nome_completo': 'Usuário Login',
        'email': 'user@example.com',
        'senha_hash': generate_password_hash('correta'),
        'ativo': True,
    }})

    response = client.post('/api/auth/login', json={
        'email': 'user@example.com',
        'senha': 'errada',
    })

    assert response.status_code == 401
    assert response.get_json()['erro'] == 'Email ou senha incorretos'


def test_me_retorna_usuario_autenticado(client, auth_headers, monkeypatch):
    _banco(monkeypatch, {'FROM usuarios': {
        'id_usuario': 'USR-TEST-0001',
        'nome_completo': 'Usuário Atual',
        'email': 'atual@example.com',
        'foto_perfil': None,
    }})

    response = client.get('/api/auth/me', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()['usuario']['email'] == 'atual@example.com'


def test_me_sem_token_retorna_401(client):
    response = client.get('/api/auth/me')

    assert response.status_code == 401


def test_logout_revoga_token(client, make_token):
    headers = {'Authorization': f'Bearer {make_token("USR-LOGOUT-1")}'}
    response = client.post('/api/auth/logout', headers=headers)

    assert response.status_code == 200
    assert client.get('/api/auth/me', headers=headers).status_code == 401


def test_esqueci_senha_email_inexistente_nao_vaza_informacao(client, monkeypatch):
    _banco(monkeypatch)

    response = client.post('/api/auth/esqueci-senha', json={'email': 'naoexiste@example.com'})

    assert response.status_code == 200
    assert 'instruções' in response.get_json()['mensagem']


def test_redefinir_senha_com_token_valido(client, make_token, monkeypatch):
    fake = _banco(monkeypatch)

    token = make_token('USR-RESET-1', {'tipo': 'recuperacao_senha'})
    response = client.post(
        '/api/auth/redefinir-senha',
        headers={'Authorization': f'Bearer {token}'},
        json={'nova_senha': 'novaSenha123'},
    )

    assert response.status_code == 200
    assert response.get_json()['mensagem'] == 'Senha redefinida com sucesso!'
    _metodo, sql, params = fake.chamadas[0]
    assert sql.startswith('UPDATE usuarios SET senha_hash')
    assert params[1] == 'USR-RESET-1'


def test_redefinir_senha_de_usuario_inexistente_nao_responde_sucesso(client, make_token, monkeypatch):
    _banco(monkeypatch, {'UPDATE usuarios SET senha_hash': 0})

    token = make_token('USR-SUMIU-1', {'tipo': 'recuperacao_senha'})
    response = client.post(
        '/api/auth/redefinir-senha',
        headers={'Authorization': f'Bearer {token}'},
        json={'nova_senha': 'novaSenha123'},
    )

    assert response.status_code == 404


def test_redefinir_senha_rejeita_token_de_tipo_errado(client, auth_headers):
    response = client.post(
        '/api/auth/redefinir-senha',
        headers=auth_headers,
        json={'nova_senha': 'novaSenha123'},
    )

    assert response.status_code == 403
    assert response.get_json()['erro'] == 'Token inválido para esta operação'



# ============================================
# Recuperação de senha: paliativo (ticket 03)
# ============================================

USUARIO_RECUPERACAO = {
    'id_usuario': 'USR-RESET-1',
    'nome_completo': 'Usuária Esquecida',
    'email': 'esquecida@example.com',
}


def test_esqueci_senha_email_existente_nao_devolve_token(client, monkeypatch):
    _banco(monkeypatch, {'FROM usuarios': USUARIO_RECUPERACAO})

    response = client.post('/api/auth/esqueci-senha', json={'email': 'esquecida@example.com'})

    assert response.status_code == 200
    assert 'dev_token' not in response.get_json()


def test_esqueci_senha_email_inexistente_nao_devolve_token(client, monkeypatch):
    _banco(monkeypatch)

    response = client.post('/api/auth/esqueci-senha', json={'email': 'naoexiste@example.com'})

    assert 'dev_token' not in response.get_json()


def _token_do_log(caplog):
    for record in caplog.records:
        if 'recuperação' in record.getMessage().lower():
            return record.getMessage().rsplit(' ', 1)[-1]
    return None


def test_esqueci_senha_em_dev_registra_token_no_log(client, monkeypatch, caplog):
    _banco(monkeypatch, {'FROM usuarios': USUARIO_RECUPERACAO})
    monkeypatch.setattr(auth_routes, 'EM_PRODUCAO', False)
    caplog.set_level(logging.INFO)

    client.post('/api/auth/esqueci-senha', json={'email': 'esquecida@example.com'})

    token = _token_do_log(caplog)
    assert token and token.count('.') == 2


def test_esqueci_senha_em_producao_nao_registra_token(client, monkeypatch, caplog, capsys):
    _banco(monkeypatch, {'FROM usuarios': USUARIO_RECUPERACAO})
    monkeypatch.setattr(auth_routes, 'EM_PRODUCAO', True)
    caplog.set_level(logging.DEBUG)

    client.post('/api/auth/esqueci-senha', json={'email': 'esquecida@example.com'})

    assert _token_do_log(caplog) is None
    assert 'eyJ' not in caplog.text
    assert 'eyJ' not in capsys.readouterr().out


def test_token_de_recuperacao_recusado_em_me(client, make_token):
    token = make_token('USR-RESET-1', {'tipo': 'recuperacao_senha'})

    response = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})

    assert response.status_code == 401


def test_token_de_recuperacao_recusado_na_lista(client, make_token):
    token = make_token('USR-RESET-1', {'tipo': 'recuperacao_senha'})

    response = client.get('/api/lista', headers={'Authorization': f'Bearer {token}'})

    assert response.status_code == 401


def test_token_de_recuperacao_vale_uma_vez(client, make_token, monkeypatch):
    _banco(monkeypatch)
    headers = {'Authorization': f"Bearer {make_token('USR-RESET-1', {'tipo': 'recuperacao_senha'})}"}

    primeira = client.post('/api/auth/redefinir-senha', headers=headers, json={'nova_senha': 'novaSenha123'})
    segunda = client.post('/api/auth/redefinir-senha', headers=headers, json={'nova_senha': 'outraSenha456'})

    assert primeira.status_code == 200
    assert segunda.status_code == 401
