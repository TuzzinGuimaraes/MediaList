"""Importação do AniList sem o limite de 5000 (spec `anilist-sem-limite`).

A API pública recusa página acima de 100. Duas passadas por Tipo: o crescimento, em janelas
por popularidade (keyset), e a atualização das populares, em rodízio pelas páginas 1–100.
Roda o `run_import` contra o AniList falso (`fontes_falsas.AniListFalso`) e o PostgreSQL real
(TEST_DATABASE_URL); sem ela, pula. Página de 3 obras e limite na página 4, para as janelas
caberem em poucas obras.
"""
import os
import re
import sys

import pytest

import banco

from .fontes_falsas import AniListFalso

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a Importação do AniList'
)

BASE = 990000
TABELA = {'anime': 'animes', 'manga': 'mangas'}
FONTE = {'anime': 'ANIME', 'manga': 'MANGA'}


class _SemEspera:
    def __init__(self, *args):
        pass

    def wait(self):
        pass


def _distintas(n=20):
    """`n` obras, cada uma com a sua popularidade, a primeira a mais popular."""
    return [(BASE + i, 1000 - 10 * i) for i in range(1, n + 1)]


def _apagar():
    for tabela in TABELA.values():
        banco.executar(
            f'DELETE FROM midias WHERE id_midia IN (SELECT id_midia FROM {tabela} WHERE anilist_id >= %s)', (BASE,)
        )
    banco.executar('DELETE FROM importacao_cursor')


@pytest.fixture
def pg(monkeypatch):
    from importacao import anilist

    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    monkeypatch.setattr(anilist, 'POR_PAGINA', 3)
    monkeypatch.setattr(anilist, 'ULTIMA_PAGINA', 4)
    _apagar()
    yield
    _apagar()
    banco.fechar()


@pytest.fixture
def importar(pg, monkeypatch, capsys):
    """Roda `run_import` de um Tipo; devolve (código de saída, janelas pedidas, resumo do Tipo).

    Sem a passada das Temporadas (`--temporadas 0`), que tem o seu teste; `argv` pode religá-la.
    """
    from importacao import importar_animes, importar_mangas, run_import

    modulos = {'anime': importar_animes, 'manga': importar_mangas}

    def _importar(tipo, fonte, *argv):
        monkeypatch.setattr(modulos[tipo], 'criar_sessao_http', lambda **kw: fonte)
        monkeypatch.setattr(modulos[tipo], 'RateLimiter', _SemEspera)
        monkeypatch.setattr(sys, 'argv', ['run_import', '--tipo', tipo, '--temporadas', '0', *argv])
        antes = len(fonte.pedidos)
        capsys.readouterr()
        try:
            run_import.main()
            codigo = 0
        except SystemExit as saida:
            codigo = saida.code
        resumo = re.search(rf'^{tipo}: .*$', capsys.readouterr().out, re.M).group(0)
        return codigo, [_janela(p) for p in fonte.pedidos[antes:]], resumo

    return _importar


def _janela(variaveis):
    """O pedido em poucas letras: ('topo', página), ('empate', popularidade, página), ('abaixo', ...),
    ('ids', ids) na carga das Relações."""
    if 'idIn' in variaveis:
        return ('ids', tuple(variaveis['idIn']))
    if 'popularity' in variaveis:
        assert variaveis['sort'] == ['ID']
        return ('empate', variaveis['popularity'], variaveis['page'])
    assert variaveis['sort'] == ['POPULARITY_DESC', 'ID']
    if 'popularityLesser' in variaveis:
        return ('abaixo', variaveis['popularityLesser'], variaveis['page'])
    return ('topo', variaveis['page'])


def _importadas(tipo):
    return {linha['anilist_id'] for linha in banco.consultar(
        f'SELECT anilist_id FROM {TABELA[tipo]} WHERE anilist_id >= %s', (BASE,)
    )}


