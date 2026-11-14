"""Rotas de /midias com o Catálogo e as Atualizações trocados por falsos em memória.

O SQL do Catálogo é provado contra o PostgreSQL em `test_repositorios_pg.py` e
`test_notas_pg.py`; aqui só o que a rota faz: ler parâmetros, chamar, responder.
"""
from datetime import UTC, datetime

import pytest

from routes import midias as midias_routes

from .helpers import FakeAtualizacoes, FakeCatalogo, linha_de_midia

#: Uma linha de `Catalogo.buscar`/`obter`, com todas as colunas do SELECT_MIDIA.
LINHA_ANIME = linha_de_midia()
ANIME_X = LINHA_ANIME
#: Apelidos legados do SELECT_MIDIA e campos sem leitor: ficam fora do contrato (contrato-api 03).
CAMPOS_FORA_DO_CONTRATO = {
    'id_anime', 'codigo_midia', 'codigo_anime', 'tipo_label', 'anime_trailer_url', 'jogo_trailer_url',
    'anime_anilist_id', 'manga_anilist_id', 'rawg_slug', 'manga_artista', 'progresso_total_padrao',
    'unidade_progresso',
}
ATUALIZACAO = {
    'id_midia': 'MID-1', 'tipo_midia': 'anime', 'tipo_atualizacao': 'episodio', 'titulo': 'Ep 12',
    'descricao': None, 'dados_adicionais': {}, 'data_atualizacao': datetime(2026, 11, 6, 10, tzinfo=UTC),
}
NAO_ENCONTRADA = {'erro': 'Mídia não encontrada', 'codigo': 'nao_encontrado'}
LINHA_JOGO = {**LINHA_ANIME, 'tipo': 'jogo', 'status_anime': None, 'numero_episodios': None, 'status_jogo': 'lancado'}


@pytest.fixture
def catalogo(monkeypatch):
    def _instalar(midias=None, **extra):
        falso = FakeCatalogo(midias if midias is not None else {'MID-1': dict(ANIME_X)}, **extra)
        monkeypatch.setattr(midias_routes, 'catalogo', falso)
        return falso

    return _instalar


@pytest.fixture
def atualizacoes(monkeypatch):
    def _instalar(**dados):
        falso = FakeAtualizacoes(**dados)
        monkeypatch.setattr(midias_routes, 'atualizacoes', falso)
        return falso

    return _instalar


@pytest.fixture
def admin(monkeypatch, admin_headers):
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'admin'})
    return admin_headers


def test_get_midias_repassa_filtros_ao_catalogo(client, catalogo):
    falso = catalogo({'MID-J': dict(LINHA_JOGO)})

    response = client.get(
        '/api/midias?tipo=jogo&pagina=1&por_pagina=15&busca=zelda&genero=Aventura'
        '&status=lancado&plataforma=Switch&desenvolvedor=Nintendo&modo_jogo=single&ordem=titulo'
    )

    assert response.status_code == 200
    corpo = response.get_json()
    assert {k: v for k, v in corpo.items() if k != 'itens'} == {'pagina': 1, 'por_pagina': 15, 'total': 1}
    assert [m['id_midia'] for m in corpo['itens']] == ['MID-J']
    filtros = {
        'busca': 'zelda', 'genero': 'Aventura', 'status': 'lancado', 'autor': None, 'estudio': None,
        'demografia': None, 'plataforma': 'Switch', 'desenvolvedor': 'Nintendo', 'modo_jogo': 'single',
        'artista': None, 'ordem': 'titulo',
    }
    assert falso.chamadas == [('buscar', 'jogo', 1, 15, filtros), ('contar', 'jogo', filtros)]


def test_get_midias_total_conta_todas_as_paginas(client, catalogo):
    catalogo({f'MID-{n}': dict(LINHA_ANIME) for n in range(3)})

    corpo = client.get('/api/midias?tipo=anime&pagina=2&por_pagina=2').get_json()

    assert (len(corpo['itens']), corpo['pagina'], corpo['total']) == (1, 2, 3)


def test_get_midias_sem_ordem_usa_nota_media(client, catalogo):
    falso = catalogo()

    client.get('/api/midias')

    assert falso.chamadas[0][4]['ordem'] == 'nota_media'


@pytest.mark.parametrize('consulta, campo', [('tipo=filme', 'tipo'), ('ordem=aleatoria', 'ordem')])
def test_get_midias_com_tipo_ou_ordem_desconhecidos_responde_400(client, catalogo, consulta, campo):
    falso = catalogo()

    response = client.get(f'/api/midias?{consulta}')

    assert response.status_code == 400
    assert response.get_json() == {
        'erro': 'Dados inválidos', 'codigo': 'dados_invalidos', 'detalhes': {campo: 'Valor fora dos permitidos'},
    }
    assert falso.chamadas == []


