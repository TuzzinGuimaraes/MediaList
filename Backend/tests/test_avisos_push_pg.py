"""Tokens de push, "Avisar sobre Notícias" e o push ao publicar, no PostgreSQL real.

Pelas rotas, com o banco de verdade atrás e o Expo falso. Usa TEST_DATABASE_URL; sem ela, pula.
"""
import os
import uuid

import pytest
import requests

import avisos_push
import banco

from .helpers import FakeExpo

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as rotas'
)


@pytest.fixture
def pg(monkeypatch):
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    criados = {'usuarios': [], 'noticias': []}
    yield criados
    if criados['noticias']:
        banco.executar('DELETE FROM noticias WHERE id_noticia = ANY(%s::uuid[])', (criados['noticias'],))
    if criados['usuarios']:
        banco.executar('DELETE FROM usuarios WHERE id_usuario = ANY(%s::uuid[])', (criados['usuarios'],))
    banco.fechar()


@pytest.fixture
def entrar(make_token):
    def _entrar(id_usuario):
        return {'Authorization': f'Bearer {make_token(id_usuario)}'}

    return _entrar


@pytest.fixture
def expo(monkeypatch):
    falso = FakeExpo()
    monkeypatch.setattr(avisos_push, 'criar_cliente', lambda: falso)
    return falso


def _usuario(pg, nivel='usuario', ativo=True, avisar=True):
    id_usuario = banco.consultar_um(
        "INSERT INTO usuarios (nome_completo, email, senha_hash, nivel_acesso, ativo, avisar_noticias) "
        "VALUES ('PG', %s, 'x', %s, %s, %s) RETURNING id_usuario",
        (f'pg-{uuid.uuid4().hex}@exemplo.test', nivel, ativo, avisar),
    )['id_usuario']
    pg['usuarios'].append(id_usuario)
    return id_usuario


def _token():
    return f'ExponentPushToken[{uuid.uuid4().hex}]'


def _dono(token):
    linha = banco.consultar_um('SELECT id_usuario, plataforma FROM push_tokens WHERE token = %s', (token,))
    return linha and (str(linha['id_usuario']), linha['plataforma'])


def _registrar(client, entrar, id_usuario, token, plataforma='android'):
    return client.put('/api/push/token', headers=entrar(id_usuario), json={'token': token, 'plataforma': plataforma})


def test_registrar_token_grava_o_dono_e_renovar_atualiza_visto_em(pg, client, entrar):
    usuario = _usuario(pg)
    token = _token()

    primeiro = _registrar(client, entrar, usuario, token)
    banco.executar("UPDATE push_tokens SET visto_em = now() - interval '1 day' WHERE token = %s", (token,))
    renovado = _registrar(client, entrar, usuario, token)

    assert (primeiro.status_code, renovado.status_code) == (200, 200)
    assert _dono(token) == (str(usuario), 'android')
    linha = banco.consultar_um('SELECT visto_em > now() - interval \'1 minute\' AS recente FROM push_tokens '
                               'WHERE token = %s', (token,))
    assert linha['recente']


def test_token_de_outro_usuario_muda_de_dono(pg, client, entrar):
    antigo, novo = _usuario(pg), _usuario(pg)
    token = _token()

    _registrar(client, entrar, antigo, token)
    response = _registrar(client, entrar, novo, token, plataforma='ios')

    assert response.status_code == 200
    assert _dono(token) == (str(novo), 'ios')


@pytest.mark.parametrize('corpo', [
    {'token': 'fcm-cru', 'plataforma': 'android'},
    {'token': 'ExponentPushToken[]', 'plataforma': 'android'},
    {'token': 'ExponentPushToken[ok]', 'plataforma': 'windows'},
    {'token': 'ExponentPushToken[ok]'},
])
def test_registrar_token_invalido_responde_400_e_nao_grava(pg, client, entrar, corpo):
    usuario = _usuario(pg)

    response = client.put('/api/push/token', headers=entrar(usuario), json=corpo)

    assert (response.status_code, response.get_json()['codigo']) == (400, 'dados_invalidos')
    assert banco.consultar_um('SELECT count(*) AS n FROM push_tokens WHERE id_usuario = %s', (usuario,))['n'] == 0


def test_rotas_de_token_exigem_login(pg, client):
    assert client.put('/api/push/token', json={'token': _token(), 'plataforma': 'android'}).status_code == 401
    assert client.delete('/api/push/token', json={'token': _token()}).status_code == 401


def test_remover_token_apaga_so_o_do_proprio_usuario(pg, client, entrar):
    dono, outro = _usuario(pg), _usuario(pg)
    meu, alheio = _token(), _token()
    _registrar(client, entrar, dono, meu)
    _registrar(client, entrar, outro, alheio)

    removido = client.delete('/api/push/token', headers=entrar(dono), json={'token': meu})
    tentativa = client.delete('/api/push/token', headers=entrar(dono), json={'token': alheio})

    assert (removido.status_code, tentativa.status_code) == (200, 200)
    assert _dono(meu) is None
    assert _dono(alheio) == (str(outro), 'android')


def test_remover_token_com_formato_invalido_responde_400(pg, client, entrar):
    response = client.delete('/api/push/token', headers=entrar(_usuario(pg)), json={'token': 'x'})

    assert (response.status_code, response.get_json()['codigo']) == (400, 'dados_invalidos')


