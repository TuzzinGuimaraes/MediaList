"""Notícias, Notificações e preferências sobre a interface do banco (ticket 12)."""
from datetime import datetime, timezone

from routes import noticias as noticias_routes

from .helpers import FakeAtualizacoes, FakeBanco

ADMIN = {'nivel_acesso': 'admin'}

NOTICIA = {
    'titulo': 'Temporada nova',
    'conteudo': 'Texto',
    'autor': 'Ana Admin',
    'categoria': 'anime',
    'tags': ['anime', 'estreia'],
    'imagem_url': None,
    'data_publicacao': datetime(2026, 11, 13, 10, 0, tzinfo=timezone.utc),
    'visualizacoes': 0,
}


def test_noticias_lista_mais_recentes_com_data_iso(client, monkeypatch):
    fake = FakeBanco({'FROM noticias': [NOTICIA]}).instalar(monkeypatch, noticias_routes)

    response = client.get('/api/noticias?limite=5')

    assert response.status_code == 200
    assert response.get_json() == {'noticias': [{**NOTICIA, 'data_publicacao': '2026-11-13T10:00:00+00:00'}]}
    assert fake.sql('FROM noticias')[0][2] == (5,)


def test_noticias_limite_padrao_e_dez(client, monkeypatch):
    fake = FakeBanco().instalar(monkeypatch, noticias_routes)

    response = client.get('/api/noticias')

    assert response.get_json() == {'noticias': []}
    assert fake.sql('FROM noticias')[0][2] == (10,)


def test_noticia_criada_tem_o_usuario_logado_como_autor(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _id: ADMIN)
    fake = FakeBanco({'INSERT INTO noticias': {'id_noticia': 'NOT-1'}}).instalar(monkeypatch, noticias_routes)

    response = client.post('/api/noticias', headers=admin_headers, json={
        'titulo': 'Nova notícia', 'conteudo': 'Texto', 'autor': 'Ignorado',
        'categoria': 'jogo', 'tags': ['rpg'], 'imagem_url': 'https://img/x.png',
    })

    assert response.status_code == 201
    assert response.get_json() == {'mensagem': 'Notícia criada!', 'id': 'NOT-1'}
    _, _, params = fake.sql('INSERT INTO noticias')[0]
    assert params == ('Nova notícia', 'Texto', 'USR-ADMIN-0001', 'jogo', ['rpg'], 'https://img/x.png')


def test_noticia_sem_campos_opcionais_usa_os_padroes(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _id: ADMIN)
    fake = FakeBanco({'INSERT INTO noticias': {'id_noticia': 'NOT-1'}}).instalar(monkeypatch, noticias_routes)

    response = client.post('/api/noticias', headers=admin_headers, json={'titulo': 'Só título'})

    assert response.status_code == 201
    assert fake.sql('INSERT INTO noticias')[0][2] == ('Só título', '', 'USR-ADMIN-0001', 'geral', [], None)


def test_noticia_sem_titulo_responde_400(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _id: ADMIN)
    fake = FakeBanco().instalar(monkeypatch, noticias_routes)

    response = client.post('/api/noticias', headers=admin_headers, json={'conteudo': 'Sem título'})

    assert response.status_code == 400
    assert response.get_json()['erro'] == 'Título é obrigatório'
    assert fake.chamadas == []


def test_noticia_com_tags_que_nao_sao_lista_de_texto_responde_400(client, admin_headers, monkeypatch):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _id: ADMIN)
    fake = FakeBanco().instalar(monkeypatch, noticias_routes)

    response = client.post('/api/noticias', headers=admin_headers, json={'titulo': 'X', 'tags': 'a,b'})

    assert response.status_code == 400
    assert fake.chamadas == []



NOTIFICACAO = {
    'id_midia': 'MID-1',
    'tipo_midia': 'anime',
    'tipo': 'episodio',
    'titulo': 'Episódio 12',
    'midia_nome': 'Anime X',
    'mensagem': 'Novidade em anime da sua lista: Anime X',
    'lida': False,
    'data_criacao': datetime(2026, 11, 13, 9, 30, tzinfo=timezone.utc),
}


def _instalar_atualizacoes(monkeypatch, **dados):
    from routes import utils as utils_routes

    falso = FakeAtualizacoes(**dados)
    monkeypatch.setattr(utils_routes, 'atualizacoes', falso)
    return falso


