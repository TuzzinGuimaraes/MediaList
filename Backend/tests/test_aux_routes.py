import pytest

import banco
from routes import moderacao as moderacao_routes
from routes import usuario as usuario_routes
from routes import utils as utils_routes

from .helpers import FakeBanco, FakeCatalogo


def test_get_usuario_perfil_retorna_dados(client, auth_headers, monkeypatch):
    FakeBanco({'vw_perfil_usuario': {'id_usuario': 'USR-TEST-0001', 'nome_completo': 'Perfil'}}).instalar(
        monkeypatch, usuario_routes
    )

    response = client.get('/api/usuario/perfil', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()['perfil']['nome_completo'] == 'Perfil'


def test_get_usuario_estatisticas_monta_resumo(client, auth_headers, monkeypatch):
    fake = FakeBanco({'FROM lista_usuarios': [
        {'tipo': 'anime', 'total_midias': 2, 'concluidos': 1, 'em_andamento': 1, 'favoritos': 1},
        {'tipo': 'jogo', 'total_midias': 3, 'concluidos': 2, 'em_andamento': 1, 'favoritos': 0},
    ]}).instalar(monkeypatch, usuario_routes)

    response = client.get('/api/usuario/estatisticas', headers=auth_headers)

    data = response.get_json()
    assert response.status_code == 200
    # Era a procedure obter_estatisticas_usuario: agora é consulta da aplicação.
    assert 'CALL' not in fake.chamadas[0][1]
    assert fake.chamadas[0][2] == ('USR-TEST-0001',)
    assert data['resumo'] == {
        'total_midias': 5,
        'concluidos': 3,
        'em_andamento': 2,
        'favoritos': 1,
    }


def test_utils_health_reporta_postgres_conectado(client, monkeypatch):
    FakeBanco({'SELECT 1': {'ok': 1}}).instalar(monkeypatch, utils_routes)

    response = client.get('/api/health')

    assert response.status_code == 200
    assert response.get_json() == {'status': 'healthy', 'postgres': 'connected'}


def test_utils_health_sem_postgres_responde_503(client, monkeypatch):
    FakeBanco({'SELECT 1': banco.Indisponivel('fora')}).instalar(monkeypatch, utils_routes)

    response = client.get('/api/health')

    assert response.status_code == 503
    assert response.get_json() == {'status': 'unhealthy', 'postgres': 'disconnected'}


def test_moderacao_bloqueia_usuario_comum(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        'decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'usuario', 'pode_moderar': 0}
    )

    response = client.get('/api/moderacao/usuarios', headers=auth_headers)

    assert response.status_code == 403


def test_moderacao_lista_usuarios_para_admin_paginados_com_o_total(client, admin_headers, monkeypatch):
    from datetime import datetime, timezone

    usuario = {
        'id_usuario': 'USR-1', 'nome_completo': 'Ana', 'email': 'ana@exemplo.test',
        'data_cadastro': datetime(2026, 11, 1, 12, tzinfo=timezone.utc), 'ultimo_acesso': None, 'ativo': True,
        'grupos': 'Usuários', 'total_midias': 3, 'total_avaliacoes': 1,
    }
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    fake = FakeBanco({'count(*)': {'total': 7}, 'FROM usuarios': [usuario]}).instalar(monkeypatch, moderacao_routes)

    response = client.get('/api/moderacao/usuarios?pagina=2&por_pagina=3', headers=admin_headers)

    assert response.status_code == 200
    assert response.get_json() == {
        'itens': [{**usuario, 'data_cadastro': '2026-11-01T12:00:00Z'}], 'pagina': 2, 'por_pagina': 3, 'total': 7,
    }
    assert fake.sql('LIMIT')[0][2] == (3, 3)


@pytest.mark.parametrize('rota', ['/api/animes', '/api/mangas', '/api/jogos', '/api/animes/populares'])
def test_rotas_por_tipo_sairam(client, rota):
    """Ficou só /midias?tipo= (ticket 14): nenhum cliente usava as rotas por Tipo."""
    assert client.get(rota).status_code == 404


def test_generos_devolve_aplicavel_a_como_lista_e_filtra_pelo_tipo(client, monkeypatch):
    """`aplicavel_a` é text[] no PostgreSQL e sai como lista no JSON."""
    acao = {'id_genero': 1, 'nome_genero': 'Ação', 'aplicavel_a': ['anime', 'manga', 'jogo']}
    catalogo = FakeCatalogo(generos=[acao, {'id_genero': 2, 'nome_genero': 'Mecha', 'aplicavel_a': ['anime']}])
    monkeypatch.setattr(utils_routes, 'catalogo', catalogo)

    assert client.get('/api/generos').get_json()['generos'][0]['aplicavel_a'] == ['anime', 'manga', 'jogo']
    response = client.get('/api/generos?tipo=jogo')

    assert (response.status_code, response.get_json()) == (200, {'generos': [{**acao, 'id_genero': '1'}]})
    assert catalogo.chamadas == [('generos', None), ('generos', 'jogo')]