def test_avisar_noticias_sai_nas_preferencias_e_o_usuario_desliga(pg, client, entrar):
    usuario = _usuario(pg)

    antes = client.get('/api/preferencias', headers=entrar(usuario)).get_json()['preferencias']
    gravado = client.put('/api/preferencias', headers=entrar(usuario), json={'avisar_noticias': False})
    depois = client.get('/api/preferencias', headers=entrar(usuario)).get_json()['preferencias']

    assert antes['avisar_noticias'] is True
    assert gravado.status_code == 200
    assert depois['avisar_noticias'] is False
    assert depois['tema'] == 'light'
    linha = banco.consultar_um('SELECT avisar_noticias, preferencias FROM usuarios WHERE id_usuario = %s', (usuario,))
    assert linha['avisar_noticias'] is False
    assert 'avisar_noticias' not in linha['preferencias']


def test_avisar_episodios_sai_nas_preferencias_e_desliga_sem_mexer_no_de_noticias(pg, client, entrar):
    usuario = _usuario(pg)

    antes = client.get('/api/preferencias', headers=entrar(usuario)).get_json()['preferencias']
    gravado = client.put('/api/preferencias', headers=entrar(usuario), json={'avisar_episodios': False})
    depois = client.get('/api/preferencias', headers=entrar(usuario)).get_json()['preferencias']

    assert antes['avisar_episodios'] is True
    assert gravado.status_code == 200
    assert (depois['avisar_episodios'], depois['avisar_noticias']) == (False, True)
    linha = banco.consultar_um('SELECT avisar_episodios, preferencias FROM usuarios WHERE id_usuario = %s', (usuario,))
    assert linha['avisar_episodios'] is False
    assert 'avisar_episodios' not in linha['preferencias']

    client.put('/api/preferencias', headers=entrar(usuario), json={'avisar_noticias': False})
    final = client.get('/api/preferencias', headers=entrar(usuario)).get_json()['preferencias']
    assert (final['avisar_episodios'], final['avisar_noticias']) == (False, False)


def test_avisar_episodios_recusa_texto(pg, client, entrar):
    response = client.put('/api/preferencias', headers=entrar(_usuario(pg)), json={'avisar_episodios': 'false'})

    assert (response.status_code, response.get_json()['codigo']) == (400, 'dados_invalidos')


def test_outras_preferencias_nao_mexem_no_avisar_noticias(pg, client, entrar):
    usuario = _usuario(pg, avisar=False)

    client.put('/api/preferencias', headers=entrar(usuario), json={'tema': 'dark'})

    preferencias = client.get('/api/preferencias', headers=entrar(usuario)).get_json()['preferencias']
    assert (preferencias['tema'], preferencias['avisar_noticias']) == ('dark', False)


def _publicar(pg, client, entrar, admin, titulo='Temporada nova', conteudo='Saiu a 2ª temporada.'):
    response = client.post('/api/noticias', headers=entrar(admin), json={'titulo': titulo, 'conteudo': conteudo})
    if response.status_code == 201:
        pg['noticias'].append(response.get_json()['id_noticia'])
    return response


def test_publicar_avisa_so_quem_quer_menos_o_autor_e_os_inativos(pg, client, entrar, expo):
    admin = _usuario(pg, 'admin')
    quer, nao_quer, inativo = _usuario(pg), _usuario(pg, avisar=False), _usuario(pg, ativo=False)
    tokens = {nome: _token() for nome in ('quer', 'quer_2', 'nao_quer', 'inativo', 'admin')}
    for nome, dono in (('quer', quer), ('quer_2', quer), ('nao_quer', nao_quer), ('inativo', inativo),
                       ('admin', admin)):
        banco.executar("INSERT INTO push_tokens (token, id_usuario, plataforma) VALUES (%s, %s, 'android')",
                       (tokens[nome], dono))

    response = _publicar(pg, client, entrar, admin)

    assert response.status_code == 201
    enviados = set(expo.tokens)
    assert {tokens['quer'], tokens['quer_2']} <= enviados
    assert not enviados & {tokens['nao_quer'], tokens['inativo'], tokens['admin']}
    mensagem = next(m for _, lote, _, _ in expo.requisicoes for m in lote if m['to'] == tokens['quer'])
    assert mensagem['title'] == 'Temporada nova'
    assert mensagem['body'] == 'Saiu a 2ª temporada.'
    assert mensagem['data'] == {'tipo': 'noticia', 'id_noticia': response.get_json()['id_noticia']}


def test_publicar_apaga_o_token_nao_registrado(pg, client, entrar, expo):
    admin, usuario = _usuario(pg, 'admin'), _usuario(pg)
    vivo, morto = _token(), _token()
    for token in (vivo, morto):
        banco.executar("INSERT INTO push_tokens (token, id_usuario, plataforma) VALUES (%s, %s, 'android')",
                       (token, usuario))
    expo.nao_registrados = {morto}

    _publicar(pg, client, entrar, admin)

    assert _dono(vivo) == (str(usuario), 'android')
    assert _dono(morto) is None


@pytest.mark.parametrize('falha', [requests.ConnectionError('fora'), (503, {'errors': []})])
def test_falha_do_expo_nao_afeta_a_publicacao(pg, client, entrar, expo, falha):
    admin, usuario = _usuario(pg, 'admin'), _usuario(pg)
    token = _token()
    banco.executar("INSERT INTO push_tokens (token, id_usuario, plataforma) VALUES (%s, %s, 'android')",
                   (token, usuario))
    expo.falha = falha

    response = _publicar(pg, client, entrar, admin)

    assert response.status_code == 201
    id_noticia = response.get_json()['id_noticia']
    assert client.get(f'/api/noticias/{id_noticia}').status_code == 200
    assert banco.consultar_um('SELECT count(*) AS n FROM notificacoes WHERE id_noticia = %s AND id_usuario = %s',
                              (id_noticia, usuario))['n'] == 1
    assert _dono(token) == (str(usuario), 'android')
