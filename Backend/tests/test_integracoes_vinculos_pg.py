"""Vincular um Não encontrado a uma Mídia (Q115/Q116), com o PostgreSQL real e as fontes falsas.

`POST /integracoes/vinculos`: Tipo compatível, só o que apareceu como Não encontrado para o
Usuário, vale para todos e já aplica o Item; o casamento do AniList, MAL, XML e Steam consulta
os vínculos; `GET|DELETE /admin/vinculos` (desfazer não apaga Itens). Sem TEST_DATABASE_URL, pula.
"""
import io

import pytest

import banco
from integracoes import catalogo, repositorio
from integracoes.plataforma import Conta

from .fontes_falsas import jogo_steam
from .test_integracoes_anilist import _colecao, _entrada
from .test_integracoes_mal import XML, _entrada_mal, _media_anilist, _page, _pagina
from .test_integracoes_mal_pg import mal  # noqa: F401 (fixture)
from .test_integracoes_pg import _anime_no_catalogo, _media_nova, anilist, anilist_ids  # noqa: F401
from .test_integracoes_steam_pg import (  # noqa: F401 (fixtures)
    HORA,
    _conectar,
    _item_da_midia,
    _no_catalogo,
    _sincronizar,
    fontes,
    jogo,
    limpar,
    rawg_que_casa,
)
from .test_repositorios_pg import TEST_DATABASE_URL, _midia, _usuario, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para os vínculos'
)


@pytest.fixture
def pessoa(pg, make_token):  # noqa: F811
    """`pessoa(nivel)` cria um Usuário e devolve (id, headers)."""
    def nova(nivel='usuario'):
        id_usuario = _usuario(pg, nivel)
        return id_usuario, {'Authorization': f'Bearer {make_token(id_usuario)}'}

    return nova


def _vincular(client, headers, plataforma, origem_id, id_midia):
    return client.post('/api/integracoes/vinculos', headers=headers, json={
        'plataforma': plataforma, 'origem_id': str(origem_id), 'id_midia': str(id_midia),
    })


def _vinculo(plataforma, origem_id):
    return banco.consultar_um(
        'SELECT id, tipo, id_midia::text AS id_midia, id_usuario::text AS id_usuario FROM vinculos_origem '
        'WHERE plataforma = %s AND origem_id = %s',
        (plataforma, str(origem_id)),
    )


def _vincular_direto(plataforma, origem_id, tipo, id_midia):
    banco.executar(
        'INSERT INTO vinculos_origem (plataforma, origem_id, tipo, id_midia) VALUES (%s, %s, %s, %s)',
        (plataforma, str(origem_id), tipo, id_midia),
    )


def _steam_nao_encontrado(client, headers, fontes, jogo, id_usuario):  # noqa: F811
    """Um jogo que nem o RAWG nem a loja têm: fica em Não encontrados da Steam do Usuário."""
    appid, slug, nome = jogo('Perdido')
    rawg = fontes([jogo_steam(appid, nome, 150, HORA)], {r'/games$': {'results': []}})
    _conectar(id_usuario)
    corpo = _sincronizar(client, headers)
    assert corpo['total_nao_encontrados'] == 1
    return appid, slug, nome, rawg


# ============================================
# Steam
# ============================================

def test_nao_encontrado_sai_com_origem_id_e_tipo_para_vincular(client, pessoa, fontes, jogo):  # noqa: F811
    id_usuario, headers = pessoa()
    appid, _, nome, _ = _steam_nao_encontrado(client, headers, fontes, jogo, id_usuario)

    integracoes = client.get('/api/integracoes', headers=headers).get_json()['integracoes']
    steam = next(i for i in integracoes if i['plataforma'] == 'steam')

    assert steam['ultimo_resultado']['nao_encontrados'] == [{
        'titulo': nome, 'link': f'https://store.steampowered.com/app/{appid}', 'origem_id': str(appid), 'tipo': 'jogo',
    }]


