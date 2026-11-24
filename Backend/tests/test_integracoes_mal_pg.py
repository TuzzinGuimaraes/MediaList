"""MyAnimeList pelas rotas, com o PostgreSQL real e o MAL/AniList falsos (nada de rede).

Conectar pela API, prévia casada pelo `idMal` (sob demanda e Não encontrados) e o XML
enviado por `POST /integracoes/mal/xml`, que funciona sem a chave do MAL.
"""
import gzip
import io

import pytest

import banco
from integracoes import servico
from integracoes.mal import LIMITE_XML, MAL

from .test_integracoes_anilist import SessaoFalsa as SessaoAniList
from .test_integracoes_anilist import _Resposta
from .test_integracoes_mal import CHAVE, XML, SessaoMal, _entrada_mal, _media_anilist, _page, _pagina
from .test_integracoes_pg import _anime_no_catalogo, _id_anilist, _item, anilist_ids, usuario  # noqa: F401
from .test_repositorios_pg import TEST_DATABASE_URL, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as Integrações'
)


@pytest.fixture
def mal(monkeypatch):
    """`mal(respostas_mal, respostas_anilist)` instala o MAL registrado com sessões falsas."""
    monkeypatch.setenv('MAL_CLIENT_ID', CHAVE)

    def instalar(respostas_mal=(), respostas_anilist=()):
        plataforma = MAL(sessao=SessaoMal(*respostas_mal), sessao_anilist=SessaoAniList(*respostas_anilist))
        monkeypatch.setitem(servico.PLATAFORMAS, 'mal', plataforma)
        return plataforma

    return instalar


def _da(integracoes, nome):
    return next(i for i in integracoes if i['plataforma'] == nome)


def _enviar(client, headers, conteudo, nome='animelist.xml'):
    return client.post(
        '/api/integracoes/mal/xml', headers=headers, content_type='multipart/form-data',
        data={'arquivo': (io.BytesIO(conteudo), nome)},
    )


def _nova(anilist_ids, id_mal, episodios=26):  # noqa: F811
    id_anilist = _id_anilist()
    anilist_ids.append(id_anilist)
    return {**_media_anilist(id_mal, id_anilist), 'episodes': episodios, 'status': 'FINISHED', 'genres': []}


def test_mal_aparece_e_fica_indisponivel_sem_a_chave(client, usuario, monkeypatch):  # noqa: F811
    _, headers = usuario
    monkeypatch.delenv('MAL_CLIENT_ID', raising=False)

    integracoes = client.get('/api/integracoes', headers=headers).get_json()['integracoes']
    r = client.put('/api/integracoes/mal', json={'identificador': 'fulano'}, headers=headers)

    assert (_da(integracoes, 'mal')['rotulo'], _da(integracoes, 'mal')['disponivel']) == ('MyAnimeList', False)
    assert (r.status_code, r.get_json()['codigo']) == (503, 'plataforma_indisponivel')


def test_conecta_e_importa_pela_api_casando_pelo_idmal(client, usuario, mal, anilist_ids):  # noqa: F811
    id_usuario, headers = usuario
    id_existente, midia_existente = _anime_no_catalogo(anilist_ids)
    nova = _nova(anilist_ids, 7)
    mal([_pagina()])
    conectada = client.put('/api/integracoes/mal', json={'identificador': 'Fulano'}, headers=headers)
    assert conectada.status_code == 200, conectada.get_json()
    mal(
        [_pagina(_entrada_mal(5, num_episodes_watched=3), _entrada_mal(7, status='completed', num_episodes_watched=26),
                 _entrada_mal(9, 'Sem par no AniList')),
         _pagina()],
        [_page(_media_anilist(5, id_existente), nova)],
    )

    corpo = client.post('/api/integracoes/mal/previa', headers=headers).get_json()

    assert (corpo['novos'], corpo['atualizados'], corpo['total_nao_encontrados']) == (2, 0, 1), corpo
    assert corpo['nao_encontrados'] == [{'titulo': 'Sem par no AniList', 'link': 'https://myanimelist.net/anime/9'}]
    confirmado = client.post(f"/api/integracoes/previas/{corpo['id_previa']}/confirmar", headers=headers)
    assert confirmado.status_code == 200, confirmado.get_json()
    assert _item(id_usuario, midia_existente)['progresso_atual'] == 3
    importada = banco.consultar_um('SELECT id_midia FROM animes WHERE anilist_id = %s', (nova['id'],))
    assert _item(id_usuario, importada['id_midia'])['status_consumo'] == 'completo'
    assert _da(client.get('/api/integracoes', headers=headers).get_json()['integracoes'], 'mal')['ultimo_resultado']


