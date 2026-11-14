from routes import moderacao as moderacao_routes
from routes import usuario as usuario_routes

from .helpers import FakeBanco


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
    assert response.get_json()['permissoes']['nivel_acesso'] == 'admin'


def test_usuario_perfil_retorna_404_quando_view_nao_tem_registro(client, auth_headers, monkeypatch):
    FakeBanco().instalar(monkeypatch, usuario_routes)

    response = client.get('/api/usuario/perfil', headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json()['erro'] == 'Perfil não encontrado'


def test_moderacao_lista_avaliacoes_para_admin(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    FakeBanco({'FROM avaliacoes': [{'id_avaliacao': 'AVL-1'}]}).instalar(monkeypatch, moderacao_routes)

    response = client.get('/api/moderacao/avaliacoes', headers=admin_headers)

    assert response.status_code == 200
    assert response.get_json()['avaliacoes'][0]['id_avaliacao'] == 'AVL-1'