def test_vincular_jogo_da_steam_aplica_o_item_e_vale_na_proxima_sincronizacao(
    client, pessoa, fontes, jogo,  # noqa: F811
):
    id_usuario, headers = pessoa()
    appid, slug, nome, rawg = _steam_nao_encontrado(client, headers, fontes, jogo, id_usuario)
    _, slug_destino, nome_destino = jogo('Destino')
    id_midia = _no_catalogo(appid + 1, slug_destino, nome_destino, casado=False)

    r = _vincular(client, headers, 'steam', appid, id_midia)

    assert r.status_code == 201, r.get_json()
    assert (r.get_json()['novos'], r.get_json()['atualizados']) == (1, 0)
    assert _item_da_midia(id_usuario, id_midia) == {'status_consumo': 'pausado', 'progresso_atual': 3}
    assert _vinculo('steam', appid) == {
        'id': _vinculo('steam', appid)['id'], 'tipo': 'jogo', 'id_midia': str(id_midia), 'id_usuario': str(id_usuario),
    }
    assert banco.consultar_um('SELECT id_midia::text AS id FROM steam_appids WHERE appid = %s', (appid,))['id'] == str(
        id_midia)
    ultimo = repositorio.conta(id_usuario, 'steam')['ultimo_resultado']
    assert (ultimo['nao_encontrados'], ultimo['total_nao_encontrados']) == ([], 0)

    chamadas = (len(rawg.chamadas), len(rawg.loja.chamadas))
    corpo = _sincronizar(client, headers)
    assert (corpo['novos'], corpo['total_nao_encontrados']) == (0, 0)
    assert (len(rawg.chamadas), len(rawg.loja.chamadas)) == chamadas


def test_outro_usuario_com_o_mesmo_jogo_casa_pelo_vinculo(client, pessoa, fontes, jogo):  # noqa: F811
    id_ana, headers_ana = pessoa()
    appid, _, nome, rawg = _steam_nao_encontrado(client, headers_ana, fontes, jogo, id_ana)
    _, slug_destino, nome_destino = jogo('Destino')
    id_midia = _no_catalogo(appid + 1, slug_destino, nome_destino, casado=False)
    assert _vincular(client, headers_ana, 'steam', appid, id_midia).status_code == 201
    id_bia, headers_bia = pessoa()
    _conectar(id_bia)
    chamadas = len(rawg.chamadas)

    corpo = _sincronizar(client, headers_bia)

    assert (corpo['novos'], corpo['total_nao_encontrados']) == (1, 0)
    assert _item_da_midia(id_bia, id_midia)['progresso_atual'] == 3
    assert len(rawg.chamadas) == chamadas


def test_steam_so_vincula_a_jogo(client, pessoa, fontes, jogo, anilist_ids):  # noqa: F811
    id_usuario, headers = pessoa()
    appid, *_ = _steam_nao_encontrado(client, headers, fontes, jogo, id_usuario)
    _, id_anime = _anime_no_catalogo(anilist_ids)

    r = _vincular(client, headers, 'steam', appid, id_anime)

    assert (r.status_code, r.get_json()['codigo']) == (400, 'dados_invalidos')
    assert 'id_midia' in r.get_json()['detalhes']
    assert _vinculo('steam', appid) is None


def test_so_vincula_o_que_apareceu_como_nao_encontrado_para_o_usuario(client, pessoa, fontes, jogo):  # noqa: F811
    id_ana, headers_ana = pessoa()
    appid, *_ = _steam_nao_encontrado(client, headers_ana, fontes, jogo, id_ana)
    _, slug_destino, nome_destino = jogo('Destino')
    id_midia = _no_catalogo(appid + 1, slug_destino, nome_destino, casado=False)
    _, headers_bia = pessoa()

    de_outro = _vincular(client, headers_bia, 'steam', appid, id_midia)
    inventado = _vincular(client, headers_ana, 'steam', appid + 7, id_midia)

    assert (de_outro.status_code, de_outro.get_json()['codigo']) == (404, 'nao_encontrado')
    assert (inventado.status_code, inventado.get_json()['codigo']) == (404, 'nao_encontrado')
    assert _vinculo('steam', appid) is None


@pytest.mark.parametrize('corpo', [
    {'plataforma': 'orkut', 'origem_id': '1', 'id_midia': '00000000-0000-0000-0000-000000000000'},
    {'plataforma': 'steam', 'origem_id': '', 'id_midia': '00000000-0000-0000-0000-000000000000'},
    {'plataforma': 'steam', 'origem_id': '1'},
])
def test_corpo_invalido_responde_400(client, pessoa, corpo):
    _, headers = pessoa()

    r = client.post('/api/integracoes/vinculos', headers=headers, json=corpo)

    assert (r.status_code, r.get_json()['codigo']) == (400, 'dados_invalidos')