def test_lista_privada_no_mal(client, usuario, mal):  # noqa: F811
    _, headers = usuario
    mal([_Resposta(403, {'error': 'forbidden'})])

    r = client.put('/api/integracoes/mal', json={'identificador': 'fulano'}, headers=headers)

    assert (r.status_code, r.get_json()['codigo']) == (400, 'perfil_privado')
    assert CHAVE not in r.get_data(as_text=True)


def test_xml_gera_previa_sem_chave_e_sem_conectar(client, usuario, mal, monkeypatch, anilist_ids):  # noqa: F811
    id_usuario, headers = usuario
    nova = _nova(anilist_ids, 1)
    mal(respostas_anilist=[_page(nova), _page()])
    monkeypatch.delenv('MAL_CLIENT_ID')

    r = _enviar(client, headers, gzip.compress(XML), 'animelist.xml.gz')

    corpo = r.get_json()
    assert r.status_code == 200, corpo
    assert (corpo['novos'], corpo['total_nao_encontrados']) == (1, 2)
    assert {n['link'] for n in corpo['nao_encontrados']} == {
        'https://myanimelist.net/anime/2', 'https://myanimelist.net/manga/3',
    }
    confirmado = client.post(f"/api/integracoes/previas/{corpo['id_previa']}/confirmar", headers=headers).get_json()
    assert (confirmado['novos'], confirmado['total_nao_encontrados']) == (1, 2)
    importada = banco.consultar_um('SELECT id_midia FROM animes WHERE anilist_id = %s', (nova['id'],))
    item = _item(id_usuario, importada['id_midia'])
    assert (item['status_consumo'], item['progresso_atual'], float(item['nota_usuario'])) == ('completo', 26, 9.0)


@pytest.mark.parametrize(('conteudo', 'nome'), [
    (b'<html>nao</html>', 'lista.xml'),
    (b'<?xml version="1.0"?><!DOCTYPE m [<!ENTITY e SYSTEM "file:///etc/passwd">]><myanimelist>&e;</myanimelist>',
     'lista.xml'),
])
def test_xml_invalido_responde_400(client, usuario, mal, conteudo, nome):  # noqa: F811
    _, headers = usuario
    mal()

    r = _enviar(client, headers, conteudo, nome)

    assert (r.status_code, r.get_json()['codigo']) == (400, 'dados_invalidos')
    assert 'XML' in r.get_json()['erro']


def test_xml_sem_arquivo_responde_400(client, usuario, mal):  # noqa: F811
    _, headers = usuario
    mal()

    r = client.post('/api/integracoes/mal/xml', headers=headers, content_type='multipart/form-data', data={})

    assert (r.status_code, r.get_json()['codigo']) == (400, 'dados_invalidos')


def test_xml_grande_demais_responde_413(client, usuario, mal):  # noqa: F811
    _, headers = usuario
    mal()

    for tamanho in (LIMITE_XML + 1, LIMITE_XML + 200 * 1024):  # o segundo para já no Werkzeug
        r = _enviar(client, headers, b' ' * tamanho)

        assert (r.status_code, r.get_json()['codigo']) == (413, 'dados_invalidos')
        assert '5 MB' in r.get_json()['erro']


def test_xml_exige_login(client):
    assert _enviar(client, {}, XML).status_code == 401
