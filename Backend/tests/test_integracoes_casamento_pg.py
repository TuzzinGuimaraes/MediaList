"""Casamento (ADR-0015, Q133): a fonte casa primeiro; o vínculo só vale para o que ela não casa.

Pela interface do module com fontes falsas (funções que dizem o que cada item casou) e o
Catálogo/vínculos no PostgreSQL de teste; a cadeia da Steam pela sincronização, com Steam, RAWG e
loja falsos. Sem TEST_DATABASE_URL, pula.
"""
from dataclasses import replace

import pytest

import banco
from integracoes import casamento, catalogo, sincronizacao_steam
from integracoes.plataforma import ItemDeOrigem, RefCatalogo

from .fontes_falsas import appdetails, jogo_steam
from .test_integracoes_steam_pg import (  # noqa: F401 (fixtures)
    HORA,
    _conectar,
    _item_da_midia,
    _no_catalogo,
    fontes,
    jogo,
    limpar,
    loja_com,
    rawg_que_casa,
    usuario,
)
from .test_repositorios_pg import TEST_DATABASE_URL, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o Casamento'
)


def _item(appid, nome, catalogo_=None):
    return ItemDeOrigem(str(appid), 'jogo', nome, None, horas=3, catalogo=catalogo_)


def _vincular_direto(appid, id_midia):
    banco.executar(
        "INSERT INTO vinculos_origem (plataforma, origem_id, tipo, id_midia) VALUES ('steam', %s, 'jogo', %s)",
        (str(appid), id_midia),
    )


def _localizada(id_midia):
    return {'id_midia': id_midia, 'tipo': 'jogo', 'total': None}


def _fonte(desfechos):
    """Fonte falsa: o desfecho de cada item, pelo `origem_id`; guarda os itens que recebeu."""
    def fonte(itens):
        fonte.recebidos = list(itens)
        return [desfechos[i.origem_id](i) if callable(desfechos[i.origem_id]) else desfechos[i.origem_id]
                for i in itens]

    return fonte


def _midias(casados):
    return [(item.origem_id, str(midia['id_midia']) if midia else None) for item, midia in casados]


def test_a_fonte_vence_o_vinculo(jogo):  # noqa: F811
    appid, slug, nome = jogo('PelaFonte')
    _, slug_v, nome_v = jogo('PeloVinculo')
    pela_fonte = _no_catalogo(appid, slug, nome, casado=False)
    _vincular_direto(appid, _no_catalogo(appid + 1, slug_v, nome_v, casado=False))
    item = _item(appid, nome)

    casados = casamento.casar('steam', [item], _fonte({str(appid): lambda i: (i, _localizada(pela_fonte))}))

    assert _midias(casados.pela_fonte) == [(str(appid), str(pela_fonte))]
    assert (casados.pelo_vinculo, casados.nao_encontrados, casados.pendentes) == ((), (), 0)


def test_o_vinculo_so_casa_o_que_a_fonte_nao_casa_e_relocaliza_no_catalogo(jogo):  # noqa: F811
    casa, _, nome_casa = jogo('Casa')
    vinculado, _, nome_vinculado = jogo('Vinculado')
    perdido, _, nome_perdido = jogo('Perdido')
    _, slug_v, nome_v = jogo('Destino')
    destino = _no_catalogo(vinculado + 1, slug_v, nome_v, casado=False)
    _vincular_direto(vinculado, destino)
    _vincular_direto(casa, destino)
    itens = [_item(vinculado, nome_vinculado), _item(casa, nome_casa), _item(perdido, nome_perdido)]
    fonte = _fonte({str(casa): lambda i: (i, _localizada(destino)), str(vinculado): casamento.NAO_CASA,
                    str(perdido): casamento.NAO_CASA})

    casados = casamento.casar('steam', itens, fonte)

    assert fonte.recebidos == itens
    assert _midias(casados.pelo_vinculo) == [(str(vinculado), str(destino))]
    item, midia = casados.pelo_vinculo[0]
    assert (item.catalogo.fonte, midia['tipo'], midia['total']) == ('midia', 'jogo', None)
    assert [i.origem_id for i in casados.nao_encontrados] == [str(perdido)]
    assert _midias(casados.em_ordem) == [(str(vinculado), str(destino)), (str(casa), str(destino))]