def test_midia_inexistente_responde_404(client, pessoa, fontes, jogo):  # noqa: F811
    id_usuario, headers = pessoa()
    appid, *_ = _steam_nao_encontrado(client, headers, fontes, jogo, id_usuario)

    for id_midia in ('00000000-0000-0000-0000-000000000000', 'nao-e-uuid'):
        r = _vincular(client, headers, 'steam', appid, id_midia)
        assert (r.status_code, r.get_json()['codigo']) == (404, 'nao_encontrado')


def test_vincular_exige_login(client):
    r = client.post('/api/integracoes/vinculos', json={'plataforma': 'steam', 'origem_id': '1', 'id_midia': 'x'})

    assert r.status_code == 401


def test_ja_vinculado_a_outra_midia_responde_409(client, pessoa, fontes, jogo):  # noqa: F811
    id_ana, headers_ana = pessoa()
    appid, *_ = _steam_nao_encontrado(client, headers_ana, fontes, jogo, id_ana)
    id_bia, headers_bia = pessoa()
    _conectar(id_bia)
    _sincronizar(client, headers_bia)
    _, slug_a, nome_a = jogo('A')
    _, slug_b, nome_b = jogo('B')
    midia_a = _no_catalogo(appid + 1, slug_a, nome_a, casado=False)
    midia_b = _no_catalogo(appid + 2, slug_b, nome_b, casado=False)
    assert _vincular(client, headers_ana, 'steam', appid, midia_a).status_code == 201

    outra = _vincular(client, headers_bia, 'steam', appid, midia_b)
    mesma = _vincular(client, headers_bia, 'steam', appid, midia_a)

    assert (outra.status_code, outra.get_json()['codigo']) == (409, 'conflito')
    assert outra.get_json()['detalhes'] == {'id_midia': str(midia_a)}
    assert mesma.status_code == 201
    assert _item_da_midia(id_bia, midia_a)['progresso_atual'] == 3


def test_steam_casa_pelo_rawg_antes_do_vinculo(client, pessoa, fontes, jogo):  # noqa: F811
    id_usuario, headers = pessoa()
    appid, slug, nome = jogo('PeloRawg')
    _, slug_v, nome_v = jogo('PeloVinculo')
    pelo_vinculo = _no_catalogo(appid + 1, slug_v, nome_v, casado=False)
    _vincular_direto('steam', appid, 'jogo', pelo_vinculo)
    fontes([jogo_steam(appid, nome, 150, HORA)], rawg_que_casa((appid, slug, nome)))
    _conectar(id_usuario)

    corpo = _sincronizar(client, headers)

    pela_fonte = banco.consultar_um('SELECT id_midia::text AS id FROM jogos WHERE rawg_slug = %s', (slug,))['id']
    assert corpo['novos'] == 1
    assert _item_da_midia(id_usuario, pela_fonte)['progresso_atual'] == 3
    assert _item_da_midia(id_usuario, pelo_vinculo) is None


def test_steam_casada_em_steam_appids_ignora_o_vinculo(client, pessoa, fontes, jogo):  # noqa: F811
    id_usuario, headers = pessoa()
    appid, slug, nome = jogo('Casado')
    _, slug_v, nome_v = jogo('PeloVinculo')
    casada = _no_catalogo(appid, slug, nome)
    pelo_vinculo = _no_catalogo(appid + 1, slug_v, nome_v, casado=False)
    _vincular_direto('steam', appid, 'jogo', pelo_vinculo)
    fontes([jogo_steam(appid, nome, 150, HORA)], {})
    _conectar(id_usuario)

    _sincronizar(client, headers)

    assert _item_da_midia(id_usuario, casada)['progresso_atual'] == 3
    assert _item_da_midia(id_usuario, pelo_vinculo) is None


def test_steam_usa_o_vinculo_quando_a_fonte_nao_casa(client, pessoa, fontes, jogo):  # noqa: F811
    """Negativo em steam_appids (nem RAWG nem loja) e um vínculo: o vínculo é a reserva."""
    id_usuario, headers = pessoa()
    appid, *_ = _steam_nao_encontrado(client, headers, fontes, jogo, id_usuario)
    _, slug_v, nome_v = jogo('PeloVinculo')
    pelo_vinculo = _no_catalogo(appid + 1, slug_v, nome_v, casado=False)
    _vincular_direto('steam', appid, 'jogo', pelo_vinculo)

    corpo = _sincronizar(client, headers)

    assert (corpo['novos'], corpo['total_nao_encontrados']) == (1, 0)
    assert _item_da_midia(id_usuario, pelo_vinculo)['progresso_atual'] == 3


