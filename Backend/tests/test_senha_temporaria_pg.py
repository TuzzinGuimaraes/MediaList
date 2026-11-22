"""Senha temporária de ponta a ponta contra o PostgreSQL real (spec `producao`, ADR 0013).

O admin roda `redefinir_senha.py EMAIL` e repassa a Senha temporária; com ela o Usuário
entra, mas só consegue trocar a senha, ver `/auth/me` e sair, até trocá-la.

Usa TEST_DATABASE_URL (usuário da aplicação, schema migrado); sem ela, pula.
"""
import os
import uuid

import pytest
from flask_jwt_extended import decode_token

import banco
import redefinir_senha
from repositories import AcessoRepository, RefreshTokenRepository
from routes import auth as auth_routes

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a Senha temporária'
)

SENHA = 'segredo1'
TROCA_OBRIGATORIA = {
    'erro': 'Defina uma nova senha para continuar', 'codigo': 'troca_de_senha_obrigatoria',
}


@pytest.fixture
def pg(monkeypatch):
    """Banco e repositórios reais; apaga os Usuários criados no fim."""
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    monkeypatch.setattr(auth_routes, 'refresh_token_repository', RefreshTokenRepository())
    monkeypatch.setattr(auth_routes, 'acesso_repository', AcessoRepository())
    criados = []
    yield criados
    if criados:
        banco.executar('DELETE FROM usuarios WHERE id_usuario = ANY(%s::uuid[])', (criados,))
    banco.fechar()


@pytest.fixture
def usuario(client, pg):
    """Registra um Usuário pela API e faz login; devolve email e a resposta do login."""
    email = f'temporaria-{uuid.uuid4().hex}@exemplo.test'
    registro = client.post('/api/auth/registro', json={
        'nome_completo': 'Senha Temporária', 'email': email, 'senha': SENHA,
    })
    assert registro.status_code == 201
    pg.append(registro.get_json()['id_usuario'])
    login = client.post('/api/auth/login', json={'email': email, 'senha': SENHA})
    assert login.status_code == 200
    return {'email': email, 'login': login.get_json()}


def _redefinir(email, capsys):
    """Roda o script como o admin roda; devolve (código de saída, stdout, stderr)."""
    codigo = redefinir_senha.main([email])
    saida = capsys.readouterr()
    return codigo, saida.out, saida.err


def _bearer(token):
    return {'Authorization': f'Bearer {token}'}


def _login(client, email, senha, headers=None):
    return client.post('/api/auth/login', json={'email': email, 'senha': senha}, headers=headers)


@pytest.fixture
def temporaria(client, usuario, capsys):
    """O admin redefiniu a senha; devolve a Senha temporária."""
    codigo, saida, _erro = _redefinir(usuario['email'], capsys)
    assert codigo == 0
    return saida.strip()


def test_script_mostra_so_a_senha_temporaria_e_encerra_as_sessoes(client, usuario, capsys):
    antigo = usuario['login']

    codigo, saida, _erro = _redefinir(usuario['email'], capsys)

    assert codigo == 0
    senha = saida.strip()
    assert len(saida.strip().splitlines()) == 1
    assert 8 <= len(senha) <= 12 and senha.isalnum()
    # Refresh de antes da redefinição não renova mais.
    assert client.post('/api/auth/refresh', json={'refresh_token': antigo['refresh_token']}).status_code == 401
    # A senha antiga não entra; a temporária, sim.
    assert _login(client, usuario['email'], SENHA).status_code == 401
    assert _login(client, usuario['email'], senha).status_code == 200


def test_script_gera_uma_senha_diferente_a_cada_vez(usuario, capsys):
    _c1, primeira, _e1 = _redefinir(usuario['email'], capsys)
    _c2, segunda, _e2 = _redefinir(usuario['email'], capsys)

    assert primeira.strip() != segunda.strip()


def test_script_recusa_email_inexistente(pg, capsys):
    codigo, saida, erro = _redefinir('ninguem@exemplo.test', capsys)

    assert codigo != 0
    assert saida == ''
    assert 'ninguem@exemplo.test' in erro


def test_login_com_a_senha_temporaria_pede_a_troca(client, app, usuario, temporaria):
    resposta = _login(client, usuario['email'], temporaria)

    assert resposta.status_code == 200
    corpo = resposta.get_json()
    assert corpo['deve_trocar_senha'] is True
    with app.app_context():
        assert decode_token(corpo['access_token'])['deve_trocar_senha'] is True


def test_login_comum_nao_pede_a_troca(usuario):
    assert usuario['login']['deve_trocar_senha'] is False


def test_senha_temporaria_vencida_responde_como_credenciais_invalidas(client, usuario, temporaria):
    banco.executar(
        "UPDATE usuarios SET senha_temporaria_expira_em = now() - interval '1 second' WHERE email = %s",
        (usuario['email'],),
    )
    errada = _login(client, usuario['email'], 'senha-errada')

    vencida = _login(client, usuario['email'], temporaria)

    assert (vencida.status_code, vencida.get_json()) == (401, errada.get_json())


def test_senha_temporaria_expira_em_24_horas(usuario, temporaria):
    linha = banco.consultar_um(
        "SELECT deve_trocar_senha, senha_temporaria_expira_em - now() AS falta FROM usuarios WHERE email = %s",
        (usuario['email'],),
    )

    assert linha['deve_trocar_senha'] is True
    assert 23.9 * 3600 < linha['falta'].total_seconds() <= 24 * 3600


