"""Equivalência da Importação rápida (spec importacao-rapida): o mesmo lote grava o mesmo banco.

O lote são as respostas gravadas do AniList e do RAWG (`tests/fixtures/importacao`), com um
item que o banco recusa e um jogo que já veio da loja da Steam (regras do #41). Roda pelos
importadores de verdade duas vezes: com a gravação antiga (uma transação por Mídia, gêneros um
a um) e com a nova (um comando por Mídia numa conexão por página). Compara Mídias, tabelas do
Tipo, gêneros, ligações e cursor. Usa TEST_DATABASE_URL; sem ela, pula.
"""
import copy
import os

import pytest

import banco
from importacao import db, medir, utils
from importacao.importar_jogos import appid_da_steam, processar_e_inserir_jogo_steam
from tipos_midia import TIPOS

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = [
    pytest.mark.skipif(
        not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a Importação'
    ),
    # O teste apaga Mídias reais do lote (com cascata nos Itens): nunca contra a produção.
    pytest.mark.skipif(
        'neon.tech' in (TEST_DATABASE_URL or ''), reason='TEST_DATABASE_URL aponta para a Neon: recusado'
    ),
]

#: Colunas que mudam a cada gravação, mesmo com os mesmos dados.
_VOLATEIS = {'id_midia', 'codigo_midia', 'data_criacao', 'data_atualizacao'}
_CURSOR = ('tipo_midia, proxima_pagina, crescimento_popularidade, crescimento_id, crescimento_empate, '
           'atualizacao_pagina')
_CHAVES = {'anime': ('animes', 'anilist_id'), 'manga': ('mangas', 'anilist_id'), 'jogo': ('jogos', 'rawg_slug')}


def _gravar_antigo(t, tipo, valores, generos):
    """A gravação de antes, como era: a Mídia numa transação própria e os gêneros um a um."""
    config = TIPOS[tipo]
    with banco.transacao() as tx:
        gravada = tx.consultar_um(
            f'WITH {db._midia(config)} SELECT id_midia, ja_existia, atualizada FROM resultado',
            {**valores, 'tipo': tipo},
        )
        for nome in dict.fromkeys(g.strip() for g in generos if g and g.strip() and gravada['atualizada']):
            tx.executar(
                'INSERT INTO generos (nome_genero, aplicavel_a) VALUES (%s, %s) '
                'ON CONFLICT (nome_genero) DO UPDATE SET aplicavel_a = ARRAY('
                'SELECT DISTINCT unnest(generos.aplicavel_a || EXCLUDED.aplicavel_a) ORDER BY 1) '
                'WHERE NOT generos.aplicavel_a @> EXCLUDED.aplicavel_a',
                (nome, config.aplicavel_a),
            )
            tx.executar(
                'INSERT INTO midias_generos (id_midia, id_genero) '
                'SELECT %s, id_genero FROM generos WHERE nome_genero = %s ON CONFLICT DO NOTHING',
                (gravada['id_midia'], nome),
            )
    return {'id_midia': gravada['id_midia'], 'ja_existia': gravada['ja_existia']}


#: Appid que o lote dá a dois jogos (os detalhes gravados do RAWG vêm com `stores[].url` vazio).
APPID = 999000111


def _fontes():
    """As fixtures, com um anime que o banco recusa (episódios fora do integer) e dois jogos
    com a mesma appid da Steam: o primeiro já veio da loja, o segundo não leva a appid (#41)."""
    fontes = medir.FontesGravadas()
    fontes.anilist = copy.deepcopy(fontes.anilist)
    fontes.detalhes = copy.deepcopy(fontes.detalhes)
    fontes.anilist['ANIME'][0]['data']['Page']['media'][3]['episodes'] = 10**12
    for jogo in fontes.rawg[0]['results'][:2]:
        fontes.detalhes[jogo['slug']]['stores'] = [{'url': f'https://store.steampowered.com/app/{APPID}/'}]
    return fontes


def _appid_da_loja(fontes):
    """A appid de um jogo das fixtures, que entra antes pela loja da Steam (sem rawg_slug)."""
    jogo = fontes.rawg[0]['results'][0]
    return appid_da_steam(fontes.detalhes[jogo['slug']], jogo)


def _limpar(fontes, appid):
    medir.apagar_midias(fontes.chaves())
    banco.executar(
        'DELETE FROM midias WHERE id_midia IN (SELECT id_midia FROM jogos WHERE steam_appid = %s)', (appid,)
    )


def _foto(fontes):
    """O que a Importação grava, sem ids nem datas: por chave da fonte."""
    chaves = fontes.chaves()
    midias = {}
    ligacoes = set()
    for tipo, (tabela, coluna) in _CHAVES.items():
        for linha in banco.consultar(
            f'SELECT to_jsonb(m) || to_jsonb(f) AS dados, f.{coluna}::text AS chave, '
            f'ARRAY(SELECT g.nome_genero FROM midias_generos mg JOIN generos g USING (id_genero) '
            f'WHERE mg.id_midia = m.id_midia ORDER BY 1) AS generos '
            f'FROM midias m JOIN {tabela} f USING (id_midia) WHERE f.{coluna} = ANY(%s)',
            (chaves[tipo],),
        ):
            midias[(tipo, linha['chave'])] = {k: v for k, v in linha['dados'].items() if k not in _VOLATEIS}
            ligacoes.update((tipo, linha['chave'], g) for g in linha['generos'])
    generos = {
        g['nome_genero']: (g['descricao'], sorted(g['aplicavel_a']))
        for g in banco.consultar('SELECT nome_genero, descricao, aplicavel_a FROM generos')
    }
    cursor = {c.pop('tipo_midia'): c for c in banco.consultar(f'SELECT {_CURSOR} FROM importacao_cursor')}
    # Contagens do banco inteiro: pegam Mídia órfã (sem a tabela do Tipo) ou linha a mais fora do lote.
    totais = banco.consultar_um(
        'SELECT (SELECT count(*) FROM midias) AS midias, (SELECT count(*) FROM animes) AS animes, '
        '(SELECT count(*) FROM mangas) AS mangas, (SELECT count(*) FROM jogos) AS jogos, '
        '(SELECT count(*) FROM midias_generos) AS midias_generos'
    )
    return {'midias': midias, 'ligacoes': ligacoes, 'generos': generos, 'cursor': cursor, 'totais': totais}


