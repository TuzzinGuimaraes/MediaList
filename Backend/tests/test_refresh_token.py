"""Refresh token rotativo (ADR-0006), pelo cliente Flask.

O banco entra por duas costuras: `execute_query`/`get_user_permissions` para o
login (como em test_auth_routes.py) e o repositório de refresh tokens, trocado
por uma tabela em memória.
"""
from datetime import datetime

import pytest
from werkzeug.security import generate_password_hash

from routes import auth as auth_routes

ID_USUARIO = 'USR-REFRESH-1'


@pytest.fixture
def tokens(refresh_tokens):
    """A tabela em memória que o conftest já pôs no lugar do repositório."""
    return refresh_tokens


@pytest.fixture
def login(client, monkeypatch, tokens):
    monkeypatch.setattr(
        auth_routes,
        'execute_query',
        lambda query, params=None, fetch=True: (
            [{
                'id_usuario': ID_USUARIO,
                'nome_completo': 'Usuário Refresh',
                'email': 'refresh@example.com',
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
        linha['expira_em'] = datetime(2000, 1, 1)

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


def test_banco_indisponivel_na_busca_da_500_sem_revogar(client, login, tokens):
    original = login()['refresh_token']
    tokens.indisponivel.add('buscar_por_hash')

    response = _refresh(client, original)

    assert response.status_code == 500
    assert _familia_viva(tokens)
    tokens.indisponivel.clear()
    assert _refresh(client, original).status_code == 200


def test_falha_na_rotacao_da_500_sem_revogar(client, login, tokens):
    original = login()['refresh_token']
    tokens.indisponivel.add('rotacionar')

    response = _refresh(client, original)

    assert response.status_code == 500
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
# Repositório: infraestrutura vira exceção, ausência vira None
# ============================================

class _CursorQuebrado:
    def execute(self, *_args, **_kwargs):
        raise RuntimeError('conexão perdida')

    def close(self):
        pass


def _repo(monkeypatch, connection):
    from repositories import refresh_token_repository as modulo
    monkeypatch.setattr(modulo, 'get_db_connection', lambda: connection)
    return modulo.RefreshTokenRepository()


@pytest.mark.parametrize('metodo,args', [
    ('buscar_por_hash', ('hash',)),
    ('rotacionar', ('RFT-1', 'hash', datetime(2100, 1, 1))),
])
def test_repositorio_sem_conexao_levanta_indisponivel(monkeypatch, metodo, args):
    from repositories import RefreshTokenIndisponivel
    repo = _repo(monkeypatch, None)

    with pytest.raises(RefreshTokenIndisponivel):
        getattr(repo, metodo)(*args)


@pytest.mark.parametrize('metodo,args', [
    ('buscar_por_hash', ('hash',)),
    ('rotacionar', ('RFT-1', 'hash', datetime(2100, 1, 1))),
])
def test_repositorio_com_erro_de_query_levanta_indisponivel(monkeypatch, metodo, args):
    from repositories import RefreshTokenIndisponivel

    from .helpers import FakeConnection
    connection = FakeConnection(_CursorQuebrado())
    repo = _repo(monkeypatch, connection)

    with pytest.raises(RefreshTokenIndisponivel):
        getattr(repo, metodo)(*args)
    assert connection.closed


def test_repositorio_busca_inexistente_devolve_none(monkeypatch):
    from .helpers import FakeConnection, FakeCursor
    repo = _repo(monkeypatch, FakeConnection(FakeCursor()))

    assert repo.buscar_por_hash('hash') is None


def test_repositorio_rotacao_de_token_ja_revogado_devolve_none(monkeypatch):
    from .helpers import FakeConnection, FakeCursor
    cursor = FakeCursor()
    connection = FakeConnection(cursor)
    repo = _repo(monkeypatch, connection)

    assert repo.rotacionar('RFT-1', 'hash', datetime(2100, 1, 1)) is None
    assert len(cursor.executed) == 1  # só o SELECT ... FOR UPDATE
    assert connection.rolled_back


def test_repositorio_rotacao_insere_sucessor_e_revoga_o_atual(monkeypatch):
    from .helpers import FakeConnection, FakeCursor
    cursor = FakeCursor(fetchone_results=[{'id_usuario': 'USR-1', 'familia': 'FAM-1'}])
    connection = FakeConnection(cursor)
    repo = _repo(monkeypatch, connection)

    novo_id = repo.rotacionar('RFT-1', 'hash-novo', datetime(2100, 1, 1))

    assert novo_id.startswith('RFT-')
    insert, update = cursor.executed[1], cursor.executed[2]
    assert 'INSERT INTO refresh_tokens' in insert[0]
    assert insert[1] == (novo_id, 'hash-novo', 'USR-1', 'FAM-1', datetime(2100, 1, 1))
    assert update[1] == (novo_id, 'RFT-1')
    assert connection.committed and connection.closed
