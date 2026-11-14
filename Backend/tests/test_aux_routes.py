from datetime import datetime, timezone
from decimal import Decimal

import pytest

import banco
from routes import moderacao as moderacao_routes
from routes import usuario as usuario_routes
from routes import utils as utils_routes

from .helpers import FakeBanco, FakeCatalogo

PERFIL = {
    'id_usuario': 'USR-TEST-0001',
    'nome_completo': 'Perfil',
    'email': 'perfil@example.com',
    'foto_perfil': None,
    'biografia': None,
    'data_cadastro': datetime(2026, 11, 13, 10, 30, tzinfo=timezone.utc),
    'total_midias': 3,
    'total_animes': 2,
    'total_mangas': 0,
    'total_jogos': 1,
    'nota_media_usuario': Decimal('8.50'),
    'total_favoritos': 1,
    'grupos': 'Usuários',
}


def test_get_usuario_perfil_retorna_dados(client, auth_headers, monkeypatch):
    FakeBanco({'vw_perfil_usuario': PERFIL}).instalar(monkeypatch, usuario_routes)

    response = client.get('/api/usuario/perfil', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json() == {'perfil': {
        **PERFIL, 'data_cadastro': '2026-11-13T10:30:00Z', 'nota_media_usuario': 8.5,
    }}


def _estatistica(tipo, total_midias, concluidos, em_andamento, favoritos, nota_media=None):
    return {
        'tipo': tipo, 'label': tipo.title(), 'total_midias': total_midias, 'concluidos': concluidos,
        'em_andamento': em_andamento, 'progresso_total_consumido': 10, 'nota_media': nota_media,
        'favoritos': favoritos,
    }


def test_get_usuario_estatisticas_monta_resumo(client, auth_headers, monkeypatch):
    fake = FakeBanco({'FROM lista_usuarios': [
        _estatistica('anime', 2, 1, 1, 1, Decimal('7.50')),
        _estatistica('jogo', 3, 2, 1, 0),
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
    # `label` saiu: nenhum cliente lia, e o Tipo já vem em `tipo`.
    assert data['estatisticas'][0] == {
        'tipo': 'anime', 'total_midias': 2, 'concluidos': 1, 'em_andamento': 1,
        'progresso_total_consumido': 10, 'nota_media': 7.5, 'favoritos': 1,
    }
    assert data['estatisticas'][1]['nota_media'] is None


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


def test_moderacao_lista_usuarios_para_admin(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    FakeBanco({'FROM usuarios': [{'id_usuario': 'USR-1'}]}).instalar(monkeypatch, moderacao_routes)

    response = client.get('/api/moderacao/usuarios', headers=admin_headers)

    assert response.status_code == 200
    assert response.get_json()['usuarios'][0]['id_usuario'] == 'USR-1'


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
