from decimal import Decimal

import pytest

import banco
from routes import avaliacoes as avaliacoes_routes
from routes import moderacao as moderacao_routes
from routes import usuario as usuario_routes
from routes import utils as utils_routes

from .helpers import FakeBanco


def test_get_avaliacoes_lista_vazia(client, monkeypatch):
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id})
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'obter_avaliacoes', lambda _id: [])

    response = client.get('/api/avaliacoes/MID-1')

    assert response.status_code == 200
    assert response.get_json()['avaliacoes'] == []


def test_post_avaliacao_cria_registro(client, auth_headers, monkeypatch):
    fake = FakeBanco({
        'INSERT INTO avaliacoes': {'id_avaliacao': 'AVL-1'},
        'vw_notas_midia': {'nota_media': Decimal('9.00'), 'total_avaliacoes': 4},
    }).instalar(monkeypatch, avaliacoes_routes)
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id})

    response = client.post('/api/avaliacoes', headers=auth_headers, json={
        'id_midia': 'MID-1',
        'nota': 9,
        'titulo_avaliacao': 'Excelente',
    })

    data = response.get_json()
    assert response.status_code == 201
    assert data['id_avaliacao'] == 'AVL-1'
    assert data['nota_media_atualizada'] == 9.0
    assert data['total_avaliacoes'] == 4
    # INSERT e leitura da Nota média na mesma transação.
    assert fake.transacoes == 1


@pytest.mark.parametrize('nota', [10, 0])
def test_post_avaliacao_com_nota_nos_extremos_grava(client, auth_headers, monkeypatch, nota):
    """10 não cabia no DECIMAL(3,2) do MySQL e 0 era recusado por `not nota`."""
    fake = FakeBanco({
        'INSERT INTO avaliacoes': {'id_avaliacao': 'AVL-10'},
        'vw_notas_midia': {'nota_media': Decimal(nota), 'total_avaliacoes': 1},
    }).instalar(monkeypatch, avaliacoes_routes)
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id})

    response = client.post('/api/avaliacoes', headers=auth_headers, json={'id_midia': 'MID-1', 'nota': nota})

    assert response.status_code == 201
    assert response.get_json()['nota_media_atualizada'] == nota
    assert fake.sql('INSERT INTO avaliacoes')[0][2][2] == nota


def test_post_avaliacao_sem_nota_responde_400(client, auth_headers):
    response = client.post('/api/avaliacoes', headers=auth_headers, json={'id_midia': 'MID-1'})

    assert response.status_code == 400


@pytest.mark.parametrize('nota', [8.55, 10.5, -1, 'oito', True])
def test_post_avaliacao_fora_da_escala_responde_400_sem_gravar(client, auth_headers, monkeypatch, nota):
    fake = FakeBanco().instalar(monkeypatch, avaliacoes_routes)
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id})

    response = client.post('/api/avaliacoes', headers=auth_headers, json={'id_midia': 'MID-1', 'nota': nota})

    assert response.status_code == 400
    assert response.get_json()['erro'] == 'A nota vai de 0 a 10, com no máximo uma casa decimal'
    assert response.get_json()['detalhes'] == {'nota': 'A nota vai de 0 a 10, com no máximo uma casa decimal'}
    assert not fake.sql('INSERT INTO avaliacoes')


def test_post_avaliacao_com_uma_casa_grava_a_nota(client, auth_headers, monkeypatch):
    fake = FakeBanco({'INSERT INTO avaliacoes': {'id_avaliacao': 'AVL-1'}}).instalar(monkeypatch, avaliacoes_routes)
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id})

    response = client.post('/api/avaliacoes', headers=auth_headers, json={'id_midia': 'MID-1', 'nota': '8,5'})

    assert response.status_code == 201
    assert fake.sql('INSERT INTO avaliacoes')[0][2][2] == 8.5


