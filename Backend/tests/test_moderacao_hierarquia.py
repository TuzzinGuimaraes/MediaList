"""Hierarquia da moderação: só se ativa/desativa quem tem Nível de acesso
estritamente menor que o seu, nunca a si mesmo."""
import pytest

from banco import Indisponivel
from routes import moderacao as moderacao_routes

from .helpers import FakeBanco

NIVEIS = {
    'USR-ADMIN-0001': 'admin',
    'USR-ADMIN-0002': 'admin',
    'USR-MOD-0001': 'moderador',
    'USR-MOD-0002': 'moderador',
    'USR-COMUM-0001': 'usuario',
}


@pytest.fixture
def banco(monkeypatch):
    """Usuários com o Nível efetivo de NIVEIS; registra os UPDATEs."""
    estado = {'updates': [], 'falhar_update': False}

    def fake_permissions(user_id):
        nivel = NIVEIS.get(user_id, 'usuario')
        return {'nivel_acesso': nivel, 'pode_moderar': 1 if nivel != 'usuario' else 0}

    def alvo(_sql, params):
        return {'id_usuario': params[0]} if params[0] in NIVEIS else None

    def update(sql, params):
        if estado['falhar_update']:
            raise Indisponivel('Banco indisponível')
        estado['updates'].append((sql, params))
        return 1

    monkeypatch.setattr('decorators.get_user_permissions', fake_permissions)
    FakeBanco({'SELECT id_usuario': alvo, 'UPDATE usuarios': update}).instalar(monkeypatch, moderacao_routes)
    return estado


def _headers(make_token, user_id):
    return {'Authorization': f'Bearer {make_token(user_id)}'}


@pytest.mark.parametrize('acao', ['desativar', 'ativar'])
def test_ninguem_altera_a_si_mesmo(client, make_token, banco, acao):
    resposta = client.put(
        f'/api/moderacao/usuarios/USR-ADMIN-0001/{acao}', headers=_headers(make_token, 'USR-ADMIN-0001'),
    )
    assert resposta.status_code == 403
    assert banco['updates'] == []


@pytest.mark.parametrize('ator, alvo', [
    ('USR-MOD-0001', 'USR-MOD-0002'),
    ('USR-ADMIN-0001', 'USR-ADMIN-0002'),
])
def test_nivel_igual_nao_pode(client, make_token, banco, ator, alvo):
    resposta = client.put(f'/api/moderacao/usuarios/{alvo}/desativar', headers=_headers(make_token, ator))
    assert resposta.status_code == 403
    assert banco['updates'] == []


def test_moderador_nao_desativa_admin(client, make_token, banco):
    resposta = client.put(
        '/api/moderacao/usuarios/USR-ADMIN-0001/desativar', headers=_headers(make_token, 'USR-MOD-0001'),
    )
    assert resposta.status_code == 403
    assert banco['updates'] == []


@pytest.mark.parametrize('ator, alvo', [
    ('USR-MOD-0001', 'USR-COMUM-0001'),
    ('USR-ADMIN-0001', 'USR-MOD-0001'),
    ('USR-ADMIN-0001', 'USR-COMUM-0001'),
])
def test_nivel_menor_pode_ser_desativado_e_ativado(client, make_token, banco, ator, alvo):
    headers = _headers(make_token, ator)

    desativar = client.put(f'/api/moderacao/usuarios/{alvo}/desativar', headers=headers)
    ativar = client.put(f'/api/moderacao/usuarios/{alvo}/ativar', headers=headers)

    assert desativar.status_code == 200
    assert ativar.status_code == 200
    assert banco['updates'][0][0].startswith('UPDATE usuarios SET ativo = FALSE')
    assert banco['updates'][1][0].startswith('UPDATE usuarios SET ativo = TRUE')
    assert banco['updates'][0][1] == (alvo,)


@pytest.mark.parametrize('acao', ['desativar', 'ativar'])
def test_alvo_inexistente_responde_404(client, make_token, banco, acao):
    resposta = client.put(
        f'/api/moderacao/usuarios/USR-NAO-EXISTE/{acao}', headers=_headers(make_token, 'USR-ADMIN-0001'),
    )
    assert resposta.status_code == 404
    assert banco['updates'] == []


def test_falha_no_banco_nao_responde_sucesso(client, make_token, banco):
    banco['falhar_update'] = True
    resposta = client.put(
        '/api/moderacao/usuarios/USR-COMUM-0001/desativar', headers=_headers(make_token, 'USR-ADMIN-0001'),
    )
    assert resposta.status_code == 503
