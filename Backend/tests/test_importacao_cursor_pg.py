"""Cursor de página da Importação (spec `producao`): cada execução continua da página onde a anterior parou.

Vale para o RAWG (jogos); o do AniList, por popularidade, está em test_importacao_anilist_pg.
Roda o `run_import` contra uma fonte falsa (RAWG simulado na sessão HTTP)
e o PostgreSQL real com o usuário da aplicação (TEST_DATABASE_URL); sem ela, pula.
"""
import os
import sys

import pytest
import requests

import banco

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o cursor da Importação'
)

TIPOS = ('jogo',)


class _Resposta:
    def __init__(self, status_code, corpo=None):
        self.status_code = status_code
        self._corpo = corpo

    def json(self):
        return self._corpo

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f'{self.status_code} Server Error', response=self)


class _Fonte:
    """RAWG (GET /games) com páginas vazias.

    `ultima` é a última página que a fonte tem; `falha_em`, as páginas que respondem 502.
    """

    def __init__(self, ultima=None, falha_em=()):
        self.ultima = ultima
        self.falha_em = set(falha_em)
        self.pedidas = []

    def _pagina(self, pagina):
        self.pedidas.append(pagina)
        if len(self.pedidas) > 50:
            raise KeyboardInterrupt('fonte chamada demais: laço sem limite')
        return 502 if pagina in self.falha_em else 200

    def get(self, url, params, timeout):
        pagina = params['page']
        status = self._pagina(pagina)
        proxima = None if pagina == self.ultima else f'https://api.rawg.io/api/games?page={pagina + 1}'
        return _Resposta(status, {'results': [], 'next': proxima})

    def close(self):
        pass


class _SemEspera:
    def __init__(self, *args):
        pass

    def wait(self):
        pass


@pytest.fixture
def pg(monkeypatch):
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    banco.executar('DELETE FROM importacao_cursor')
    yield
    banco.executar('DELETE FROM importacao_cursor')
    banco.fechar()


@pytest.fixture
def importar(pg, monkeypatch):
    """Roda `run_import` para um Tipo de mídia contra a fonte dada; devolve as páginas pedidas."""
    from importacao import importar_jogos, run_import

    monkeypatch.setattr(importar_jogos, 'RAWG_API_KEY', 'chave-de-teste')

    def _importar(tipo, *argv, fonte=None):
        fonte = fonte or _Fonte()
        modulo = importar_jogos
        monkeypatch.setattr(modulo, 'criar_sessao_http', lambda **kw: fonte)
        monkeypatch.setattr(modulo, 'RateLimiter', _SemEspera)
        # Sem a passada lenta da série dos jogos (test_relacoes_jogos_pg).
        monkeypatch.setattr(sys, 'argv', ['run_import', '--tipo', tipo, '--serie-jogos', '0', *argv])
        try:
            run_import.main()
            codigo = 0
        except SystemExit as saida:
            codigo = saida.code
        # Página com falha sai com erro (workflow importacao vermelho); sem falha, não.
        assert codigo == (1 if fonte.falha_em & set(fonte.pedidas) else 0)
        return fonte.pedidas

    return _importar


def _cursor(tipo):
    linha = banco.consultar_um('SELECT proxima_pagina FROM importacao_cursor WHERE tipo_midia = %s', (tipo,))
    return linha and linha['proxima_pagina']


def test_usuario_da_aplicacao_tem_dml_e_nao_ddl_no_cursor(pg):
    privilegios = banco.consultar_um(
        "SELECT has_table_privilege('importacao_cursor', 'SELECT, INSERT, UPDATE, DELETE') AS dml, "
        "has_table_privilege('importacao_cursor', 'TRUNCATE') AS truncate"
    )
    assert privilegios == {'dml': True, 'truncate': False}


@pytest.mark.parametrize('tipo', TIPOS)
def test_segunda_execucao_continua_de_onde_a_primeira_parou(importar, tipo):
    assert importar(tipo, '--paginas', '2') == [1, 2]
    assert importar(tipo, '--paginas', '2') == [3, 4]
    assert _cursor(tipo) == 5


@pytest.mark.parametrize('tipo', TIPOS)
def test_pagina_com_falha_nao_avanca_o_cursor_e_encerra_o_tipo(importar, tipo, capsys):
    assert importar(tipo, '--paginas', '3', fonte=_Fonte(falha_em={2})) == [1, 2]
    assert _cursor(tipo) == 2
    assert 'paginas_com_falha=[2]' in capsys.readouterr().out

    assert importar(tipo, '--paginas', '2') == [2, 3]


@pytest.mark.parametrize('tipo', TIPOS)
def test_fim_da_fonte_volta_o_cursor_para_a_pagina_1(importar, tipo):
    importar(tipo, '--paginas', '2')

    assert importar(tipo, '--paginas', '5', fonte=_Fonte(ultima=4)) == [3, 4]
    assert _cursor(tipo) == 1
    assert importar(tipo, '--paginas', '1') == [1]


@pytest.mark.parametrize('tipo', TIPOS)
def test_do_inicio_ignora_e_reinicia_o_cursor(importar, tipo):
    importar(tipo, '--paginas', '3')

    assert importar(tipo, '--paginas', '2', '--do-inicio') == [1, 2]
    assert _cursor(tipo) == 3


def test_do_inicio_com_falha_na_primeira_pagina_deixa_o_cursor_em_1(importar):
    importar('jogo', '--paginas', '3')

    assert importar('jogo', '--paginas', '2', '--do-inicio', fonte=_Fonte(falha_em={1})) == [1]
    assert _cursor('jogo') == 1