def test_midia_sai_sem_os_campos_legados_e_com_artista(client, catalogo):
    catalogo({'MID-M': {**LINHA_ANIME, 'tipo': 'manga', 'manga_artista': 'Artista M'}})

    midia = client.get('/api/midias').get_json()['itens'][0]

    assert not CAMPOS_FORA_DO_CONTRATO & set(midia)
    assert midia['artista'] == 'Artista M'


def test_detalhe_traz_as_atualizacoes_recentes(client, catalogo, atualizacoes):
    catalogo()
    falso = atualizacoes(recentes=[ATUALIZACAO])

    response = client.get('/api/midias/MID-1')

    assert response.status_code == 200
    corpo = response.get_json()
    assert (corpo['id_midia'], corpo['titulo_original'], corpo['numero_episodios']) == ('MID-1', 'Frieren', 28)
    assert not CAMPOS_FORA_DO_CONTRATO & set(corpo)
    assert corpo['atualizacoes'] == [{**ATUALIZACAO, 'data_atualizacao': '2026-11-06T10:00:00Z'}]
    assert falso.chamadas == [('recentes', 'MID-1')]


def test_detalhe_de_midia_inexistente_responde_404(client, catalogo):
    catalogo({})

    response = client.get('/api/midias/MID-404')

    assert (response.status_code, response.get_json()) == (404, NAO_ENCONTRADA)


def test_put_midia_atualiza_campos_validos(client, admin, catalogo):
    falso = catalogo()

    response = client.put('/api/midias/MID-1', headers=admin, json={
        'titulo_original': 'Novo titulo', 'numero_episodios': 24,
    })

    assert (response.status_code, response.get_json()) == (200, {'mensagem': 'Mídia atualizada com sucesso'})
    assert falso.chamadas == [('atualizar', 'MID-1', {'titulo_original': 'Novo titulo', 'numero_episodios': 24})]


@pytest.mark.parametrize('tipo', ['anime', 'manga', 'jogo'])
def test_put_midia_nao_grava_notas(client, admin, catalogo, tipo):
    """Nota média é calculada das Avaliações; Nota da fonte só a Importação grava."""
    falso = catalogo({'MID-1': {'tipo': tipo}})

    response = client.put('/api/midias/MID-1', headers=admin, json={
        'titulo_original': 'Novo titulo', 'nota_media': 9.9, 'nota_fonte': 1, 'total_avaliacoes': 3,
    })

    assert response.status_code == 200
    assert falso.chamadas == [('atualizar', 'MID-1', {'titulo_original': 'Novo titulo'})]


def test_put_midia_rejeita_payload_invalido(client, admin, catalogo):
    falso = catalogo()

    response = client.put('/api/midias/MID-1', headers=admin, json={'numero_episodios': 'vinte'})

    assert response.status_code == 400
    assert response.get_json() == {
        'erro': 'Dados inválidos', 'codigo': 'dados_invalidos', 'detalhes': {'numero_episodios': 'Tipo inválido'},
    }
    assert falso.chamadas == []


def test_put_midia_grava_so_os_campos_do_tipo_da_midia(client, admin, catalogo):
    """`demografia` é campo de mangá: num anime é ignorada; texto vazio grava nulo."""
    falso = catalogo({'MID-M': {'tipo': 'manga'}, 'MID-1': dict(LINHA_ANIME)})

    client.put('/api/midias/MID-M', headers=admin, json={'demografia': 'seinen', 'estudio': 'X'})
    client.put('/api/midias/MID-1', headers=admin, json={'demografia': 'seinen', 'estudio': ''})

    assert falso.chamadas == [
        ('atualizar', 'MID-M', {'demografia': 'seinen'}), ('atualizar', 'MID-1', {'estudio': None}),
    ]


def test_put_midia_recusa_valor_fora_dos_permitidos(client, admin, catalogo):
    falso = catalogo({'MID-M': {'tipo': 'manga'}})

    response = client.put('/api/midias/MID-M', headers=admin, json={'demografia': 'adulto'})

    assert (response.status_code, response.get_json()['detalhes']) == (400, {'demografia': 'Valor fora dos permitidos'})
    assert falso.chamadas == []


def test_put_midia_inexistente_responde_404(client, admin, catalogo):
    catalogo({})

    assert client.put('/api/midias/MID-404', headers=admin, json={'titulo_original': 'X'}).status_code == 404


def test_delete_midia(client, admin, catalogo):
    falso = catalogo()

    assert client.delete('/api/midias/MID-1', headers=admin).get_json() == {'mensagem': 'Mídia removida com sucesso'}
    response = client.delete('/api/midias/MID-1', headers=admin)

    assert (response.status_code, response.get_json()) == (404, NAO_ENCONTRADA)
    assert falso.midias == {}