def _cursor(tipo):
    return banco.consultar_um(
        'SELECT proxima_pagina, crescimento_popularidade, crescimento_id, crescimento_empate, atualizacao_pagina '
        'FROM importacao_cursor WHERE tipo_midia = %s', (tipo,),
    )


def _ids(obras):
    return {o[0] for o in obras}


@pytest.mark.parametrize('tipo', ['anime', 'manga'])
def test_crescimento_continua_pela_popularidade_sem_buracos_nem_repetidas(importar, tipo):
    obras = _distintas()
    fonte = AniListFalso({FONTE[tipo]: obras})

    codigo, janelas, resumo = importar(tipo, fonte, '--paginas', '2', '--paginas-atualizacao', '0')
    assert (codigo, janelas) == (0, [('topo', 1), ('topo', 2)])
    assert _importadas(tipo) == _ids(obras[:6])
    sexta = obras[5]
    assert _cursor(tipo) == {'proxima_pagina': 1, 'crescimento_popularidade': sexta[1], 'crescimento_id': sexta[0],
                             'crescimento_empate': 1, 'atualizacao_pagina': 1}

    codigo, janelas, resumo = importar(tipo, fonte, '--paginas', '3', '--paginas-atualizacao', '0')
    # A faixa da fronteira (já acabou) e depois as obras abaixo dela, da página 1 da janela.
    assert janelas == [('empate', sexta[1], 1), ('abaixo', sexta[1], 1), ('abaixo', sexta[1], 2)]
    assert _importadas(tipo) == _ids(obras[:12])
    assert 'sucessos=6 falhas=0 ja_existia=0' in resumo


def test_janela_nunca_passa_da_ultima_pagina_e_segue_numa_janela_nova(importar):
    obras = _distintas()
    fonte = AniListFalso({'ANIME': obras})

    codigo, janelas, _ = importar('anime', fonte, '--paginas', '7', '--paginas-atualizacao', '0')

    p12 = obras[11][1]
    assert janelas == [('topo', 1), ('topo', 2), ('topo', 3), ('topo', 4),
                       ('empate', p12, 1), ('abaixo', p12, 1), ('abaixo', p12, 2)]
    assert _importadas('anime') == _ids(obras[:18])


@pytest.mark.parametrize('tipo', ['anime', 'manga'])
def test_empate_maior_que_uma_pagina_retoma_na_posicao_da_faixa(importar, tipo):
    # Oito obras com a mesma popularidade, com ids fora de ordem: a faixa vai por id.
    faixa = [BASE + n for n in (50, 12, 31, 7, 44, 20, 3, 38)]
    obras = [(BASE + 90, 500), (BASE + 91, 500), *[(i, 300) for i in faixa], (BASE + 60, 100), (BASE + 1, 100),
             (BASE + 70, 100)]
    por_id = sorted(faixa)
    fonte = AniListFalso({FONTE[tipo]: obras})

    _, janelas, _ = importar(tipo, fonte, '--paginas', '2', '--paginas-atualizacao', '0')
    assert janelas == [('topo', 1), ('topo', 2)]
    assert _importadas(tipo) == {BASE + 90, BASE + 91, *por_id[:4]}
    assert _cursor(tipo)['crescimento_popularidade'] == 300
    assert (_cursor(tipo)['crescimento_id'], _cursor(tipo)['crescimento_empate']) == (por_id[3], 4)

    # Quatro da faixa já vieram: retoma na página 2 dela, pulando a que já veio.
    _, janelas, resumo = importar(tipo, fonte, '--paginas', '1', '--paginas-atualizacao', '0')
    assert janelas == [('empate', 300, 2)]
    assert _importadas(tipo) == {BASE + 90, BASE + 91, *por_id[:6]}
    assert 'sucessos=2 falhas=0 ja_existia=0' in resumo

    # Seis já vieram (página 2 cheia): relê a página 2, onde está a sexta, para não perder obra se
    # a faixa tiver encolhido desde a última execução; as dela são puladas.
    _, janelas, resumo = importar(tipo, fonte, '--paginas', '5', '--paginas-atualizacao', '0')
    assert janelas == [('empate', 300, 2), ('empate', 300, 3), ('abaixo', 300, 1)]
    assert _importadas(tipo) == _ids(obras)
    assert 'sucessos=5 falhas=0 ja_existia=0' in resumo