def test_jogo_que_casou_depois_do_nao_encontrado_responde_409_sem_sobrescrever(client, pessoa, fontes, jogo):  # noqa: F811
    """Entre o Não encontrado e o Vincular a sincronização de alguém casou a appid: o casamento fica."""
    id_usuario, headers = pessoa()
    appid, *_ = _steam_nao_encontrado(client, headers, fontes, jogo, id_usuario)
    _, slug_c, nome_c = jogo('CasouDepois')
    _, slug_d, nome_d = jogo('Destino')
    casada = _no_catalogo(appid + 1, slug_c, nome_c, casado=False)
    destino = _no_catalogo(appid + 2, slug_d, nome_d, casado=False)
    banco.executar('UPDATE steam_appids SET id_midia = %s WHERE appid = %s', (casada, appid))

    r = _vincular(client, headers, 'steam', appid, destino)

    assert (r.status_code, r.get_json()['codigo']) == (409, 'conflito')
    assert r.get_json()['detalhes'] == {'id_midia': str(casada)}
    assert 'já está no Catálogo' in r.get_json()['erro']
    assert _vinculo('steam', appid) is None
    assert banco.consultar_um('SELECT id_midia::text AS id FROM steam_appids WHERE appid = %s', (appid,))['id'] == str(
        casada)
    assert _item_da_midia(id_usuario, destino) is None
    assert repositorio.conta(id_usuario, 'steam')['ultimo_resultado']['total_nao_encontrados'] == 1


def test_vincular_jogo_ignorado_preenche_e_tira_o_ignorado(client, pessoa, fontes, jogo):  # noqa: F811
    id_usuario, headers = pessoa()
    appid, *_ = _steam_nao_encontrado(client, headers, fontes, jogo, id_usuario)
    _, slug_d, nome_d = jogo('Destino')
    destino = _no_catalogo(appid + 1, slug_d, nome_d, casado=False)
    banco.executar('UPDATE steam_appids SET ignorado = true WHERE appid = %s', (appid,))

    assert _vincular(client, headers, 'steam', appid, destino).status_code == 201

    assert banco.consultar_um(
        'SELECT id_midia::text AS id, ignorado FROM steam_appids WHERE appid = %s', (appid,),
    ) == {'id': str(destino), 'ignorado': False}


# ============================================
# MAL (API e XML) e AniList
# ============================================

def _previa_mal_com_nao_encontrado(client, headers, mal, id_mal=9):  # noqa: F811
    mal([_pagina()])
    assert client.put('/api/integracoes/mal', json={'identificador': 'Fulano'}, headers=headers).status_code == 200
    mal([_pagina(_entrada_mal(id_mal, 'Sem par', num_episodes_watched=4)), _pagina()], [_page()])
    corpo = client.post('/api/integracoes/mal/previa', headers=headers).get_json()
    assert corpo['nao_encontrados'] == [{
        'titulo': 'Sem par', 'link': f'https://myanimelist.net/anime/{id_mal}', 'origem_id': str(id_mal),
        'tipo': 'anime',
    }]
    return corpo


def test_mal_vincula_da_previa_so_ao_mesmo_tipo_e_o_confirmar_nao_repete(
    client, pessoa, mal, anilist_ids, pg,  # noqa: F811
):
    id_usuario, headers = pessoa()
    previa = _previa_mal_com_nao_encontrado(client, headers, mal, 900001)
    _, id_anime = _anime_no_catalogo(anilist_ids, episodios=12)
    id_manga = _midia(pg, 'manga')

    manga = _vincular(client, headers, 'mal', 900001, id_manga)
    anime = _vincular(client, headers, 'mal', 900001, id_anime)

    assert (manga.status_code, manga.get_json()['codigo']) == (400, 'dados_invalidos')
    assert anime.status_code == 201, anime.get_json()
    assert _item_da_midia(id_usuario, id_anime) == {'status_consumo': 'assistindo', 'progresso_atual': 4}
    assert _vinculo('mal', 900001)['tipo'] == 'anime'
    confirmado = client.post(f"/api/integracoes/previas/{previa['id_previa']}/confirmar", headers=headers).get_json()
    assert (confirmado['nao_encontrados'], confirmado['total_nao_encontrados']) == ([], 0)