def test_notificacoes_do_usuario_logado_com_data_iso(client, auth_headers, monkeypatch):
    falso = _instalar_atualizacoes(monkeypatch, notificacoes=[NOTIFICACAO])

    response = client.get('/api/notificacoes', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json() == {
        'notificacoes': [{**NOTIFICACAO, 'data_criacao': '2026-11-13T09:30:00Z'}],
    }
    assert falso.chamadas == [('notificacoes', 'USR-TEST-0001', False)]


def test_notificacoes_nao_lidas_filtra_pelas_nao_lidas(client, auth_headers, monkeypatch):
    falso = _instalar_atualizacoes(monkeypatch, notificacoes=[{**NOTIFICACAO, 'lida': True}])

    response = client.get('/api/notificacoes?nao_lidas=true', headers=auth_headers)

    assert response.get_json() == {'notificacoes': []}
    assert falso.chamadas == [('notificacoes', 'USR-TEST-0001', True)]


def test_notificacoes_com_nao_lidas_invalido_responde_400(client, auth_headers, monkeypatch):
    falso = _instalar_atualizacoes(monkeypatch, notificacoes=[NOTIFICACAO])

    response = client.get('/api/notificacoes?nao_lidas=talvez', headers=auth_headers)

    assert response.status_code == 400
    assert response.get_json()['detalhes'] == {'nao_lidas': 'Tipo inválido'}
    assert falso.chamadas == []


def test_notificacoes_exigem_login(client):
    assert client.get('/api/notificacoes').status_code == 401


def test_marcar_todas_lidas_conta_as_do_usuario_logado(client, auth_headers, monkeypatch):
    falso = _instalar_atualizacoes(monkeypatch, notificacoes=[dict(NOTIFICACAO), dict(NOTIFICACAO)])

    response = client.put('/api/notificacoes/marcar-todas-lidas', headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json() == {'mensagem': '2 notificações marcadas como lidas'}
    assert falso.chamadas == [('marcar_todas_lidas', 'USR-TEST-0001')]


def _instalar_preferencias(monkeypatch, respostas=None):
    from routes import preferencias as preferencias_routes

    return FakeBanco(respostas).instalar(monkeypatch, preferencias_routes)


def test_preferencias_sem_nada_salvo_saem_com_os_padroes(client, auth_headers, monkeypatch):
    fake = _instalar_preferencias(monkeypatch, {'FROM usuarios': {'preferencias': {}}})

    response = client.get('/api/preferencias', headers=auth_headers)

    assert response.status_code == 200
    # `id_usuario` saiu: é o próprio Usuário logado, e nenhum cliente lia.
    assert response.get_json() == {'preferencias': {'tema': 'light', 'idioma': 'pt-BR', 'notificacoes_ativas': True}}
    assert fake.sql('FROM usuarios')[0][2] == ('USR-TEST-0001',)


def test_preferencias_salvas_vencem_os_padroes(client, auth_headers, monkeypatch):
    _instalar_preferencias(monkeypatch, {'FROM usuarios': {'preferencias': {'tema': 'dark'}}})

    response = client.get('/api/preferencias', headers=auth_headers)

    assert response.get_json()['preferencias']['tema'] == 'dark'
    assert response.get_json()['preferencias']['idioma'] == 'pt-BR'


def test_preferencias_de_usuario_inexistente_respondem_404(client, auth_headers, monkeypatch):
    _instalar_preferencias(monkeypatch)

    response = client.get('/api/preferencias', headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json() == {'erro': 'Usuário não encontrado', 'codigo': 'nao_encontrado'}


def test_preferencias_put_grava_so_os_campos_permitidos(client, auth_headers, monkeypatch):
    fake = _instalar_preferencias(monkeypatch, {'UPDATE usuarios': 1})

    response = client.put('/api/preferencias', headers=auth_headers, json={
        'tema': 'dark', 'notificacoes_ativas': False, 'admin': True,
    })

    assert response.status_code == 200
    assert response.get_json() == {'mensagem': 'Preferências atualizadas com sucesso!', 'modificado': True}
    _, _, params = fake.sql('UPDATE usuarios')[0]
    assert params == ('{"tema": "dark", "notificacoes_ativas": false}', 'USR-TEST-0001')


def test_preferencias_put_sem_campo_valido_responde_400(client, auth_headers, monkeypatch):
    fake = _instalar_preferencias(monkeypatch)

    response = client.put('/api/preferencias', headers=auth_headers, json={'invalido': True})

    assert response.status_code == 400
    assert response.get_json() == {'erro': 'Nenhuma preferência válida fornecida', 'codigo': 'dados_invalidos'}
    assert fake.chamadas == []


def test_preferencias_put_com_tipo_errado_responde_400(client, auth_headers, monkeypatch):
    fake = _instalar_preferencias(monkeypatch)

    response = client.put('/api/preferencias', headers=auth_headers, json={'notificacoes_ativas': 'true'})

    assert response.status_code == 400
    assert response.get_json()['detalhes'] == {'notificacoes_ativas': 'Tipo inválido'}
    assert fake.chamadas == []


def test_preferencias_put_com_tema_que_nao_e_texto_responde_400(client, auth_headers, monkeypatch):
    fake = _instalar_preferencias(monkeypatch)

    response = client.put('/api/preferencias', headers=auth_headers, json={'tema': 1})

    assert response.status_code == 400
    assert response.get_json()['detalhes'] == {'tema': 'Tipo inválido'}
    assert fake.chamadas == []
