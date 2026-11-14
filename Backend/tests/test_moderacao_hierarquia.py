"""Moderação de Usuários (ticket 35): só o admin entra; ninguém ativa, desativa
ou muda o Nível de si mesmo, e um admin não age sobre outro admin."""
import pytest

from banco import Indisponivel
from routes import moderacao as moderacao_routes

from .helpers import FakeBanco

NIVEIS = {
    'USR-ADMIN-0001': 'admin',
    'USR-ADMIN-0002': 'admin',
    'USR-COMUM-0001': 'usuario',
    'USR-COMUM-0002': 'usuario',
}


@pytest.fixture
def banco(monkeypatch):
    """Usuários com o Nível de NIVEIS; registra os UPDATEs."""
    estado = {'updates': [], 'falhar_update': False}

    def alvo(_sql, params):
        return {'id_usuario': params[0]} if params[0] in NIVEIS else None

    def update(sql, params):
        if estado['falhar_update']:
            raise Indisponivel('Banco indisponível')
        estado['updates'].append((sql, params))
        return 1

    monkeypatch.setattr('decorators.nivel_de_acesso', lambda user_id: NIVEIS.get(user_id, 'usuario'))
    FakeBanco({'SELECT id_usuario': alvo, 'UPDATE usuarios': update}).instalar(monkeypatch, moderacao_routes)
    return estado


def _headers(make_token, user_id):
    return {'Authorization': f'Bearer {make_token(user_id)}'}


def _mudar_nivel(client, make_token, ator, alvo, nivel):
    return client.put(
        f'/api/moderacao/usuarios/{alvo}/nivel', headers=_headers(make_token, ator), json={'nivel_acesso': nivel},
    )


@pytest.mark.parametrize('acao', ['desativar', 'ativar'])
def test_ninguem_altera_o_proprio_status(client, make_token, banco, acao):
    resposta = client.put(
        f'/api/moderacao/usuarios/USR-ADMIN-0001/{acao}', headers=_headers(make_token, 'USR-ADMIN-0001'),
    )
    assert (resposta.status_code, resposta.get_json()['codigo']) == (403, 'acesso_negado')
    assert banco['updates'] == []


@pytest.mark.parametrize('acao', ['desativar', 'ativar'])
def test_admin_nao_altera_outro_admin(client, make_token, banco, acao):
    resposta = client.put(
        f'/api/moderacao/usuarios/USR-ADMIN-0002/{acao}', headers=_headers(make_token, 'USR-ADMIN-0001'),
    )
    assert (resposta.status_code, resposta.get_json()) == (403, {
        'erro': 'Não é possível alterar outro administrador', 'codigo': 'acesso_negado'})
    assert banco['updates'] == []


def test_admin_desativa_e_ativa_usuario(client, make_token, banco):
    headers = _headers(make_token, 'USR-ADMIN-0001')

    desativar = client.put('/api/moderacao/usuarios/USR-COMUM-0001/desativar', headers=headers)
    ativar = client.put('/api/moderacao/usuarios/USR-COMUM-0001/ativar', headers=headers)

    assert (desativar.status_code, desativar.get_json()) == (200, {'mensagem': 'Usuário desativado com sucesso'})
    assert (ativar.status_code, ativar.get_json()) == (200, {'mensagem': 'Usuário ativado com sucesso'})
    assert banco['updates'][0][0].startswith('UPDATE usuarios SET ativo = FALSE')
    assert banco['updates'][1][0].startswith('UPDATE usuarios SET ativo = TRUE')
    assert banco['updates'][0][1] == ('USR-COMUM-0001',)


@pytest.mark.parametrize('acao', ['desativar', 'ativar'])
def test_alvo_inexistente_responde_404(client, make_token, banco, acao):
    resposta = client.put(
        f'/api/moderacao/usuarios/USR-NAO-EXISTE/{acao}', headers=_headers(make_token, 'USR-ADMIN-0001'),
    )
    assert resposta.get_json() == {'erro': 'Usuário não encontrado', 'codigo': 'nao_encontrado'}
    assert banco['updates'] == []


def test_falha_no_banco_nao_responde_sucesso(client, make_token, banco):
    banco['falhar_update'] = True
    resposta = client.put(
        '/api/moderacao/usuarios/USR-COMUM-0001/desativar', headers=_headers(make_token, 'USR-ADMIN-0001'),
    )
    assert resposta.status_code == 503


@pytest.mark.parametrize('metodo, rota', [
    ('get', '/api/moderacao/usuarios'),
    ('get', '/api/moderacao/avaliacoes'),
    ('put', '/api/moderacao/usuarios/USR-COMUM-0002/desativar'),
    ('put', '/api/moderacao/usuarios/USR-COMUM-0002/ativar'),
])
def test_usuario_comum_barrado_pelo_decorador_recebe_o_envelope_de_erro(client, make_token, banco, metodo, rota):
    resposta = getattr(client, metodo)(rota, headers=_headers(make_token, 'USR-COMUM-0001'))
    assert resposta.status_code == 403
    assert resposta.get_json() == {'erro': 'Acesso restrito a administradores', 'codigo': 'acesso_negado'}
    assert banco['updates'] == []


def test_admin_promove_usuario_a_admin(client, make_token, banco):
    resposta = _mudar_nivel(client, make_token, 'USR-ADMIN-0001', 'USR-COMUM-0001', 'admin')

    assert (resposta.status_code, resposta.get_json()) == (200, {'mensagem': 'Nível de acesso alterado'})
    [(sql, params)] = banco['updates']
    assert sql.startswith('UPDATE usuarios SET nivel_acesso')
    assert params == ('admin', 'USR-COMUM-0001')


@pytest.mark.parametrize('ator, alvo, erro', [
    ('USR-ADMIN-0001', 'USR-ADMIN-0001', 'Você não pode alterar o próprio nível de acesso'),
    ('USR-ADMIN-0001', 'USR-ADMIN-0002', 'Não é possível alterar outro administrador'),
    ('USR-COMUM-0001', 'USR-COMUM-0002', 'Acesso restrito a administradores'),
])
def test_nivel_respeita_a_hierarquia(client, make_token, banco, ator, alvo, erro):
    resposta = _mudar_nivel(client, make_token, ator, alvo, 'usuario')

    assert (resposta.status_code, resposta.get_json()) == (403, {'erro': erro, 'codigo': 'acesso_negado'})
    assert banco['updates'] == []


def test_nivel_de_alvo_inexistente_responde_404(client, make_token, banco):
    resposta = _mudar_nivel(client, make_token, 'USR-ADMIN-0001', 'USR-NAO-EXISTE', 'admin')

    assert resposta.get_json() == {'erro': 'Usuário não encontrado', 'codigo': 'nao_encontrado'}
    assert banco['updates'] == []


@pytest.mark.parametrize('nivel', ['moderador', '', None])
def test_nivel_fora_da_lista_responde_400(client, make_token, banco, nivel):
    resposta = _mudar_nivel(client, make_token, 'USR-ADMIN-0001', 'USR-COMUM-0001', nivel)

    assert (resposta.status_code, resposta.get_json()['codigo']) == (400, 'dados_invalidos')
    assert banco['updates'] == []