def test_no_fim_o_crescimento_volta_ao_topo(importar):
    obras = _distintas(5)
    fonte = AniListFalso({'ANIME': obras})

    _, janelas, _ = importar('anime', fonte, '--paginas', '5', '--paginas-atualizacao', '0')
    assert janelas == [('topo', 1), ('topo', 2)]
    assert _cursor('anime')['crescimento_popularidade'] is None
    assert _cursor('anime')['crescimento_id'] is None
    assert _cursor('anime')['proxima_pagina'] == 1

    _, janelas, resumo = importar('anime', fonte, '--paginas', '1', '--paginas-atualizacao', '0')
    assert janelas == [('topo', 1)]
    assert 'ja_existia=3' in resumo


def test_no_fim_abaixo_da_fronteira_tambem_volta_ao_topo(importar):
    obras = _distintas(8)
    fonte = AniListFalso({'ANIME': obras})
    importar('anime', fonte, '--paginas', '1', '--paginas-atualizacao', '0')

    _, janelas, _ = importar('anime', fonte, '--paginas', '9', '--paginas-atualizacao', '0')

    p3 = obras[2][1]
    assert janelas == [('empate', p3, 1), ('abaixo', p3, 1), ('abaixo', p3, 2)]
    assert _cursor('anime')['crescimento_popularidade'] is None
    assert _importadas('anime') == _ids(obras)


def test_atualizacao_das_populares_em_rodizio_ate_a_ultima_pagina(importar):
    fonte = AniListFalso({'ANIME': _distintas()})

    codigo, janelas, _ = importar('anime', fonte, '--paginas', '0', '--paginas-atualizacao', '3')
    assert (codigo, janelas) == (0, [('topo', 1), ('topo', 2), ('topo', 3)])
    assert _cursor('anime')['atualizacao_pagina'] == 4
    assert _cursor('anime')['crescimento_popularidade'] is None

    _, janelas, _ = importar('anime', fonte, '--paginas', '0', '--paginas-atualizacao', '3')
    assert janelas == [('topo', 4), ('topo', 1), ('topo', 2)]
    assert _cursor('anime')['atualizacao_pagina'] == 3


def test_as_duas_passadas_numa_execucao_cada_uma_com_o_seu_cursor(importar):
    obras = _distintas()
    fonte = AniListFalso({'ANIME': obras})

    codigo, janelas, _ = importar('anime', fonte, '--paginas', '2', '--paginas-atualizacao', '2')

    assert (codigo, janelas) == (0, [('topo', 1), ('topo', 2), ('topo', 1), ('topo', 2)])
    assert _cursor('anime')['crescimento_id'] == obras[5][0]
    assert _cursor('anime')['atualizacao_pagina'] == 3


def test_o_400_de_limite_e_fim_da_janela_e_nao_falha(importar):
    obras = _distintas()
    # O AniList passa a recusar acima da página 2, antes da última que a Importação conhece.
    fonte = AniListFalso({'ANIME': obras}, limite=2)

    codigo, janelas, resumo = importar('anime', fonte, '--paginas', '5', '--paginas-atualizacao', '4')

    p6 = obras[5][1]
    assert codigo == 0
    assert 'paginas_com_falha=[]' in resumo
    assert janelas == [('topo', 1), ('topo', 2), ('topo', 3), ('empate', p6, 1), ('abaixo', p6, 1),
                       ('topo', 1), ('topo', 2), ('topo', 3)]
    assert _importadas('anime') == _ids(obras[:9])
    assert _cursor('anime')['crescimento_id'] == obras[8][0]
    assert _cursor('anime')['atualizacao_pagina'] == 1


