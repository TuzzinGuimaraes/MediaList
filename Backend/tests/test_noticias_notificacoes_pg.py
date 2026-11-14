"""Notícias, Atualizações de mídia, Notificações e preferências no PostgreSQL real.

Pelas rotas, com o banco de verdade atrás. Usa TEST_DATABASE_URL (usuário da
aplicação, schema migrado); sem ela, pula. Cada teste apaga o que gravou.
"""
import os
import uuid

import pytest

import banco
from repositories import Catalogo

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as rotas'
)


@pytest.fixture
def pg(monkeypatch):
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    criados = {'midias': [], 'usuarios': [], 'noticias': []}
    yield criados
    if criados['noticias']:
        banco.executar('DELETE FROM noticias WHERE id_noticia = ANY(%s::uuid[])', (criados['noticias'],))
    if criados['midias']:
        banco.executar('DELETE FROM midias WHERE id_midia = ANY(%s::uuid[])', (criados['midias'],))
    if criados['usuarios']:
        banco.executar('DELETE FROM usuarios WHERE id_usuario = ANY(%s::uuid[])', (criados['usuarios'],))
    banco.fechar()


@pytest.fixture
def entrar(make_token):
    def _entrar(id_usuario):
        return {'Authorization': f'Bearer {make_token(id_usuario)}'}

    return _entrar


def _usuario(pg, grupo='Usuários', nome='PG'):
    with banco.transacao() as t:
        id_usuario = t.consultar_um(
            "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES (%s, %s, 'x') RETURNING id_usuario",
            (nome, f'pg-{uuid.uuid4().hex}@exemplo.test'),
        )['id_usuario']
        t.executar(
            "INSERT INTO usuarios_grupos (id_usuario, id_grupo) "
            "SELECT %s, id_grupo FROM grupos_usuarios WHERE nome_grupo = %s",
            (id_usuario, grupo),
        )
    pg['usuarios'].append(id_usuario)
    return id_usuario


def _anime(pg):
    id_midia = Catalogo().criar(
        'anime', {'titulo_original': f'PG {uuid.uuid4().hex}', 'titulo_portugues': 'Anime PG'},
    )
    pg['midias'].append(id_midia)
    return id_midia


def _na_lista(id_usuario, id_midia, status, favorito=False):
    banco.executar(
        'INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo, favorito) VALUES (%s, %s, %s, %s)',
        (id_usuario, id_midia, status, favorito),
    )


def test_noticia_publicada_sai_na_lista_com_o_nome_do_autor(pg, client, entrar):
    admin = _usuario(pg, 'Administradores', nome='Ana Admin')
    titulo = f'Notícia PG {uuid.uuid4().hex}'

    antes = client.get('/api/noticias').get_json()['total']
    criada = client.post('/api/noticias', headers=entrar(admin), json={
        'titulo': titulo, 'conteudo': 'Texto', 'tags': ['anime', 'estreia'],
    })
    pg['noticias'].append(criada.get_json()['id'])
    pagina = client.get('/api/noticias?por_pagina=1').get_json()

    assert criada.status_code == 201
    assert pagina['total'] == antes + 1
    [noticia] = pagina['itens']
    assert noticia['id_noticia'] == criada.get_json()['id']
    assert noticia['titulo'] == titulo
    assert noticia['autor'] == 'Ana Admin'
    assert noticia['tags'] == ['anime', 'estreia']
    assert noticia['categoria'] == 'geral'
    assert 'T' in noticia['data_publicacao']


def test_noticias_paginadas_sem_repetir_nem_pular(pg, client, entrar):
    admin = _usuario(pg, 'Administradores')
    for i in range(3):
        criada = client.post('/api/noticias', headers=entrar(admin), json={'titulo': f'Página {i}'})
        pg['noticias'].append(criada.get_json()['id'])

    primeira = client.get('/api/noticias?por_pagina=2').get_json()
    segunda = client.get('/api/noticias?por_pagina=2&pagina=2').get_json()

    ids = [n['id_noticia'] for n in primeira['itens'] + segunda['itens']]
    assert ids[:3] == list(reversed(pg['noticias']))
    assert len(set(ids)) == len(ids)