def test_escrita_no_catalogo_exige_permissao(client, auth_headers, catalogo, monkeypatch):
    falso = catalogo()
    monkeypatch.setattr('decorators.get_user_permissions', lambda _user_id: {'nivel_acesso': 'usuario'})

    assert client.put('/api/midias/MID-1', headers=auth_headers, json={'titulo_original': 'X'}).status_code == 403
    assert client.delete('/api/midias/MID-1', headers=auth_headers).status_code == 403
    assert falso.chamadas == []


def test_post_atualizacao_publica_com_o_tipo_da_midia(client, admin, catalogo, atualizacoes):
    catalogo()
    falso = atualizacoes(notificados=2)

    response = client.post('/api/midias/MID-1/atualizacoes', headers=admin, json={
        'tipo': 'episodio', 'titulo': 'Episodio 12', 'descricao': 'Saiu hoje', 'dados_adicionais': {'episodio': 12},
    })

    assert response.status_code == 201
    assert response.get_json() == {'mensagem': 'Atualização adicionada!', 'notificacoes_enviadas': 2}
    assert falso.chamadas == [
        ('publicar', 'MID-1', 'anime', 'episodio', 'Episodio 12', 'Saiu hoje', {'episodio': 12}),
    ]


@pytest.mark.parametrize('midias, corpo, status, resposta', [
    ({}, {'tipo': 'episodio', 'titulo': 'X'}, 404, NAO_ENCONTRADA),
    (None, {'tipo': 'episodio'}, 400, {
        'erro': 'Dados inválidos', 'codigo': 'dados_invalidos', 'detalhes': {'titulo': 'Campo obrigatório'},
    }),
    (None, {'tipo': 'episodio', 'titulo': 'X', 'dados_adicionais': [1]}, 400, {
        'erro': 'Dados inválidos', 'codigo': 'dados_invalidos', 'detalhes': {'dados_adicionais': 'Tipo inválido'},
    }),
])
def test_post_atualizacao_invalida_nao_publica(client, admin, catalogo, atualizacoes, midias, corpo, status, resposta):
    catalogo(midias)
    falso = atualizacoes()

    response = client.post('/api/midias/MID-1/atualizacoes', headers=admin, json=corpo)

    assert (response.status_code, response.get_json()) == (status, resposta)
    assert falso.chamadas == []


def test_get_distribuicao(client, catalogo):
    distribuicao = [{'status_consumo': 'assistindo', 'total': 3}, {'status_consumo': 'completo', 'total': 1}]
    falso = catalogo(distribuicao=distribuicao)

    response = client.get('/api/midias/MID-1/distribuicao')

    assert (response.status_code, response.get_json()) == (200, {'distribuicao': distribuicao})
    assert falso.chamadas == [('distribuicao', 'MID-1')]


def test_trending_ordena_por_nota_e_limita_ao_teto(client, catalogo):
    falso = catalogo()

    response = client.get('/api/midias/trending?tipo=anime&limite=99')

    assert response.status_code == 200
    assert [m['id_midia'] for m in response.get_json()['midias']] == ['MID-1']
    assert falso.chamadas == [('buscar', 'anime', 1, 50, {'ordem': 'nota_media'})]


def test_trending_sem_tipo_e_anime(client, catalogo):
    falso = catalogo()

    client.get('/api/midias/trending')

    assert falso.chamadas == [('buscar', 'anime', 1, 10, {'ordem': 'nota_media'})]


POPULAR = {
    'id_midia': 'MID-POP', 'codigo_midia': None, 'tipo': 'anime', 'tipo_label': 'Anime', 'titulo_original': 'Pop',
    'titulo_portugues': None, 'poster_url': None, 'nota_media': 8.25, 'nota_fonte': None, 'origem_nota': None,
    'total_usuarios': 3, 'usuarios_concluiram': 1, 'total_favoritos': 1, 'generos': 'Ação',
}


def test_populares_repassa_o_tipo_ao_catalogo_e_sai_sem_campos_sem_leitor(client, catalogo):
    falso = catalogo(populares=[POPULAR, {**POPULAR, 'id_midia': 'MID-J', 'tipo': 'jogo'}])

    por_tipo = client.get('/api/midias/populares?tipo=anime')
    todas = client.get('/api/midias/populares')

    assert por_tipo.status_code == 200
    assert por_tipo.get_json() == {'midias': [{
        'id_midia': 'MID-POP', 'tipo': 'anime', 'titulo_original': 'Pop', 'titulo_portugues': None,
        'poster_url': None, 'nota_media': 8.25, 'nota_fonte': None, 'origem_nota': None, 'total_usuarios': 3,
        'generos': 'Ação',
    }]}
    assert len(todas.get_json()['midias']) == 2
    assert falso.chamadas == [('populares', 'anime'), ('populares', None)]
