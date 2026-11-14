from routes import moderacao as moderacao_routes
from routes import usuario as usuario_routes
from routes import utils as utils_routes

from .helpers import FakeBanco, FakeCatalogo


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
    assert response.get_json() == {'permissoes': {
        'nivel_acesso': 'admin',
        'grupos': 'Administradores',
        'pode_criar': True,
        'pode_editar': True,
        'pode_deletar': True,
        'pode_moderar': True,
    }}


def test_usuario_perfil_retorna_404_quando_view_nao_tem_registro(client, auth_headers, monkeypatch):
    FakeBanco().instalar(monkeypatch, usuario_routes)

    response = client.get('/api/usuario/perfil', headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json() == {'erro': 'Perfil não encontrado', 'codigo': 'nao_encontrado'}


def test_moderacao_lista_avaliacoes_para_admin(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    FakeBanco({'FROM avaliacoes': [{'id_avaliacao': 'AVL-1'}]}).instalar(monkeypatch, moderacao_routes)

    response = client.get('/api/moderacao/avaliacoes', headers=admin_headers)

    assert response.status_code == 200
    assert response.get_json()['avaliacoes'][0]['id_avaliacao'] == 'AVL-1'


def test_populares_repassa_o_tipo_ao_catalogo(client, monkeypatch):
    catalogo = FakeCatalogo(populares=[{'id_midia': 'MID-POP', 'tipo': 'anime'}, {'id_midia': 'MID-J', 'tipo': 'jogo'}])
    monkeypatch.setattr(utils_routes, 'catalogo', catalogo)

    por_tipo = client.get('/api/midias/populares?tipo=anime')
    todas = client.get('/api/midias/populares')

    assert (por_tipo.status_code, por_tipo.get_json()) == (200, {'midias': [{'id_midia': 'MID-POP', 'tipo': 'anime'}]})
    assert len(todas.get_json()['midias']) == 2
    assert catalogo.chamadas == [('populares', 'anime'), ('populares', None)]


def test_usuario_permissoes_saem_como_booleanos(client, auth_headers, monkeypatch):
    monkeypatch.setattr(usuario_routes, 'get_user_permissions', lambda _user_id: {
        'nivel_acesso': 'usuario', 'grupos': None,
        'pode_criar': 1, 'pode_editar': 0, 'pode_deletar': 0, 'pode_moderar': 0,
    })

    permissoes = client.get('/api/usuario/permissoes', headers=auth_headers).get_json()['permissoes']

    assert [permissoes[p] for p in ('pode_criar', 'pode_editar', 'pode_deletar', 'pode_moderar')] == [
        True, False, False, False,
    ]
    assert all(type(permissoes[p]) is bool for p in ('pode_criar', 'pode_editar', 'pode_deletar', 'pode_moderar'))
