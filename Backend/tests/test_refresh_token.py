"""Refresh token rotativo (ADR-0006), pelo cliente Flask.

O banco entra por duas costuras: a interface do módulo `banco` (FakeBanco) e
`get_user_permissions` para o login (como em test_auth_routes.py), e o
repositório de refresh tokens, trocado por uma tabela em memória.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from werkzeug.security import generate_password_hash

import banco
from repositories import refresh_token_repository as repositorio
from routes import auth as auth_routes

from .helpers import FakeBanco

ID_USUARIO = 'USR-REFRESH-1'


@pytest.fixture
def tokens(refresh_tokens):
    """A tabela em memória que o conftest já pôs no lugar do repositório."""
    return refresh_tokens


@pytest.fixture
def login(client, monkeypatch, tokens):
    FakeBanco({'FROM usuarios WHERE email': {
        'id_usuario': ID_USUARIO,
        'nome_completo': 'Usuário Refresh',
        'email': 'refresh@example.com',
        'senha_hash': generate_password_hash('senha123'),
        'ativo': True,
    }}).instalar(monkeypatch, auth_routes)
    monkeypatch.setattr(auth_routes, 'get_user_permissions', lambda _user_id: {
        'nivel_acesso': 'usuario',
        'grupos': 'Usuários',
        'pode_criar': 1,
        'pode_editar': 1,
        'pode_deletar': 0,
        'pode_moderar': 0,
    })

    def _login():
        response = client.post('/api/auth/login', json={
            'email': 'refresh@example.com',
            'senha': 'senha123',
        })
        assert response.status_code == 200
        return response.get_json()

    return _login


def test_login_devolve_refresh_token_sem_mudar_o_contrato_antigo(login, tokens):
    data = login()

    assert data['refresh_token']
    assert data['token'] == data['access_token']
    assert data['usuario']['id'] == ID_USUARIO
    assert set(data) == {'token', 'access_token', 'refresh_token', 'usuario'}


def test_refresh_token_nunca_e_guardado_em_claro(login, tokens):
    data = login()

    assert len(tokens.tokens) == 1
    linha = next(iter(tokens.tokens.values()))
    assert data['refresh_token'] not in linha.values()
    assert linha['id_usuario'] == ID_USUARIO


def test_familia_do_login_e_um_uuid(login, tokens):
    login()

    linha = next(iter(tokens.tokens.values()))
    assert str(uuid.UUID(linha['familia'])) == linha['familia']



def _refresh(client, token):
    return client.post('/api/auth/refresh', json={'refresh_token': token})


def test_refresh_troca_o_token_por_um_par_novo(client, login):
    original = login()['refresh_token']

    response = _refresh(client, original)

    data = response.get_json()
    assert response.status_code == 200
    assert data['access_token']
    assert data['refresh_token'] and data['refresh_token'] != original

    # O access token novo autentica.
    me = client.get('/api/auth/me', headers={'Authorization': f"Bearer {data['access_token']}"})
    assert me.status_code != 401

    # E o refresh novo também renova, de novo.
    assert _refresh(client, data['refresh_token']).status_code == 200



def test_reuso_de_token_rotacionado_revoga_a_familia(client, login):
    """Quem reapresenta um token já trocado pode ser o ladrão ou a vítima; não
    dá para saber qual, então a cadeia inteira morre e os dois voltam ao login."""
    original = login()['refresh_token']
    sucessor = _refresh(client, original).get_json()['refresh_token']

    reuso = _refresh(client, original)

    assert reuso.status_code == 401
    assert _refresh(client, sucessor).status_code == 401


def test_reuso_nao_derruba_outras_sessoes_do_usuario(client, login):
    """Cada login abre uma família própria: o reuso num aparelho não desloga o outro."""
    aparelho_a = login()['refresh_token']
    aparelho_b = login()['refresh_token']
    _refresh(client, aparelho_a)

    assert _refresh(client, aparelho_a).status_code == 401
    assert _refresh(client, aparelho_b).status_code == 200



@pytest.mark.parametrize('corpo', [
    {'refresh_token': 'token-que-nunca-existiu'},
    {'refresh_token': ''},
    {'refresh_token': 123},
    {},
])
def test_refresh_desconhecido_ou_ausente_da_401(client, corpo):
    response = client.post('/api/auth/refresh', json=corpo)

    assert response.status_code == 401


def test_refresh_expirado_da_401(client, login, tokens):
    original = login()['refresh_token']
    for linha in tokens.tokens.values():
        linha['expira_em'] = datetime(2000, 1, 1, tzinfo=timezone.utc)

    assert _refresh(client, original).status_code == 401



def test_usuario_desativado_nao_renova(client, login, tokens):
    original = login()['refresh_token']
    tokens.usuarios_ativos[ID_USUARIO] = False

    response = _refresh(client, original)

    assert response.status_code == 403
    assert response.get_json()['erro'] == 'Usuário desativado'
    assert 'access_token' not in response.get_json()

    # Nem depois de reativado o token velho volta: a desativação o revogou.
    tokens.usuarios_ativos[ID_USUARIO] = True
    assert _refresh(client, original).status_code == 401



def _logout(client, access_token, corpo=None):
    return client.post(
        '/api/auth/logout',
        headers={'Authorization': f'Bearer {access_token}'},
        json=corpo,
    )


def test_logout_revoga_o_refresh_enviado(client, login):
    sessao = login()

    response = _logout(client, sessao['access_token'], {'refresh_token': sessao['refresh_token']})

    assert response.status_code == 200
    assert _refresh(client, sessao['refresh_token']).status_code == 401
    # O comportamento antigo continua: o access token também morre.
    me = client.get('/api/auth/me', headers={'Authorization': f"Bearer {sessao['access_token']}"})
    assert me.status_code == 401


def test_logout_sem_corpo_continua_funcionando(client, login):
    sessao = login()

    assert client.post(
        '/api/auth/logout',
        headers={'Authorization': f"Bearer {sessao['access_token']}"},
    ).status_code == 200
    # Sem refresh no corpo, o refresh do aparelho não é tocado.
    assert _refresh(client, sessao['refresh_token']).status_code == 200


def test_logout_nao_revoga_refresh_de_outro_usuario(client, login, make_token):
    alheio = login()['refresh_token']

    response = _logout(client, make_token('USR-OUTRO-1'), {'refresh_token': alheio})

    assert response.status_code == 200
    assert _refresh(client, alheio).status_code == 200



# ============================================
# Falha de infraestrutura x reuso
# ============================================

def _familia_viva(tokens):
    return any(not linha['revogado'] for linha in tokens.tokens.values())


def test_banco_indisponivel_na_busca_da_503_sem_revogar(client, login, tokens):
    original = login()['refresh_token']
    tokens.indisponivel.add('buscar_por_hash')

    response = _refresh(client, original)

    assert response.status_code == 503
    assert _familia_viva(tokens)
    tokens.indisponivel.clear()
    assert _refresh(client, original).status_code == 200


def test_falha_na_rotacao_da_503_sem_revogar(client, login, tokens):
    original = login()['refresh_token']
    tokens.indisponivel.add('rotacionar')

    response = _refresh(client, original)

    assert response.status_code == 503
    assert _familia_viva(tokens)
    tokens.indisponivel.clear()
    assert _refresh(client, original).status_code == 200


def test_corrida_perdida_na_rotacao_revoga_a_familia(client, login, tokens):
    original = login()['refresh_token']
    tokens.perder_corrida = True

    response = _refresh(client, original)

    assert response.status_code == 401
    assert not _familia_viva(tokens)


# ============================================
# Repositório: ausência vira None, banco fora levanta
# ============================================

def test_repositorio_criar_com_banco_fora_devolve_none(monkeypatch):
    """O login segue sem refresh (ADR-0006)."""
    FakeBanco({'INSERT INTO refresh_tokens': banco.Indisponivel('fora')}).instalar(monkeypatch, repositorio)

    familia = str(uuid.uuid4())
    assert repositorio.RefreshTokenRepository().criar('USR-1', familia, 'h' * 64, datetime.now(timezone.utc)) is None


@pytest.mark.parametrize('metodo,args', [
    ('buscar_por_hash', ('hash',)),
    ('rotacionar', ('RFT-1', 'hash', datetime(2100, 1, 1, tzinfo=timezone.utc))),
])
def test_repositorio_com_banco_fora_levanta_indisponivel(monkeypatch, metodo, args):
    FakeBanco({'refresh_tokens': banco.Indisponivel('fora')}).instalar(monkeypatch, repositorio)

    with pytest.raises(banco.Indisponivel):
        getattr(repositorio.RefreshTokenRepository(), metodo)(*args)


def test_repositorio_busca_inexistente_devolve_none(monkeypatch):
    FakeBanco().instalar(monkeypatch, repositorio)

    assert repositorio.RefreshTokenRepository().buscar_por_hash('hash') is None


def test_repositorio_rotacao_de_token_ja_revogado_devolve_none(monkeypatch):
    fake = FakeBanco().instalar(monkeypatch, repositorio)

    assert repositorio.RefreshTokenRepository().rotacionar('RFT-1', 'hash', datetime(2100, 1, 1)) is None
    assert len(fake.chamadas) == 1  # só o SELECT ... FOR UPDATE


# ============================================
# Repositório contra o PostgreSQL real (TEST_DATABASE_URL)
# ============================================

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')


@pytest.fixture
def pg_usuario(monkeypatch):
    if not TEST_DATABASE_URL:
        pytest.skip('TEST_DATABASE_URL ausente: sem PostgreSQL para o repositório')
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    email = f'refresh-{uuid.uuid4().hex}@exemplo.test'
    id_usuario = banco.consultar_um(
        "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('Refresh', %s, 'x') RETURNING id_usuario",
        (email,),
    )['id_usuario']
    yield id_usuario
    banco.executar('DELETE FROM usuarios WHERE id_usuario = %s', (id_usuario,))
    banco.fechar()


def test_repositorio_real_rotaciona_na_mesma_familia(pg_usuario):
    repo = repositorio.RefreshTokenRepository()
    familia = str(uuid.uuid4())
    expira = datetime.now(timezone.utc) + timedelta(days=1)

    primeiro = repo.criar(pg_usuario, familia, 'a' * 64, expira)
    segundo = repo.rotacionar(primeiro, 'b' * 64, expira)

    assert uuid.UUID(primeiro) and uuid.UUID(segundo)
    antigo = repo.buscar_por_hash('a' * 64)
    novo = repo.buscar_por_hash('b' * 64)
    assert antigo['revogado'] is True and antigo['substituido_por'] == segundo
    assert novo['familia'] == familia and novo['revogado'] is False and novo['usuario_ativo'] is True
    assert novo['expira_em'] > datetime.now(timezone.utc)
    # O antigo já foi trocado: rotacionar de novo perde a corrida.
    assert repo.rotacionar(primeiro, 'c' * 64, expira) is None

    repo.revogar_familia(familia)
    assert repo.buscar_por_hash('b' * 64)['revogado'] is True