def test_com_a_troca_pendente_as_outras_rotas_respondem_403(client, usuario, temporaria):
    access = _login(client, usuario['email'], temporaria).get_json()['access_token']

    for metodo, rota in [('GET', '/api/lista'), ('GET', '/api/usuario/perfil'), ('GET', '/api/notificacoes')]:
        resposta = client.open(rota, method=metodo, headers=_bearer(access))
        assert (resposta.status_code, resposta.get_json()) == (403, TROCA_OBRIGATORIA), rota


def test_access_de_antes_da_redefinicao_tambem_fica_preso_na_troca(client, usuario, temporaria):
    antigo = usuario['login']['access_token']

    resposta = client.get('/api/lista', headers=_bearer(antigo))

    assert (resposta.status_code, resposta.get_json()) == (403, TROCA_OBRIGATORIA)


def test_com_a_troca_pendente_me_e_logout_funcionam(client, usuario, temporaria):
    access = _login(client, usuario['email'], temporaria).get_json()['access_token']

    me = client.get('/api/auth/me', headers=_bearer(access))
    assert me.status_code == 200
    assert me.get_json()['deve_trocar_senha'] is True

    assert client.post('/api/auth/logout', headers=_bearer(access)).status_code == 200


def test_me_sem_troca_pendente(client, usuario):
    me = client.get('/api/auth/me', headers=_bearer(usuario['login']['access_token']))

    assert me.get_json()['deve_trocar_senha'] is False


def test_refresh_com_a_troca_pendente_mantem_o_claim(client, app, usuario, temporaria):
    refresh = _login(client, usuario['email'], temporaria).get_json()['refresh_token']

    renovado = client.post('/api/auth/refresh', json={'refresh_token': refresh}).get_json()

    with app.app_context():
        assert decode_token(renovado['access_token'])['deve_trocar_senha'] is True
    assert client.get('/api/lista', headers=_bearer(renovado['access_token'])).status_code == 403


def _trocar(client, access, senha_atual, nova_senha, headers=None):
    return client.post(
        '/api/auth/trocar-senha', json={'senha_atual': senha_atual, 'nova_senha': nova_senha},
        headers={**_bearer(access), **(headers or {})},
    )


def test_trocar_a_senha_temporaria_libera_a_conta(client, app, usuario, temporaria):
    access = _login(client, usuario['email'], temporaria).get_json()['access_token']

    resposta = _trocar(client, access, temporaria, 'minhaNova1')

    assert resposta.status_code == 200
    novos = resposta.get_json()
    with app.app_context():
        assert 'deve_trocar_senha' not in decode_token(novos['access_token'])
    assert client.get('/api/lista', headers=_bearer(novos['access_token'])).status_code == 200
    assert client.post('/api/auth/refresh', json={'refresh_token': novos['refresh_token']}).status_code == 200
    # O access usado na troca foi revogado.
    assert client.get('/api/auth/me', headers=_bearer(access)).status_code == 401
    # A temporária não entra mais; a nova entra sem pedir troca.
    assert _login(client, usuario['email'], temporaria).status_code == 401
    assert _login(client, usuario['email'], 'minhaNova1').get_json()['deve_trocar_senha'] is False


def test_trocar_senha_no_web_devolve_o_refresh_no_cookie(client, usuario, temporaria):
    web = {'X-Cliente': 'web'}
    access = _login(client, usuario['email'], temporaria, web).get_json()['access_token']

    resposta = _trocar(client, access, temporaria, 'minhaNova1', web)

    assert resposta.status_code == 200
    assert resposta.get_json()['refresh_token'] is None
    assert any(c.startswith('medialist_refresh=') for c in resposta.headers.getlist('Set-Cookie'))
    assert client.post('/api/auth/refresh', headers=web).status_code == 200


def test_trocar_senha_vale_para_qualquer_usuario(client, usuario):
    access = usuario['login']['access_token']

    assert _trocar(client, access, SENHA, 'outraSenha1').status_code == 200
    assert _login(client, usuario['email'], 'outraSenha1').status_code == 200


def test_trocar_senha_encerra_as_outras_sessoes(client, usuario):
    outra_sessao = _login(client, usuario['email'], SENHA).get_json()['refresh_token']

    assert _trocar(client, usuario['login']['access_token'], SENHA, 'outraSenha1').status_code == 200

    assert client.post('/api/auth/refresh', json={'refresh_token': outra_sessao}).status_code == 401


@pytest.mark.parametrize(('senha_atual', 'nova_senha', 'campo'), [
    ('senha-errada', 'minhaNova1', 'senha_atual'),
    (SENHA, SENHA, 'nova_senha'),
    (SENHA, '12345', 'nova_senha'),
])
def test_trocar_senha_recusa(client, usuario, senha_atual, nova_senha, campo):
    access = usuario['login']['access_token']

    resposta = _trocar(client, access, senha_atual, nova_senha)

    assert resposta.status_code == 400
    corpo = resposta.get_json()
    assert corpo['codigo'] == 'dados_invalidos'
    assert campo in corpo['detalhes']
    # Nada mudou: a senha antiga continua valendo e o access também.
    assert _login(client, usuario['email'], SENHA).status_code == 200
    assert client.get('/api/auth/me', headers=_bearer(access)).status_code == 200


def test_script_le_o_env_producao_quando_existe(tmp_path, monkeypatch):
    monkeypatch.delenv('REDEFINIR_SENHA_TESTE', raising=False)
    arquivo = tmp_path / '.env.producao'
    arquivo.write_text('REDEFINIR_SENHA_TESTE=do-arquivo\n')

    assert redefinir_senha.carregar_ambiente(tmp_path / 'ausente') is False
    assert redefinir_senha.carregar_ambiente(arquivo) is True
    assert os.environ['REDEFINIR_SENHA_TESTE'] == 'do-arquivo'
    monkeypatch.delenv('REDEFINIR_SENHA_TESTE')