def test_atualizacao_notifica_so_quem_tem_a_midia_na_lista(pg, client, entrar):
    admin = _usuario(pg, 'Administradores')
    assistindo = _usuario(pg)
    favorito_completo = _usuario(pg)
    completo = _usuario(pg)
    sem_a_midia = _usuario(pg)
    id_midia = _anime(pg)
    outra_midia = _anime(pg)
    _na_lista(assistindo, id_midia, 'assistindo')
    _na_lista(favorito_completo, id_midia, 'completo', favorito=True)
    _na_lista(completo, id_midia, 'completo')
    _na_lista(sem_a_midia, outra_midia, 'assistindo')

    response = client.post(f'/api/midias/{id_midia}/atualizacoes', headers=entrar(admin), json={
        'tipo': 'episodio', 'titulo': 'Episódio 12', 'dados_adicionais': {'episodio': 12},
    })

    assert response.status_code == 201
    assert response.get_json()['notificacoes_enviadas'] == 2
    [notificacao] = client.get('/api/notificacoes', headers=entrar(assistindo)).get_json()['notificacoes']
    assert {k: v for k, v in notificacao.items() if k != 'data_criacao'} == {
        'id_midia': id_midia, 'tipo_midia': 'anime', 'tipo': 'episodio',
        'titulo': 'Episódio 12', 'midia_nome': 'Anime PG',
        'mensagem': 'Novidade em anime da sua lista: Anime PG', 'lida': False,
    }
    assert len(client.get('/api/notificacoes', headers=entrar(favorito_completo)).get_json()['notificacoes']) == 1
    assert client.get('/api/notificacoes', headers=entrar(completo)).get_json()['notificacoes'] == []
    assert client.get('/api/notificacoes', headers=entrar(sem_a_midia)).get_json()['notificacoes'] == []

    [atualizacao] = client.get(f'/api/midias/{id_midia}').get_json()['atualizacoes']
    assert atualizacao['titulo'] == 'Episódio 12'
    assert atualizacao['dados_adicionais'] == {'episodio': 12}


def test_falha_ao_notificar_desfaz_a_atualizacao(pg, client, entrar, monkeypatch):
    admin = _usuario(pg, 'Administradores')
    assistindo = _usuario(pg)
    id_midia = _anime(pg)
    _na_lista(assistindo, id_midia, 'assistindo')

    original = banco.Transacao.executar

    def executar(self, sql, params=None):
        if 'INSERT INTO notificacoes' in sql:
            raise RuntimeError('falha depois de gravar a Atualização')
        return original(self, sql, params)

    monkeypatch.setattr(banco.Transacao, 'executar', executar)

    response = client.post(f'/api/midias/{id_midia}/atualizacoes', headers=entrar(admin), json={
        'tipo': 'episodio', 'titulo': 'Nunca gravada',
    })

    assert response.status_code == 500
    assert banco.consultar('SELECT 1 FROM atualizacoes_midia WHERE id_midia = %s', (id_midia,)) == []


def test_marcar_todas_lidas_so_mexe_nas_do_usuario(pg, client, entrar):
    admin = _usuario(pg, 'Administradores')
    eu = _usuario(pg)
    outro = _usuario(pg)
    id_midia = _anime(pg)
    _na_lista(eu, id_midia, 'assistindo')
    _na_lista(outro, id_midia, 'planejado')
    for titulo in ('Episódio 1', 'Episódio 2'):
        client.post(f'/api/midias/{id_midia}/atualizacoes', headers=entrar(admin), json={
            'tipo': 'episodio', 'titulo': titulo,
        })

    marcar = client.put('/api/notificacoes/marcar-todas-lidas', headers=entrar(eu))

    assert marcar.get_json() == {'mensagem': '2 notificações marcadas como lidas'}
    assert client.get('/api/notificacoes?nao_lidas=true', headers=entrar(eu)).get_json()['notificacoes'] == []
    minhas = client.get('/api/notificacoes', headers=entrar(eu)).get_json()['notificacoes']
    assert [n['titulo'] for n in minhas] == ['Episódio 2', 'Episódio 1']
    assert all(n['lida'] for n in minhas)
    assert len(client.get('/api/notificacoes?nao_lidas=true', headers=entrar(outro)).get_json()['notificacoes']) == 2


def test_preferencias_salvas_sao_lidas_com_os_padroes_no_resto(pg, client, entrar):
    eu = _usuario(pg)

    inicial = client.get('/api/preferencias', headers=entrar(eu)).get_json()['preferencias']
    client.put('/api/preferencias', headers=entrar(eu), json={'tema': 'dark'})
    salvo = client.put('/api/preferencias', headers=entrar(eu), json={'notificacoes_ativas': False})
    depois = client.get('/api/preferencias', headers=entrar(eu)).get_json()['preferencias']

    assert inicial == {'tema': 'light', 'idioma': 'pt-BR', 'notificacoes_ativas': True}
    assert salvo.get_json()['modificado'] is True
    assert depois == {'tema': 'dark', 'idioma': 'pt-BR', 'notificacoes_ativas': False}
