"""Editar e excluir Notícias (ticket 42 da revisão, Q130) no PostgreSQL real.

Só o admin edita ou exclui, qualquer Notícia. Editar não gera Notificação nem push e marca
`data_edicao`; excluir apaga de vez, com as Notificações (cascade da migração 0012).
Usa TEST_DATABASE_URL; sem ela, pula. Cada teste apaga o que gravou.
"""
import uuid

import pytest

import avisos_push
import banco

from .test_noticias_notificacoes_pg import (  # noqa: F401 (fixtures)
    TEST_DATABASE_URL,
    _notificacoes,
    _usuario,
    entrar,
    pg,
)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as rotas'
)

CORPO = {
    'titulo': 'Título novo', 'conteudo': 'Conteúdo novo', 'categoria': 'evento',
    'tags': ['nova'], 'imagem_url': 'https://exemplo.test/nova.png',
}


@pytest.fixture
def pushes(monkeypatch):
    chamadas = []
    monkeypatch.setattr(avisos_push, 'avisar_noticia', lambda *args: chamadas.append(args))
    return chamadas


def _publicar(pg, client, headers, titulo='Original'):  # noqa: F811
    criada = client.post('/api/noticias', headers=headers, json={'titulo': titulo, 'tags': ['velha']})
    id_noticia = criada.get_json()['id_noticia']
    pg['noticias'].append(id_noticia)
    return id_noticia


def test_admin_edita_qualquer_noticia_sem_notificar_nem_avisar(pg, client, entrar, pushes):  # noqa: F811
    autor = _usuario(pg, 'admin', nome='Ana Admin')
    outro_admin = _usuario(pg, 'admin')
    leitor = _usuario(pg)
    id_noticia = _publicar(pg, client, entrar(autor))
    pushes.clear()
    antes = banco.consultar_um('SELECT count(*) AS n FROM notificacoes')['n']

    editada = client.put(f'/api/noticias/{id_noticia}', headers=entrar(outro_admin), json=CORPO)

    assert editada.status_code == 200
    assert editada.get_json() == {'mensagem': 'Notícia atualizada!'}
    noticia = client.get(f'/api/noticias/{id_noticia}').get_json()
    assert {k: noticia[k] for k in CORPO} == CORPO
    assert noticia['autor'] == 'Ana Admin'
    assert noticia['data_edicao'] is not None and noticia['data_edicao'] >= noticia['data_publicacao']
    assert banco.consultar_um('SELECT count(*) AS n FROM notificacoes')['n'] == antes
    [notificacao] = _notificacoes(client, entrar(leitor))
    assert notificacao['lida'] is False
    assert pushes == []


def test_noticia_nunca_editada_sai_sem_data_de_edicao(pg, client, entrar):  # noqa: F811
    admin = _usuario(pg, 'admin')
    id_noticia = _publicar(pg, client, entrar(admin))

    assert client.get(f'/api/noticias/{id_noticia}').get_json()['data_edicao'] is None
    assert client.get('/api/noticias?por_pagina=1').get_json()['itens'][0]['data_edicao'] is None


def test_editar_sem_campos_opcionais_usa_os_padroes(pg, client, entrar):  # noqa: F811
    admin = _usuario(pg, 'admin')
    id_noticia = _publicar(pg, client, entrar(admin))
    client.put(f'/api/noticias/{id_noticia}', headers=entrar(admin), json=CORPO)

    client.put(f'/api/noticias/{id_noticia}', headers=entrar(admin), json={'titulo': 'Só título'})

    noticia = client.get(f'/api/noticias/{id_noticia}').get_json()
    campos = ('conteudo', 'categoria', 'tags', 'imagem_url')
    assert tuple(noticia[c] for c in campos) == ('', 'geral', [], None)


def test_editar_valida_como_a_criacao(pg, client, entrar):  # noqa: F811
    admin = _usuario(pg, 'admin')
    id_noticia = _publicar(pg, client, entrar(admin))

    vazio = client.put(f'/api/noticias/{id_noticia}', headers=entrar(admin), json={'titulo': '  '})
    tags = client.put(f'/api/noticias/{id_noticia}', headers=entrar(admin), json={'titulo': 'x', 'tags': 'a'})

    assert (vazio.status_code, vazio.get_json()['codigo']) == (400, 'dados_invalidos')
    assert 'titulo' in vazio.get_json()['detalhes']
    assert tags.status_code == 400
    assert client.get(f'/api/noticias/{id_noticia}').get_json()['titulo'] == 'Original'


def test_admin_exclui_e_as_notificacoes_somem_de_todos(pg, client, entrar):  # noqa: F811
    autor = _usuario(pg, 'admin')
    outro_admin = _usuario(pg, 'admin')
    leitores = [_usuario(pg), _usuario(pg)]
    id_noticia = _publicar(pg, client, entrar(autor))
    assert banco.consultar_um('SELECT count(*) AS n FROM notificacoes WHERE id_noticia = %s', (id_noticia,))['n'] >= 3

    excluida = client.delete(f'/api/noticias/{id_noticia}', headers=entrar(outro_admin))

    assert excluida.status_code == 200
    assert excluida.get_json() == {'mensagem': 'Notícia excluída!'}
    assert client.get(f'/api/noticias/{id_noticia}').status_code == 404
    assert banco.consultar('SELECT 1 FROM notificacoes WHERE id_noticia = %s', (id_noticia,)) == []
    for leitor in leitores:
        assert _notificacoes(client, entrar(leitor)) == []


@pytest.mark.parametrize('metodo', ['put', 'delete'])
def test_usuario_comum_recebe_403_e_nada_muda(pg, client, entrar, metodo):  # noqa: F811
    admin = _usuario(pg, 'admin')
    comum = _usuario(pg)
    id_noticia = _publicar(pg, client, entrar(admin))

    response = getattr(client, metodo)(f'/api/noticias/{id_noticia}', headers=entrar(comum), json=CORPO)

    assert (response.status_code, response.get_json()['codigo']) == (403, 'acesso_negado')
    assert client.get(f'/api/noticias/{id_noticia}').get_json()['titulo'] == 'Original'


@pytest.mark.parametrize('metodo', ['put', 'delete'])
def test_sem_login_responde_401(pg, client, entrar, metodo):  # noqa: F811
    admin = _usuario(pg, 'admin')
    id_noticia = _publicar(pg, client, entrar(admin))

    response = getattr(client, metodo)(f'/api/noticias/{id_noticia}', json=CORPO)

    assert response.status_code == 401
    assert client.get(f'/api/noticias/{id_noticia}').get_json()['titulo'] == 'Original'


@pytest.mark.parametrize('metodo', ['put', 'delete'])
def test_noticia_inexistente_responde_404(pg, client, entrar, metodo):  # noqa: F811
    admin = _usuario(pg, 'admin')

    response = getattr(client, metodo)(f'/api/noticias/{uuid.uuid4()}', headers=entrar(admin), json=CORPO)

    assert (response.status_code, response.get_json()['codigo']) == (404, 'nao_encontrado')