def test_pagina_com_falha_nao_avanca_o_cursor_e_encerra_o_tipo(importar):
    obras = _distintas()
    fonte = AniListFalso({'ANIME': obras}, falha_em={2})

    codigo, janelas, resumo = importar('anime', fonte, '--paginas', '3', '--paginas-atualizacao', '2')
    assert codigo == 1
    assert janelas == [('topo', 1), ('topo', 2)]
    assert 'paginas_com_falha=[2]' in resumo
    assert _cursor('anime')['crescimento_id'] == obras[2][0]

    codigo, janelas, _ = importar('anime', fonte, '--paginas', '1', '--paginas-atualizacao', '0')
    assert (codigo, janelas) == (0, [('empate', obras[2][1], 1)])


def test_falha_na_atualizacao_nao_avanca_o_cursor_dela(importar):
    fonte = AniListFalso({'ANIME': _distintas()}, falha_em={3})

    codigo, janelas, resumo = importar('anime', fonte, '--paginas', '1', '--paginas-atualizacao', '3')

    assert codigo == 1
    assert janelas == [('topo', 1), ('topo', 1), ('topo', 2)]
    assert 'paginas_com_falha=[2]' in resumo
    assert _cursor('anime')['atualizacao_pagina'] == 2


def test_cursor_de_pagina_de_antes_continua_da_ultima_pagina_do_topo(importar):
    obras = _distintas()
    fonte = AniListFalso({'ANIME': obras})
    # Produção em 2026-11-25: o cursor de página parou na 101, que o AniList recusa.
    banco.executar("INSERT INTO importacao_cursor (tipo_midia, proxima_pagina) VALUES ('anime', 101)")

    codigo, janelas, _ = importar('anime', fonte, '--paginas', '3', '--paginas-atualizacao', '0')

    p12 = obras[11][1]
    assert (codigo, janelas) == (0, [('topo', 4), ('empate', p12, 1), ('abaixo', p12, 1)])
    assert _cursor('anime')['crescimento_id'] == obras[14][0]
    assert _cursor('anime')['proxima_pagina'] == 1


def test_do_inicio_recomeca_as_duas_passadas_do_topo(importar):
    fonte = AniListFalso({'ANIME': _distintas()})
    importar('anime', fonte, '--paginas', '2', '--paginas-atualizacao', '2')

    _, janelas, _ = importar('anime', fonte, '--paginas', '1', '--paginas-atualizacao', '1', '--do-inicio')

    assert janelas == [('topo', 1), ('topo', 1)]
    assert _cursor('anime')['atualizacao_pagina'] == 2


def test_cada_tipo_tem_o_seu_cursor(importar):
    obras = _distintas()
    fonte = AniListFalso({'ANIME': obras, 'MANGA': obras})
    importar('anime', fonte, '--paginas', '2', '--paginas-atualizacao', '1')

    _, janelas, _ = importar('manga', fonte, '--paginas', '1', '--paginas-atualizacao', '1')

    assert janelas == [('topo', 1), ('topo', 1)]
    assert _cursor('anime')['crescimento_id'] == obras[5][0]
    assert _cursor('manga')['crescimento_id'] == obras[2][0]



def test_faixa_maior_que_uma_janela_segue_abaixo_dela_sem_passar_da_ultima_pagina(importar):
    # 14 obras com a mesma popularidade; a janela da faixa tem 4 páginas de 3 (12 obras).
    faixa = [(BASE + 100 + n, 300) for n in range(14)]
    obras = [(BASE + 1, 900), *faixa, (BASE + 2, 100), (BASE + 3, 100)]
    fonte = AniListFalso({'ANIME': obras})

    codigo, janelas, _ = importar('anime', fonte, '--paginas', '20', '--paginas-atualizacao', '0')

    assert codigo == 0
    assert janelas == [('topo', 1), ('topo', 2), ('topo', 3), ('topo', 4), ('empate', 300, 4), ('abaixo', 300, 1)]
    # As duas últimas da faixa ficam para a volta seguinte: o AniList não filtra por id.
    assert _importadas('anime') == _ids(obras) - _ids(faixa[12:])