def test_mal_de_outro_usuario_casa_pelo_vinculo_e_o_manga_de_mesmo_id_nao(
    client, pessoa, mal, anilist_ids,  # noqa: F811
):
    _, headers_ana = pessoa()
    _previa_mal_com_nao_encontrado(client, headers_ana, mal, 900002)
    _, id_anime = _anime_no_catalogo(anilist_ids, episodios=12)
    assert _vincular(client, headers_ana, 'mal', 900002, id_anime).status_code == 201
    id_bia, headers_bia = pessoa()
    mal([_pagina()])
    client.put('/api/integracoes/mal', json={'identificador': 'Beltrano'}, headers=headers_bia)
    mal(
        [_pagina(_entrada_mal(900002, 'Sem par', num_episodes_watched=2)),
         _pagina({'node': {'id': 900002, 'title': 'Mangá homônimo'}, 'list_status': {'status': 'reading'}})],
        [_page(), _page()],
    )

    previa = client.post('/api/integracoes/mal/previa', headers=headers_bia).get_json()

    assert (previa['novos'], previa['total_nao_encontrados']) == (1, 1), previa
    assert previa['nao_encontrados'][0]['tipo'] == 'manga'
    client.post(f"/api/integracoes/previas/{previa['id_previa']}/confirmar", headers=headers_bia)
    assert _item_da_midia(id_bia, id_anime)['progresso_atual'] == 2


def test_xml_do_mal_casa_pelo_vinculo(client, pessoa, mal, anilist_ids, monkeypatch):  # noqa: F811
    id_usuario, headers = pessoa()
    _, id_anime = _anime_no_catalogo(anilist_ids, episodios=30)
    banco.executar(
        "INSERT INTO vinculos_origem (plataforma, origem_id, tipo, id_midia) VALUES ('mal', '2', 'anime', %s)",
        (id_anime,),
    )
    mal(respostas_anilist=[_page(), _page()])
    monkeypatch.delenv('MAL_CLIENT_ID')

    r = client.post('/api/integracoes/mal/xml', headers=headers, content_type='multipart/form-data',
                    data={'arquivo': (io.BytesIO(XML), 'lista.xml')})

    corpo = r.get_json()
    assert r.status_code == 200, corpo
    assert 'https://myanimelist.net/anime/2' not in {n['link'] for n in corpo['nao_encontrados']}
    client.post(f"/api/integracoes/previas/{corpo['id_previa']}/confirmar", headers=headers)
    assert _item_da_midia(id_usuario, id_anime) is not None


def test_anilist_casa_pela_fonte_e_o_vinculo_fica_de_reserva(client, pessoa, anilist, anilist_ids):  # noqa: F811
    """A fonte casa primeiro: o AniList traz a obra (importável), então o vínculo não é usado."""
    id_usuario, headers = pessoa()
    _, id_anime = _anime_no_catalogo(anilist_ids, episodios=12)
    media = _media_nova(anilist_ids, 'Com import')
    _vincular_direto('anilist', media['id'], 'anime', id_anime)
    repositorio.gravar_conta(id_usuario, 'anilist', Conta('fulano', 'fulano'))
    anilist(_colecao((False, [_entrada(media, progress=5)])), _colecao())

    previa = client.post('/api/integracoes/anilist/previa', headers=headers).get_json()
    client.post(f"/api/integracoes/previas/{previa['id_previa']}/confirmar", headers=headers)

    importada = banco.consultar_um('SELECT id_midia FROM animes WHERE anilist_id = %s', (media['id'],))
    assert _item_da_midia(id_usuario, importada['id_midia'])['progresso_atual'] == 5
    assert _item_da_midia(id_usuario, id_anime) is None


def test_anilist_que_falha_ao_importar_cai_no_vinculo(client, pessoa, anilist, anilist_ids, monkeypatch):  # noqa: F811
    id_usuario, headers = pessoa()
    _, id_anime = _anime_no_catalogo(anilist_ids, episodios=12)
    media = _media_nova(anilist_ids, 'Import quebra')
    _vincular_direto('anilist', media['id'], 'anime', id_anime)
    repositorio.gravar_conta(id_usuario, 'anilist', Conta('fulano', 'fulano'))
    anilist(_colecao((False, [_entrada(media, progress=5)])), _colecao())
    previa = client.post('/api/integracoes/anilist/previa', headers=headers).get_json()

    def quebrar(_dados):
        raise RuntimeError('fonte com dado ruim')

    monkeypatch.setitem(catalogo.IMPORTADORES, ('anilist', 'anime'), quebrar)
    corpo = client.post(f"/api/integracoes/previas/{previa['id_previa']}/confirmar", headers=headers).get_json()

    assert (corpo['novos'], corpo['total_nao_encontrados']) == (1, 0), corpo
    assert _item_da_midia(id_usuario, id_anime)['progresso_atual'] == 5


