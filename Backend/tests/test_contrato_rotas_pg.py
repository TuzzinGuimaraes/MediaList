"""Contrato JSON das rotas que o web e o app usam, pelo app, com o PostgreSQL real.

Fixa as chaves e os códigos HTTP de /midias, /lista, /avaliacoes, /generos e
/usuario/estatisticas. As chaves esperadas são as que a API respondia antes da
divisão em Catálogo, Lista pessoal e Avaliação (ticket 14): o teste passa antes
e depois dela. Os dados entram pela Importação (`importacao.db`) e por SQL, não
pelos módulos que o teste protege. Usa TEST_DATABASE_URL; sem ela, pula.
"""
import random
import uuid

import pytest

import banco
from importacao import db as importacao

from .test_repositorios_pg import TEST_DATABASE_URL, _usuario, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o contrato das rotas'
)

CHAVES_MIDIA = {
    'anime_anilist_id', 'anime_trailer_url', 'autor', 'banner_url', 'classificacao', 'classificacao_etaria',
    'codigo_anime', 'codigo_midia', 'data_lancamento', 'demografia', 'desenvolvedor', 'duracao_episodio',
    'estudio', 'fonte_original', 'generos', 'generos_lista', 'id_anime', 'id_midia', 'jogo_trailer_url',
    'manga_anilist_id', 'manga_artista', 'modo_jogo', 'nota_fonte', 'nota_media', 'numero_capitulos',
    'numero_episodios', 'numero_volumes', 'origem_nota', 'plataformas', 'poster_url', 'progresso_total_padrao',
    'publicadora', 'publicadora_original', 'rawg_slug', 'revista', 'sinopse', 'status_anime', 'status_catalogo',
    'status_jogo', 'status_manga', 'tipo', 'tipo_label', 'titulo_ingles', 'titulo_original', 'titulo_portugues',
    'total_avaliacoes', 'total_concluidos', 'total_usuarios', 'trailer_url', 'unidade_progresso',
}
CHAVES_ITEM = CHAVES_MIDIA | {
    'codigo_lista', 'comentario', 'data_adicao', 'data_atualizacao', 'data_conclusao', 'data_inicio',
    'episodios_assistidos', 'favorito', 'id_lista', 'nota_usuario', 'privado', 'progresso_atual',
    'progresso_total', 'status_consumo', 'status_visualizacao', 'total_rewatches',
}
CHAVES_POPULAR = {
    'codigo_midia', 'generos', 'id_midia', 'nota_fonte', 'nota_media', 'origem_nota', 'poster_url', 'tipo',
    'tipo_label', 'titulo_original', 'titulo_portugues', 'total_favoritos', 'total_usuarios',
    'usuarios_concluiram',
}
CHAVES_AVALIACAO = {
    'data_avaliacao', 'data_edicao', 'dislikes', 'foto_perfil', 'generos_lista', 'id_avaliacao', 'id_midia',
    'id_usuario', 'likes', 'nome_completo', 'nota', 'texto_avaliacao', 'titulo_avaliacao',
}
CHAVES_ATUALIZACAO = {
    'id_midia', 'tipo_midia', 'tipo_atualizacao', 'titulo', 'descricao', 'dados_adicionais', 'data_atualizacao',
}
CHAVES_ESTATISTICA = {
    'tipo', 'label', 'total_midias', 'concluidos', 'em_andamento', 'progresso_total_consumido', 'nota_media',
    'favoritos',
}
INEXISTENTE = '00000000-0000-7000-8000-000000000000'
ESCALA = 'A nota vai de 0 a 10, com no máximo uma casa decimal'


@pytest.fixture
def prefixo():
    return f'CTR{uuid.uuid4().hex[:8]}'