def test_obra_a_importar_e_da_fonte_e_nao_consulta_o_vinculo(jogo):  # noqa: F811
    appid, slug, nome = jogo('AImportar')
    _, slug_v, nome_v = jogo('PeloVinculo')
    _vincular_direto(appid, _no_catalogo(appid + 1, slug_v, nome_v, casado=False))
    item = _item(appid, nome, RefCatalogo('rawg', slug, {'slug': slug}))

    casados = casamento.casar('steam', [item], _fonte({str(appid): lambda i: (i, None)}))

    assert casados.pela_fonte == ((item, None),)
    assert casados.pelo_vinculo == ()


def test_pendente_e_ignorado_nao_vao_para_a_reserva(jogo):  # noqa: F811
    pendente, _, nome_p = jogo('Pendente')
    ignorado, _, nome_i = jogo('Ignorado')
    _, slug_v, nome_v = jogo('Destino')
    destino = _no_catalogo(pendente + 1, slug_v, nome_v, casado=False)
    _vincular_direto(pendente, destino)
    _vincular_direto(ignorado, destino)

    casados = casamento.casar('steam', [_item(pendente, nome_p), _item(ignorado, nome_i)],
                              _fonte({str(pendente): casamento.PENDENTE, str(ignorado): casamento.IGNORADO}))

    assert (casados.pela_fonte, casados.pelo_vinculo, casados.nao_encontrados) == ((), (), ())
    assert casados.pendentes == 1


def test_na_midia_relocaliza_e_a_midia_que_sumiu_e_nao_encontrado(jogo):  # noqa: F811
    appid, slug, nome = jogo('NaMidia')
    id_midia = _no_catalogo(appid, slug, nome, casado=False)
    existe = _item(appid, nome, RefCatalogo('midia', str(id_midia)))
    sumiu = _item(appid + 1, 'Sumiu', RefCatalogo('midia', '00000000-0000-0000-0000-000000000000'))

    casados = casamento.na_midia([existe, sumiu])

    assert _midias(casados.pela_fonte) == [(str(appid), str(id_midia))]
    assert casados.nao_encontrados == (sumiu,)


def test_pelo_catalogo_localiza_aceita_a_obra_a_importar_e_deixa_o_resto_para_o_vinculo(jogo):  # noqa: F811
    no_catalogo, slug, nome = jogo('NoCatalogo')
    a_importar, slug_i, nome_i = jogo('AImportar')
    sem_ref, _, nome_s = jogo('SemRef')
    _, slug_v, nome_v = jogo('Destino')
    id_midia = _no_catalogo(no_catalogo, slug, nome, casado=False)
    destino = _no_catalogo(sem_ref + 1, slug_v, nome_v, casado=False)
    _vincular_direto(sem_ref, destino)
    _vincular_direto(no_catalogo, destino)
    itens = [_item(no_catalogo, nome, RefCatalogo('rawg', slug)),
             _item(a_importar, nome_i, RefCatalogo('rawg', slug_i, {'slug': slug_i})),
             _item(sem_ref, nome_s)]

    casados = casamento.casar('steam', itens, casamento.pelo_catalogo)

    assert _midias(casados.pela_fonte) == [(str(no_catalogo), str(id_midia)), (str(a_importar), None)]
    assert _midias(casados.pelo_vinculo) == [(str(sem_ref), str(destino))]
    assert banco.consultar_um('SELECT 1 AS x FROM jogos WHERE rawg_slug = %s', (slug_i,)) is None


