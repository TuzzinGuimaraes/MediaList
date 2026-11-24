"""Refresh do web num cookie httpOnly (ADR 0006, Q79 do ticket 19 da revisão).

O web se identifica com o cabeçalho `X-Cliente: web`. Com ele, o login e o refresh
gravam o refresh no cookie e devolvem `refresh_token: null`; o refresh e o logout leem
o cookie. Sem o cabeçalho, o cookie é ignorado (CSRF) e vale o caminho do app, pelo corpo.
"""
import pytest
from werkzeug.security import generate_password_hash

from routes import auth as auth_routes

from .helpers import FakeBanco

ID_USUARIO = 'USR-COOKIE-1'
COOKIE = 'medialist_refresh'
WEB = {'X-Cliente': 'web'}


@pytest.fixture
def login(client, monkeypatch):
    FakeBanco({'FROM usuarios WHERE lower(email)': {
        'id_usuario': ID_USUARIO,
        'nome_completo': 'Usuário Cookie',
        'email': 'cookie@example.com',
        'senha_hash': generate_password_hash('senha123'),
        'ativo': True,
        'nivel_acesso': 'usuario',
        'deve_trocar_senha': False,
        'senha_temporaria_expira_em': None,
    }}).instalar(monkeypatch, auth_routes)

    def _login(headers=None):
        response = client.post(
            '/api/auth/login', json={'email': 'cookie@example.com', 'senha': 'senha123'}, headers=headers,
        )
        assert response.status_code == 200
        return response

    return _login


def _set_cookie(response):
    """O cabeçalho Set-Cookie do refresh, ou None."""
    for valor in response.headers.getlist('Set-Cookie'):
        if valor.startswith(f'{COOKIE}='):
            return valor
    return None


def _valor(response):
    return _set_cookie(response).split(';', 1)[0].split('=', 1)[1]


def _cookie_atual(client):
    cookie = client.get_cookie(COOKIE, path='/api/auth')
    return cookie.value if cookie else None


def _refresh_web(client):
    return client.post('/api/auth/refresh', headers=WEB)


def test_login_do_web_grava_o_refresh_no_cookie_e_nao_no_corpo(login):
    response = login(WEB)

    assert response.get_json()['refresh_token'] is None
    assert response.get_json()['access_token']
    cabecalho = _set_cookie(response)
    assert cabecalho
    atributos = {a.strip().split('=')[0].lower(): a for a in cabecalho.split(';')[1:]}
    assert 'httponly' in atributos
    assert atributos['samesite'].strip() == 'SameSite=Strict'
    assert atributos['path'].strip() == 'Path=/api/auth'
    assert 'max-age' in atributos
    # Em dev o cookie vale em http://localhost.
    assert 'secure' not in atributos


def test_cookie_e_secure_fora_de_dev(login, monkeypatch):
    monkeypatch.setattr(auth_routes, 'COOKIE_SEGURO', True)

    cabecalho = _set_cookie(login(WEB))

    assert 'secure' in [a.strip().lower() for a in cabecalho.split(';')]


def test_login_do_app_segue_com_o_refresh_no_corpo_e_sem_cookie(login):
    response = login()

    assert response.get_json()['refresh_token']
    assert _set_cookie(response) is None


def test_refresh_do_web_le_o_cookie_e_rotaciona(client, login):
    login(WEB)
    original = _cookie_atual(client)

    response = _refresh_web(client)

    assert response.status_code == 200
    assert response.get_json()['refresh_token'] is None
    novo = _cookie_atual(client)
    assert novo and novo != original
    me = client.get('/api/auth/me', headers={'Authorization': f"Bearer {response.get_json()['access_token']}"})
    assert me.status_code != 401
    assert _refresh_web(client).status_code == 200


def test_reuso_do_cookie_rotacionado_revoga_a_familia(client, login):
    login(WEB)
    original = _cookie_atual(client)
    _refresh_web(client)
    sucessor = _cookie_atual(client)

    client.set_cookie(COOKIE, original, path='/api/auth')
    assert _refresh_web(client).status_code == 401

    client.set_cookie(COOKIE, sucessor, path='/api/auth')
    assert _refresh_web(client).status_code == 401


def test_refresh_do_web_sem_cookie_da_401(client):
    response = _refresh_web(client)

    assert response.status_code == 401
    assert response.get_json()['codigo'] == 'token_invalido'


def test_refresh_recusado_apaga_o_cookie(client, login):
    login(WEB)
    client.set_cookie(COOKIE, 'token-que-nunca-existiu', path='/api/auth')

    response = _refresh_web(client)

    assert response.status_code == 401
    assert _cookie_atual(client) is None


def test_sem_o_cabecalho_o_cookie_e_ignorado(client, login):
    """CSRF: um formulário de outro site manda o cookie, mas não um cabeçalho próprio.
    O refresh não é lido nem gasto: o web ainda renova depois."""
    login(WEB)
    original = _cookie_atual(client)

    response = client.post('/api/auth/refresh')

    assert response.status_code == 401
    assert _cookie_atual(client) == original
    assert _refresh_web(client).status_code == 200


def test_cabecalho_com_outro_valor_nao_le_o_cookie(client, login):
    login(WEB)

    assert client.post('/api/auth/refresh', headers={'X-Cliente': 'app'}).status_code == 401


def test_app_continua_renovando_pelo_corpo(client, login):
    refresh = login().get_json()['refresh_token']

    response = client.post('/api/auth/refresh', json={'refresh_token': refresh})

    assert response.status_code == 200
    assert response.get_json()['refresh_token']
    assert _set_cookie(response) is None


def test_logout_do_web_revoga_o_refresh_do_cookie_e_o_apaga(client, login):
    access = login(WEB).get_json()['access_token']
    original = _cookie_atual(client)

    response = client.post('/api/auth/logout', headers={**WEB, 'Authorization': f'Bearer {access}'})

    assert response.status_code == 200
    assert _cookie_atual(client) is None
    client.set_cookie(COOKIE, original, path='/api/auth')
    assert _refresh_web(client).status_code == 401


def test_logout_sem_o_cabecalho_nao_toca_no_cookie(client, login):
    access = login(WEB).get_json()['access_token']
    original = _cookie_atual(client)

    response = client.post('/api/auth/logout', headers={'Authorization': f'Bearer {access}'})

    assert response.status_code == 200
    assert _cookie_atual(client) == original
    assert _refresh_web(client).status_code == 200