@pytest.fixture
def catalogo(pg, prefixo):  # noqa: F811
    """Um anime de 12 episódios, um mangá e um jogo, importados com o prefixo no título."""
    def salvar(funcao, dados, generos=('Ação',)):
        id_midia = funcao({'titulo_original': f'{prefixo} {uuid.uuid4().hex}', **dados}, list(generos))['id_midia']
        pg['midias'].append(id_midia)
        return id_midia

    return {
        'anime': salvar(importacao.salvar_anime, {
            'anilist_id': random.randint(10**8, 2 * 10**9), 'status_anime': 'finalizado', 'numero_episodios': 12,
            'nota_fonte': 7.5, 'estudio': 'Estúdio CTR',
        }),
        'manga': salvar(importacao.salvar_manga, {
            'anilist_id': random.randint(10**8, 2 * 10**9), 'status_manga': 'finalizado', 'numero_capitulos': 30,
            'autor': 'Autor CTR', 'demografia': 'seinen',
        }),
        'jogo': salvar(importacao.salvar_jogo, {
            'rawg_slug': f'ctr-{uuid.uuid4().hex}', 'status_jogo': 'lancado', 'modo_jogo': 'single',
            'plataformas': ['PC', 'Switch'], 'nota_fonte': 9.0, 'desenvolvedor': 'Dev CTR',
        }),
    }


@pytest.fixture
def entrar(make_token):
    return lambda id_usuario: {'Authorization': f'Bearer {make_token(id_usuario)}'}


def test_listagem_detalhe_trending_e_populares(client, catalogo, prefixo):
    resposta = client.get(f'/api/midias?busca={prefixo}&ordem=nota_media&pagina=1&por_pagina=10')
    corpo = resposta.get_json()

    assert resposta.status_code == 200
    assert set(corpo) == {'midias', 'tipo', 'pagina', 'por_pagina'}
    assert (corpo['tipo'], corpo['pagina'], corpo['por_pagina']) == (None, 1, 10)
    # COALESCE(nota_media, nota_fonte): jogo 9.0, anime 7.5, mangá sem nota no fim.
    assert [m['id_midia'] for m in corpo['midias']] == [catalogo['jogo'], catalogo['anime'], catalogo['manga']]
    assert all(set(m) == CHAVES_MIDIA for m in corpo['midias'])

    jogo = client.get(f'/api/midias?tipo=jogo&busca={prefixo}&plataforma=PC&desenvolvedor=dev')
    assert [m['id_midia'] for m in jogo.get_json()['midias']] == [catalogo['jogo']]
    assert jogo.get_json()['midias'][0]['plataformas'] == 'PC, Switch'
    manga = client.get(f'/api/midias?tipo=manga&busca={prefixo}&demografia=seinen&autor=autor&status=finalizado')
    assert [m['id_midia'] for m in manga.get_json()['midias']] == [catalogo['manga']]

    detalhe = client.get(f'/api/midias/{catalogo["anime"]}')
    assert detalhe.status_code == 200
    assert set(detalhe.get_json()) == CHAVES_MIDIA | {'atualizacoes'}
    assert detalhe.get_json()['generos_lista'] == ['Ação']
    assert (detalhe.get_json()['progresso_total_padrao'], detalhe.get_json()['unidade_progresso']) == (12, 'episodios')
    assert client.get(f'/api/midias/{INEXISTENTE}').get_json() == {'erro': 'Mídia não encontrada'}
    assert client.get(f'/api/midias/{INEXISTENTE}').status_code == 404

    trending = client.get('/api/midias/trending?tipo=jogo&limite=3')
    assert trending.status_code == 200 and set(trending.get_json()) == {'midias'}
    assert all(set(m) == CHAVES_MIDIA for m in trending.get_json()['midias'])

    populares = client.get('/api/midias/populares?tipo=anime')
    assert populares.status_code == 200 and set(populares.get_json()) == {'midias'}
    assert all(set(m) == CHAVES_POPULAR for m in populares.get_json()['midias'])

    distribuicao = client.get(f'/api/midias/{catalogo["anime"]}/distribuicao')
    assert distribuicao.status_code == 200 and distribuicao.get_json() == {'distribuicao': []}

    generos = client.get('/api/generos?tipo=jogo')
    assert generos.status_code == 200
    assert {'id_genero', 'nome_genero', 'descricao', 'aplicavel_a'} == set(generos.get_json()['generos'][0])