def test_importando_grava_a_obra_e_a_importacao_que_falha_cai_no_vinculo(jogo):  # noqa: F811
    falha, slug_f, nome_f = jogo('Falha')
    _, slug_v, nome_v = jogo('Destino')
    destino = _no_catalogo(falha + 1, slug_v, nome_v, casado=False)
    _vincular_direto(falha, destino)
    loja, _, nome_l = jogo('PelaLoja')
    dados_loja = {**appdetails(loja, nome_l)[str(loja)]['data'], 'capa_vertical': None}
    itens = [_item(falha, nome_f, RefCatalogo('rawg', slug_f, {'quebrado': True})),
             _item(loja, nome_l, RefCatalogo('steam', str(loja), dados_loja))]
    conferidos = []

    casados = casamento.casar('steam', itens, casamento.importando(lambda: conferidos.append(1)))

    importada = catalogo.localizar([replace(itens[1], catalogo=RefCatalogo('steam', str(loja)))])
    assert _midias(casados.pela_fonte) == [(str(loja), str(importada[('jogo', 'steam', str(loja))]['id_midia']))]
    assert _midias(casados.pelo_vinculo) == [(str(falha), str(destino))]
    assert len(conferidos) == 2


# ============================================
# A fonte da Steam
# ============================================

def test_steam_casa_na_ordem_de_hoje_e_o_vinculo_por_ultimo(client, usuario, fontes, jogo):  # noqa: F811
    """steam_appids, appid no Catálogo, RAWG, loja; o vínculo só no que nenhum deles casa."""
    id_usuario, headers = usuario
    gravado, slug_g, nome_g = jogo('Gravado')
    pela_appid, _, nome_a = jogo('PelaAppid')
    pelo_rawg, slug_r, nome_r = jogo('PeloRawg')
    pela_loja, _, nome_l = jogo('PelaLoja')
    vinculado, _, nome_v = jogo('Vinculado')
    perdido, _, nome_p = jogo('Perdido')
    _, slug_d, nome_d = jogo('Destino')
    destino = _no_catalogo(perdido + 1, slug_d, nome_d, casado=False)
    midia_gravada = _no_catalogo(gravado, slug_g, nome_g)
    midia_appid = catalogo.importar(_item(pela_appid, nome_a, RefCatalogo(
        'steam', str(pela_appid), {**appdetails(pela_appid, nome_a)[str(pela_appid)]['data'], 'capa_vertical': None},
    )))['id_midia']
    for appid in (gravado, pela_appid, pelo_rawg, pela_loja, vinculado):
        _vincular_direto(appid, destino)
    fontes([jogo_steam(a, n, 180, HORA) for a, n in [(gravado, nome_g), (pela_appid, nome_a), (pelo_rawg, nome_r),
                                                     (pela_loja, nome_l), (vinculado, nome_v), (perdido, nome_p)]],
           rawg_que_casa((pelo_rawg, slug_r, nome_r)), loja=loja_com(appdetails(pela_loja, nome_l)))
    _conectar(id_usuario)

    corpo = sincronizacao_steam.sincronizar(id_usuario, orcamento=None)

    pela_fonte_rawg = banco.consultar_um('SELECT id_midia FROM jogos WHERE rawg_slug = %s', (slug_r,))['id_midia']
    pela_fonte_loja = banco.consultar_um('SELECT id_midia FROM jogos WHERE steam_appid = %s', (pela_loja,))['id_midia']
    assert (corpo['novos'], corpo['total_nao_encontrados'], corpo['pendentes']) == (5, 1, 0)
    assert [n['origem_id'] for n in corpo['nao_encontrados']] == [str(perdido)]
    for id_midia in (midia_gravada, midia_appid, pela_fonte_rawg, pela_fonte_loja, destino):
        assert _item_da_midia(id_usuario, id_midia)['progresso_atual'] == 3


def test_steam_orcamento_esgotado_vira_pendente_e_nao_usa_o_vinculo(client, usuario, fontes, jogo):  # noqa: F811
    id_usuario, headers = usuario
    appid, slug, nome = jogo('SemTempo')
    _, slug_d, nome_d = jogo('Destino')
    destino = _no_catalogo(appid + 1, slug_d, nome_d, casado=False)
    _vincular_direto(appid, destino)
    fontes([jogo_steam(appid, nome, 180, HORA)], rawg_que_casa((appid, slug, nome)))
    _conectar(id_usuario)
    tempo = iter(range(0, 1000, 10))

    corpo = sincronizacao_steam.sincronizar(id_usuario, orcamento=5, relogio=lambda: next(tempo))

    assert (corpo['pendentes'], corpo['novos'], corpo['total_nao_encontrados']) == (1, 0, 0)
    assert _item_da_midia(id_usuario, destino) is None