def test_mal_casa_pelo_idmal_do_anilist_antes_do_vinculo(client, pessoa, mal, anilist_ids):  # noqa: F811
    id_usuario, headers = pessoa()
    id_anilist, pela_fonte = _anime_no_catalogo(anilist_ids, episodios=12)
    _, pelo_vinculo = _anime_no_catalogo(anilist_ids, episodios=12)
    _vincular_direto('mal', 900010, 'anime', pelo_vinculo)
    mal([_pagina()])
    client.put('/api/integracoes/mal', json={'identificador': 'Fulano'}, headers=headers)
    mal([_pagina(_entrada_mal(900010, 'Com par', num_episodes_watched=4)), _pagina()],
        [_page(_media_anilist(900010, id_anilist))])

    previa = client.post('/api/integracoes/mal/previa', headers=headers).get_json()
    client.post(f"/api/integracoes/previas/{previa['id_previa']}/confirmar", headers=headers)

    assert _item_da_midia(id_usuario, pela_fonte)['progresso_atual'] == 4
    assert _item_da_midia(id_usuario, pelo_vinculo) is None


# ============================================
# Admin
# ============================================

def test_admin_lista_os_vinculos_e_desfazer_volta_a_nao_encontrado_sem_apagar_o_item(
    client, pessoa, fontes, jogo,  # noqa: F811
):
    id_usuario, headers = pessoa()
    appid, _, nome, _ = _steam_nao_encontrado(client, headers, fontes, jogo, id_usuario)
    _, slug_destino, nome_destino = jogo('Destino')
    id_midia = _no_catalogo(appid + 1, slug_destino, nome_destino, casado=False)
    id_vinculo = _vincular(client, headers, 'steam', appid, id_midia).get_json()['id_vinculo']
    _, headers_admin = pessoa('admin')

    pagina = client.get('/api/admin/vinculos', headers=headers_admin)
    proibido = client.get('/api/admin/vinculos', headers=headers)

    assert pagina.status_code == 200, pagina.get_json()
    vinculo = next(v for v in pagina.get_json()['itens'] if v['id_vinculo'] == id_vinculo)
    assert vinculo['plataforma'] == 'steam' and vinculo['origem_id'] == str(appid) and vinculo['tipo'] == 'jogo'
    assert vinculo['id_midia'] == str(id_midia) and vinculo['titulo_original'] == nome_destino
    assert vinculo['id_usuario'] == str(id_usuario) and vinculo['nome_completo'] == 'PG'
    assert vinculo['link'] == f'https://store.steampowered.com/app/{appid}'
    assert proibido.status_code == 403

    assert client.delete(f'/api/admin/vinculos/{id_vinculo}', headers=headers).status_code == 403
    desfeito = client.delete(f'/api/admin/vinculos/{id_vinculo}', headers=headers_admin)
    de_novo = client.delete(f'/api/admin/vinculos/{id_vinculo}', headers=headers_admin)

    assert desfeito.status_code == 200
    assert (de_novo.status_code, de_novo.get_json()['codigo']) == (404, 'nao_encontrado')
    assert _vinculo('steam', appid) is None
    assert _item_da_midia(id_usuario, id_midia)['progresso_atual'] == 3
    corpo = _sincronizar(client, headers)
    assert corpo['total_nao_encontrados'] == 1
    assert corpo['nao_encontrados'][0]['origem_id'] == str(appid)


def test_admin_desfaz_vinculo_do_mal_e_o_item_fica(client, pessoa, mal, anilist_ids):  # noqa: F811
    id_usuario, headers = pessoa()
    _previa_mal_com_nao_encontrado(client, headers, mal, 900003)
    _, id_anime = _anime_no_catalogo(anilist_ids, episodios=12)
    id_vinculo = _vincular(client, headers, 'mal', 900003, id_anime).get_json()['id_vinculo']
    _, headers_admin = pessoa('admin')

    assert client.delete(f'/api/admin/vinculos/{id_vinculo}', headers=headers_admin).status_code == 200

    assert _vinculo('mal', 900003) is None
    assert _item_da_midia(id_usuario, id_anime) is not None
    assert client.delete('/api/admin/vinculos/nao-e-uuid', headers=headers_admin).status_code == 404

