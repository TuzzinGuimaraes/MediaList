from routes import avaliacoes as avaliacoes_routes
from routes import moderacao as moderacao_routes
from routes import usuario as usuario_routes
from routes import utils as utils_routes

from .helpers import FakeBanco


def test_put_avaliacao_atualiza_campos_e_retorna_nota_media(client, auth_headers, monkeypatch):
    fake = FakeBanco({
        'SELECT id_usuario, id_midia': {'id_usuario': 'USR-TEST-0001', 'id_midia': 'MID-1'},
        'vw_notas_midia': {'nota_media': 8.7, 'total_avaliacoes': 3},
    }).instalar(monkeypatch, avaliacoes_routes)

    response = client.put('/api/avaliacoes/AVL-1', headers=auth_headers, json={
        'nota': 9,
        'titulo_avaliacao': 'Atualizada',
    })

    assert response.status_code == 200
    assert response.get_json()['nota_media_atualizada'] == 8.7
    assert fake.sql('UPDATE avaliacoes SET')


def test_delete_avaliacao_bloqueia_usuario_sem_permissao(client, auth_headers, monkeypatch):
    FakeBanco({'SELECT id_usuario': {'id_usuario': 'USR-OUTRO'}}).instalar(monkeypatch, avaliacoes_routes)
    monkeypatch.setattr(avaliacoes_routes, 'get_user_permissions', lambda _user_id: {'pode_moderar': 0})

    response = client.delete('/api/avaliacoes/AVL-1', headers=auth_headers)

    assert response.status_code == 403
    assert response.get_json()['erro'] == 'Sem permissão para deletar esta avaliação'


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


def test_utils_populares_consulta_a_view(client, monkeypatch):
    fake = FakeBanco({
        'vw_midias_populares': [{'id_midia': 'MID-POP'}],
    }).instalar(monkeypatch, utils_routes)

    response_populares = client.get('/api/midias/populares?tipo=anime')

    assert response_populares.status_code == 200
    assert response_populares.get_json()['midias'][0]['id_midia'] == 'MID-POP'
    assert fake.sql('vw_midias_populares')