def test_put_avaliacao_fora_da_escala_responde_400_sem_gravar(client, auth_headers, monkeypatch):
    fake = FakeBanco({'FROM avaliacoes': {'id_usuario': 'USR-TEST-0001', 'id_midia': 'MID-1'}}).instalar(
        monkeypatch, avaliacoes_routes
    )

    response = client.put('/api/avaliacoes/AVL-1', headers=auth_headers, json={'nota': 8.55})

    assert response.status_code == 400
    assert response.get_json()['detalhes'] == {'nota': 'A nota vai de 0 a 10, com no máximo uma casa decimal'}
    assert not fake.sql('UPDATE avaliacoes')


def test_post_avaliacao_repetida_responde_409_pela_unique(client, auth_headers, monkeypatch):
    """Sem SELECT prévio: a UNIQUE (id_usuario, id_midia) decide, inclusive na corrida."""
    monkeypatch.setattr(avaliacoes_routes.midia_repository, 'buscar_por_id', lambda _id: {'id_midia': _id})
    fake = FakeBanco({
        'INSERT INTO avaliacoes': banco.Conflito('Registro já existe', 'uk_avaliacoes_usuario_midia'),
    }).instalar(monkeypatch, avaliacoes_routes)

    response = client.post('/api/avaliacoes', headers=auth_headers, json={
        'id_midia': 'MID-1',
        'nota': 8,
    })

    assert response.status_code == 409
    assert response.get_json() == {'erro': 'Você já avaliou esta mídia'}
    assert not fake.sql('SELECT id_avaliacao')


def test_put_avaliacao_restringe_edicao_ao_autor(client, auth_headers, monkeypatch):
    FakeBanco({'FROM avaliacoes': {'id_usuario': 'USR-OUTRO', 'id_midia': 'MID-1'}}).instalar(
        monkeypatch, avaliacoes_routes
    )

    response = client.put('/api/avaliacoes/AVL-1', headers=auth_headers, json={'nota': 7})

    assert response.status_code == 403


def test_delete_avaliacao_permite_moderador(client, auth_headers, monkeypatch):
    fake = FakeBanco({'SELECT id_usuario': {'id_usuario': 'USR-OUTRO'}}).instalar(monkeypatch, avaliacoes_routes)
    monkeypatch.setattr(avaliacoes_routes, 'get_user_permissions', lambda _user_id: {'pode_moderar': 1})

    response = client.delete('/api/avaliacoes/AVL-1', headers=auth_headers)

    assert response.status_code == 200
    assert fake.sql('DELETE FROM avaliacoes')


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


def test_utils_generos_filtra_por_tipo(client, monkeypatch):
    fake = FakeBanco({'FROM generos': [{'nome_genero': 'Ação'}]}).instalar(monkeypatch, utils_routes)

    response = client.get('/api/generos?tipo=anime')

    assert response.status_code == 200
    assert response.get_json()['generos'][0]['nome_genero'] == 'Ação'
    assert fake.chamadas[0][2] == ('anime',)


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


def test_generos_devolve_aplicavel_a_como_lista(client, monkeypatch):
    """`aplicavel_a` é text[] no PostgreSQL e sai como lista no JSON."""
    FakeBanco({'FROM generos': [
        {'id_genero': 1, 'nome_genero': 'Ação', 'aplicavel_a': ['anime', 'manga', 'jogo']},
    ]}).instalar(monkeypatch, utils_routes)

    response = client.get('/api/generos')

    assert response.status_code == 200
    assert response.get_json()['generos'][0]['aplicavel_a'] == ['anime', 'manga', 'jogo']


def test_generos_filtra_por_tipo_sem_casar_substring(client, monkeypatch):
    """'?tipo=nim' não pode casar com 'anime': o filtro é por elemento do array."""
    fake = FakeBanco().instalar(monkeypatch, utils_routes)

    client.get('/api/generos?tipo=anime')

    _metodo, query, params = fake.chamadas[0]
    assert 'aplicavel_a @> ARRAY[%s]' in query
    assert 'LIKE' not in query
    assert params == ('anime',)
