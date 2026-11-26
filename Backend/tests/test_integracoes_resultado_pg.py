"""Resultado da integração com o PostgreSQL real (Q132): todos os Não encontrados ficam guardados,
então o 101º em diante também é vinculável, depois de a prévia acabar e na Steam. A resposta
continua com a amostra de 100 e o total. Sem TEST_DATABASE_URL, pula."""
import pytest

from integracoes import servico
from integracoes.plataforma import ItemDeOrigem

from .fontes_falsas import jogo_steam
from .test_integracoes_pg import _anime_no_catalogo, _PlataformaFalsa, anilist_ids  # noqa: F401 (fixture)
from .test_integracoes_steam_pg import (  # noqa: F401 (fixtures)
    HORA,
    _conectar,
    _item_da_midia,
    _no_catalogo,
    _sincronizar,
    fontes,
    jogo,
    limpar,
)
from .test_integracoes_vinculos_pg import _vincular, pessoa  # noqa: F401 (fixture)
from .test_repositorios_pg import TEST_DATABASE_URL, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o Resultado da integração'
)


def _ultimo_resultado(client, headers, plataforma):
    integracoes = client.get('/api/integracoes', headers=headers).get_json()['integracoes']
    return next(i for i in integracoes if i['plataforma'] == plataforma)['ultimo_resultado']


def test_anilist_101o_nao_encontrado_e_vinculavel_depois_da_previa(
    client, pessoa, monkeypatch, anilist_ids,  # noqa: F811
):
    id_usuario, headers = pessoa()
    itens = [ItemDeOrigem(str(n), 'anime', f'Rara {n}', f'https://anilist.co/anime/{n}', status='concluido')
             for n in range(1, 102)]
    monkeypatch.setitem(servico.PLATAFORMAS, 'anilist', _PlataformaFalsa(itens))
    client.put('/api/integracoes/anilist', json={'identificador': 'fulano'}, headers=headers)
    previa = client.post('/api/integracoes/anilist/previa', headers=headers).get_json()
    confirmado = client.post(f"/api/integracoes/previas/{previa['id_previa']}/confirmar", headers=headers).get_json()
    assert (len(confirmado['nao_encontrados']), confirmado['total_nao_encontrados']) == (100, 101)
    _, id_anime = _anime_no_catalogo(anilist_ids, episodios=12)

    r = _vincular(client, headers, 'anilist', '101', id_anime)

    assert r.status_code == 201, r.get_json()
    assert _item_da_midia(id_usuario, id_anime) is not None
    ultimo = _ultimo_resultado(client, headers, 'anilist')
    assert ultimo['total_nao_encontrados'] == 100
    assert len(ultimo['nao_encontrados']) == 100
    assert '101' not in {n['origem_id'] for n in ultimo['nao_encontrados']}


def test_steam_101o_nao_encontrado_e_vinculavel(client, pessoa, fontes, jogo):  # noqa: F811
    id_usuario, headers = pessoa()
    jogos = [jogo('Perdido') for _ in range(101)]
    fontes([jogo_steam(appid, nome, 150, HORA) for appid, _, nome in jogos], {r'/games$': {'results': []}})
    _conectar(id_usuario)
    corpo = _sincronizar(client, headers)
    assert (len(corpo['nao_encontrados']), corpo['total_nao_encontrados']) == (100, 101)
    fora_da_amostra = ({str(appid) for appid, *_ in jogos} - {n['origem_id'] for n in corpo['nao_encontrados']}).pop()
    _, slug, nome = jogo('Destino')
    destino = _no_catalogo(int(fora_da_amostra) + 1, slug, nome, casado=False)

    r = _vincular(client, headers, 'steam', fora_da_amostra, destino)

    assert r.status_code == 201, r.get_json()
    assert _item_da_midia(id_usuario, destino)['progresso_atual'] == 3
    ultimo = _ultimo_resultado(client, headers, 'steam')
    assert (len(ultimo['nao_encontrados']), ultimo['total_nao_encontrados']) == (100, 100)