@pytest.fixture
def pg(monkeypatch, tmp_path):
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    monkeypatch.setattr(utils.RateLimiter, 'wait', lambda self: None)
    generos = banco.consultar('SELECT id_genero, aplicavel_a FROM generos')
    cursor = banco.consultar(f'SELECT {_CURSOR} FROM importacao_cursor')

    def restaurar():
        banco.executar('DELETE FROM generos WHERE NOT id_genero = ANY(%s)', ([g['id_genero'] for g in generos],))
        for g in generos:
            banco.executar(
                'UPDATE generos SET aplicavel_a = %s WHERE id_genero = %s', (g['aplicavel_a'], g['id_genero'])
            )
        banco.executar('DELETE FROM importacao_cursor')
        for c in cursor:
            banco.executar(
                f'INSERT INTO importacao_cursor ({_CURSOR}) VALUES (%s, %s, %s, %s, %s, %s)', tuple(c.values())
            )

    yield restaurar
    restaurar()
    banco.fechar()


def _importar(fontes, appid, restaurar):
    """Banco de partida igual, o jogo da loja da Steam, o lote inteiro; devolve a foto e os stats."""
    _limpar(fontes, appid)
    restaurar()
    processar_e_inserir_jogo_steam({
        'steam_appid': appid, 'name': 'Da loja', 'genres': [{'id': '23'}], 'platforms': {'windows': True},
    })
    with medir.fontes_falsas(fontes):
        stats = {tipo: funcao() for tipo, funcao in medir.importadores(paginas=2, workers=1).items()}
    foto = _foto(fontes)
    _limpar(fontes, appid)
    return foto, {tipo: (s.sucessos, s.falhas, s.paginas_com_falha) for tipo, s in stats.items()}


def test_mesmo_lote_grava_o_mesmo_banco_antes_e_depois(pg, monkeypatch):
    fontes = _fontes()
    appid = _appid_da_loja(fontes)

    with monkeypatch.context() as antigo:
        antigo.setattr(db, '_gravar', _gravar_antigo)
        foto_antiga, stats_antigos = _importar(fontes, appid, pg)
    foto_nova, stats_novos = _importar(fontes, appid, pg)

    assert stats_novos == stats_antigos == {'anime': (99, 1, []), 'manga': (100, 0, []), 'jogo': (80, 0, [])}
    assert foto_nova['cursor'] == foto_antiga['cursor']
    assert foto_nova['cursor']['jogo']['proxima_pagina'] == 3
    # AniList: a fronteira é a última obra da página 2 gravada (as fixtures não têm popularidade).
    for tipo, fonte in (('anime', 'ANIME'), ('manga', 'MANGA')):
        ultima = fontes.anilist[fonte][1]['data']['Page']['media'][-1]['id']
        assert foto_nova['cursor'][tipo]['crescimento_id'] == ultima
        assert foto_nova['cursor'][tipo]['atualizacao_pagina'] == 1
    assert foto_nova['generos'] == foto_antiga['generos']
    assert foto_nova['ligacoes'] == foto_antiga['ligacoes']
    assert foto_nova['midias'] == foto_antiga['midias']
    assert foto_nova['totais'] == foto_antiga['totais']
    assert foto_nova['totais']['midias'] == sum(foto_nova['totais'][t] for t in ('animes', 'mangas', 'jogos'))
    assert len(foto_nova['midias']) == 279
    # O jogo da loja virou a Mídia do primeiro jogo do RAWG (ganhou o rawg_slug); o segundo, sem a appid.
    # Um worker só: a ordem de gravação dos jogos é a da página.
    assert sum(1 for m in foto_nova['midias'].values() if m.get('steam_appid') == appid) == 1


def test_mesma_conexao_segue_depois_de_uma_midia_recusada(pg):
    """Na conexão da página, a Mídia que o banco recusa não desfaz a anterior nem trava a seguinte."""
    fontes = _fontes()
    appid = _appid_da_loja(fontes)
    _limpar(fontes, appid)
    base = {'titulo_original': 'X', 'titulo_portugues': 'X', 'status_anime': 'finalizado'}
    ids = [fontes.chaves()['anime'][i] for i in range(3)]
    try:
        with banco.autocommit() as t:
            primeira = db.salvar_anime({**base, 'anilist_id': ids[0]}, ['Ação'], t)
            with pytest.raises(banco.Integridade):
                db.salvar_anime({**base, 'anilist_id': ids[1], 'numero_episodios': 10**12}, ['Ação'], t)
            terceira = db.salvar_anime({**base, 'anilist_id': ids[2]}, ['Ação'], t)
        gravadas = banco.consultar('SELECT anilist_id FROM animes WHERE anilist_id = ANY(%s) ORDER BY 1', (ids,))
        assert [g['anilist_id'] for g in gravadas] == sorted([ids[0], ids[2]])
        assert primeira['id_midia'] != terceira['id_midia']
    finally:
        _limpar(fontes, appid)