def test_atualizacao_aparece_no_detalhe(client, catalogo, pg, entrar):  # noqa: F811
    admin = _usuario(pg, 'Administradores')

    criada = client.post(f'/api/midias/{catalogo["anime"]}/atualizacoes', headers=entrar(admin), json={
        'tipo': 'episodio', 'titulo': 'Episódio 13',
    })

    assert criada.status_code == 201
    assert criada.get_json() == {'mensagem': 'Atualização adicionada!', 'notificacoes_enviadas': 0}
    atualizacoes = client.get(f'/api/midias/{catalogo["anime"]}').get_json()['atualizacoes']
    assert [set(a) for a in atualizacoes] == [CHAVES_ATUALIZACAO]


def test_lista_pessoal_do_adicionar_ao_remover(client, catalogo, pg, entrar):  # noqa: F811
    usuario, outro = _usuario(pg), _usuario(pg)
    eu, ele = entrar(usuario), entrar(outro)
    anime = catalogo['anime']

    assert client.get('/api/lista', headers=eu).get_json() == {'lista': []}
    recusado = client.post('/api/lista/adicionar', headers=eu, json={'id_midia': anime, 'status_consumo': 'platinado'})
    assert recusado.status_code == 400 and set(recusado.get_json()) == {'erro', 'detalhes'}

    criado = client.post('/api/lista/adicionar', headers=eu, json={'id_midia': anime, 'status': 'assistindo'})
    assert criado.status_code == 201
    assert set(criado.get_json()) == {'mensagem', 'id_lista'}
    id_lista = criado.get_json()['id_lista']
    repetido = client.post('/api/lista/adicionar', headers=eu, json={'id_midia': anime, 'status_consumo': 'planejado'})
    assert repetido.status_code == 400
    assert repetido.get_json() == {
        'erro': 'Mídia já está na lista do usuário', 'detalhes': {'id_midia': 'Mídia já está na lista do usuário'},
    }

    editado = client.put(f'/api/lista/{id_lista}', headers=eu, json={'nota_usuario': 8.5, 'favorito': 1})
    assert (editado.status_code, editado.get_json()) == (200, {'mensagem': 'Lista atualizada com sucesso!'})
    progresso = client.put(f'/api/lista/{id_lista}/progresso', headers=eu, json={'episodios_assistidos': 12})
    assert (progresso.status_code, progresso.get_json()) == (200, {'mensagem': 'Progresso atualizado com sucesso!'})
    alheio = client.put(f'/api/lista/{id_lista}', headers=ele, json={'favorito': True})
    assert (alheio.status_code, alheio.get_json()) == (403, {'erro': 'Item não encontrado ou sem permissão'})

    lista = client.get('/api/lista?tipo=anime', headers=eu).get_json()['lista']
    assert [set(i) for i in lista] == [CHAVES_ITEM]
    assert (lista[0]['status_consumo'], lista[0]['progresso_atual'], lista[0]['nota_usuario'], lista[0]['favorito']) \
        == ('completo', 12, 8.5, True)
    assert client.get('/api/lista?status=assistindo', headers=eu).get_json() == {'lista': []}

    estatisticas = client.get('/api/usuario/estatisticas', headers=eu).get_json()
    assert set(estatisticas) == {'estatisticas', 'resumo'}
    assert [set(e) for e in estatisticas['estatisticas']] == [CHAVES_ESTATISTICA]
    assert estatisticas['resumo'] == {'total_midias': 1, 'concluidos': 1, 'em_andamento': 0, 'favoritos': 1}

    assert client.delete(f'/api/lista/{id_lista}', headers=ele).status_code == 403
    removido = client.delete(f'/api/lista/{id_lista}', headers=eu)
    assert (removido.status_code, removido.get_json()) == (200, {'mensagem': 'Mídia removida da lista'})
    assert client.delete(f'/api/lista/{id_lista}', headers=eu).status_code == 403


def test_avaliacao_do_criar_ao_apagar(client, catalogo, pg, entrar):  # noqa: F811
    autora, outra = _usuario(pg), _usuario(pg)
    ela, intrusa = entrar(autora), entrar(outra)
    jogo = catalogo['jogo']

    assert client.get(f'/api/avaliacoes/{jogo}').get_json() == {'avaliacoes': []}
    assert client.get(f'/api/avaliacoes/{INEXISTENTE}').status_code == 404
    sem_nota = client.post('/api/avaliacoes', headers=ela, json={'id_midia': jogo})
    assert (sem_nota.status_code, sem_nota.get_json()) == (400, {'erro': 'ID da mídia e nota são obrigatórios'})
    fora = client.post('/api/avaliacoes', headers=ela, json={'id_midia': jogo, 'nota': 8.55})
    assert (fora.status_code, fora.get_json()) == (400, {'erro': ESCALA, 'detalhes': {'nota': ESCALA}})
    sem_midia = client.post('/api/avaliacoes', headers=ela, json={'id_midia': INEXISTENTE, 'nota': 7})
    assert (sem_midia.status_code, sem_midia.get_json()) == (404, {'erro': 'Mídia não encontrada'})

    criada = client.post('/api/avaliacoes', headers=ela, json={'id_anime': jogo, 'nota': 8, 'titulo_avaliacao': 'T'})
    assert criada.status_code == 201
    assert set(criada.get_json()) == {'mensagem', 'id_avaliacao', 'nota_media_atualizada', 'total_avaliacoes'}
    assert (criada.get_json()['nota_media_atualizada'], criada.get_json()['total_avaliacoes']) == (8.0, 1)
    id_avaliacao = criada.get_json()['id_avaliacao']
    repetida = client.post('/api/avaliacoes', headers=ela, json={'id_midia': jogo, 'nota': 3})
    assert (repetida.status_code, repetida.get_json()) == (409, {'erro': 'Você já avaliou esta mídia'})

    avaliacoes = client.get(f'/api/avaliacoes/{jogo}').get_json()['avaliacoes']
    assert [set(a) for a in avaliacoes] == [CHAVES_AVALIACAO]

    assert client.put(f'/api/avaliacoes/{id_avaliacao}', headers=ela, json={}).get_json() == {
        'erro': 'Dados não fornecidos'}
    assert client.put(f'/api/avaliacoes/{id_avaliacao}', headers=ela, json={'x': 1}).get_json() == {
        'erro': 'Nenhum campo para atualizar'}
    assert client.put(f'/api/avaliacoes/{id_avaliacao}', headers=ela, json={'nota': 11}).status_code == 400
    alheia = client.put(f'/api/avaliacoes/{id_avaliacao}', headers=intrusa, json={'nota': 1})
    assert (alheia.status_code, alheia.get_json()) == (403, {'erro': 'Avaliação não encontrada ou sem permissão'})
    inexistente = client.put(f'/api/avaliacoes/{INEXISTENTE}', headers=ela, json={'nota': 1})
    assert (inexistente.status_code, inexistente.get_json()) == (
        403, {'erro': 'Avaliação não encontrada ou sem permissão'})
    editada = client.put(f'/api/avaliacoes/{id_avaliacao}', headers=ela, json={'nota': '9,5'})
    assert (editada.status_code, editada.get_json()) == (
        200, {'mensagem': 'Avaliação atualizada com sucesso!', 'nota_media_atualizada': 9.5})

    negada = client.delete(f'/api/avaliacoes/{id_avaliacao}', headers=intrusa)
    assert (negada.status_code, negada.get_json()) == (403, {'erro': 'Sem permissão para deletar esta avaliação'})
    apagada = client.delete(f'/api/avaliacoes/{id_avaliacao}', headers=ela)
    assert (apagada.status_code, apagada.get_json()) == (200, {'mensagem': 'Avaliação removida com sucesso'})
    de_novo = client.delete(f'/api/avaliacoes/{id_avaliacao}', headers=ela)
    assert (de_novo.status_code, de_novo.get_json()) == (404, {'erro': 'Avaliação não encontrada'})


def test_moderador_apaga_avaliacao_de_outro(client, catalogo, pg, entrar):  # noqa: F811
    autora, moderador = _usuario(pg), _usuario(pg, 'Moderadores')
    criada = client.post('/api/avaliacoes', headers=entrar(autora), json={'id_midia': catalogo['anime'], 'nota': 6})

    apagada = client.delete(f'/api/avaliacoes/{criada.get_json()["id_avaliacao"]}', headers=entrar(moderador))

    assert apagada.status_code == 200
    assert banco.consultar_um('SELECT count(*) AS n FROM avaliacoes WHERE id_usuario = %s', (autora,))['n'] == 0
