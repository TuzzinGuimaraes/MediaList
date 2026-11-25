"""Catálogo de jogos ampliado e sem duplicatas (spec `jogos-catalogo`, Q126/Q127, ticket 40).

Roda `importar_jogos` contra um RAWG falso (sessão HTTP em memória, nada de rede) e o
PostgreSQL real com o usuário da aplicação (TEST_DATABASE_URL); sem ela, pula.
"""
import os
import random
import re
import uuid
from datetime import date

import pytest

import banco
from importacao import db, importar_jogos

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a Importação de jogos'
)


class _Resposta:
    def __init__(self, status_code, corpo=None):
        self.status_code = status_code
        self._corpo = corpo

    def json(self):
        return self._corpo

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f'HTTP {self.status_code}')


class _Rawg:
    """`/games` (as `paginas`, a última com `next` nulo), `/games/<slug>` e `/games/<slug>/stores`."""

    def __init__(self, paginas, lojas=None):
        self.paginas = paginas
        self.lojas = lojas or {}
        self.chamadas = []

    def get(self, url, params=None, timeout=None):
        caminho = url.rsplit('/api', 1)[-1]
        self.chamadas.append((caminho, dict(params or {})))
        lojas = re.fullmatch(r'/games/([^/]+)/stores', caminho)
        if lojas:
            appids = self.lojas.get(lojas.group(1), [])
            return _Resposta(200, {'results': [
                {'id': 1, 'store_id': 1, 'url': f'https://store.steampowered.com/app/{a}/x/'} for a in appids
            ]})
        detalhe = re.fullmatch(r'/games/([^/]+)', caminho)
        if detalhe:
            basico = next(j for p in self.paginas for j in p if j['slug'] == detalhe.group(1))
            return _Resposta(200, {**basico, 'description_raw': 'Um jogo.', 'tags': [], 'stores': [
                {'id': 1, 'url': '', 'store': {'slug': 'steam'}}]})
        pagina = params['page']
        proxima = None if pagina >= len(self.paginas) else f'https://api.rawg.io/api/games?page={pagina + 1}'
        return _Resposta(200, {'results': self.paginas[pagina - 1], 'next': proxima})

    def close(self):
        pass

    def pedidas(self, sufixo):
        return [c for c, _ in self.chamadas if c.endswith(sufixo)]


class _SemEspera:
    chamadas = 0

    def __init__(self, *args):
        pass

    def wait(self):
        _SemEspera.chamadas += 1


@pytest.fixture
def pg(monkeypatch):
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    banco.executar("DELETE FROM importacao_cursor WHERE tipo_midia = 'jogo'")
    criadas = []
    yield criadas
    banco.executar(
        'DELETE FROM midias WHERE id_midia IN (SELECT id_midia FROM jogos WHERE rawg_slug = ANY(%s) '
        'OR steam_appid = ANY(%s))',
        ([c for c in criadas if isinstance(c, str)], [c for c in criadas if isinstance(c, int)]),
    )
    banco.executar("DELETE FROM importacao_cursor WHERE tipo_midia = 'jogo'")
    banco.fechar()


@pytest.fixture
def importar(pg, monkeypatch):
    def _importar(fonte, paginas=5):
        monkeypatch.setattr(importar_jogos, 'RAWG_API_KEY', 'chave-de-teste')
        monkeypatch.setattr(importar_jogos, 'criar_sessao_http', lambda **kw: fonte)
        monkeypatch.setattr(importar_jogos, '_obter_sessao_rawg_worker', lambda: fonte)
        monkeypatch.setattr(importar_jogos, 'RateLimiter', _SemEspera)
        _SemEspera.chamadas = 0
        return importar_jogos.importar_jogos(paginas=paginas, workers=1)

    return _importar


def _jogo(pg, nome, released='2011-04-19', capa=True):
    slug = f'jogo-jc-{uuid.uuid4().hex}'
    pg.append(slug)
    return {
        'slug': slug, 'name': nome, 'released': released, 'rating': 4.0,
        'background_image': 'https://media.rawg.io/media/games/x.jpg' if capa else None,
        'platforms': [{'platform': {'name': 'PC'}}], 'genres': [{'name': 'Action'}],
    }


def _da_loja(pg, nome, lancamento=date(2011, 4, 18)):
    appid = random.randint(10**8, 2 * 10**9)
    pg.append(appid)
    return db.salvar_jogo({
        'titulo_original': nome, 'titulo_portugues': nome, 'data_lancamento': lancamento,
        'status_jogo': 'lancado', 'modo_jogo': 'single', 'plataformas': ['PC'],
        'rawg_slug': None, 'steam_appid': appid,
    }, [])['id_midia'], appid


def _filha(id_midia):
    return banco.consultar_um(
        'SELECT j.rawg_slug, j.steam_appid, m.titulo_portugues, m.poster_url FROM jogos j '
        'JOIN midias m USING (id_midia) WHERE id_midia = %s', (id_midia,))


def _id_do_slug(slug):
    linha = banco.consultar_um('SELECT id_midia FROM jogos WHERE rawg_slug = %s', (slug,))
    return linha and linha['id_midia']


def _cursor():
    linha = banco.consultar_um("SELECT proxima_pagina FROM importacao_cursor WHERE tipo_midia = 'jogo'")
    return linha and linha['proxima_pagina']


def test_lista_por_popularidade_sem_o_filtro_do_metacritic(importar, pg):
    fonte = _Rawg([[_jogo(pg, 'Um')]])
    importar(fonte)

    _, params = fonte.chamadas[0]
    assert params['ordering'] == '-added'
    assert 'metacritic' not in params
    assert params['page'] == 1 and params['page_size'] == 40


def test_sem_capa_ou_sem_data_sao_pulados_sem_contar_como_falha(importar, pg):
    bom, sem_capa, sem_data = _jogo(pg, 'Bom'), _jogo(pg, 'Sem capa', capa=False), _jogo(pg, 'Sem data', released=None)
    fonte = _Rawg([[sem_capa, bom, sem_data]])

    stats = importar(fonte)

    assert (stats.processados, stats.sucessos, stats.falhas, stats.pulados) == (1, 1, 0, 2)
    assert 'pulados=2' in stats.resumo()
    assert fonte.pedidas(f"/games/{bom['slug']}") and not fonte.pedidas(f"/games/{sem_capa['slug']}")
    assert not fonte.pedidas(f"/games/{sem_data['slug']}")
    assert _id_do_slug(bom['slug']) and not _id_do_slug(sem_capa['slug']) and not _id_do_slug(sem_data['slug'])


def test_jogo_da_loja_com_titulo_ano_e_appid_iguais_vira_a_mesma_midia(importar, pg):
    marca = uuid.uuid4().hex[:8]
    id_loja, appid = _da_loja(pg, f'Pórtal™ 2: {marca}!')
    jogo = _jogo(pg, f'Portal 2 - {marca.upper()}')
    fonte = _Rawg([[jogo]], lojas={jogo['slug']: [7, appid]})

    stats = importar(fonte)

    assert (stats.sucessos, stats.ja_existia) == (1, 1)
    assert fonte.pedidas(f"/games/{jogo['slug']}/stores")
    assert _filha(id_loja) == {'rawg_slug': jogo['slug'], 'steam_appid': appid,
                               'titulo_portugues': jogo['name'], 'poster_url': jogo['background_image']}


def test_jogo_da_loja_com_outra_appid_fica_e_o_do_rawg_e_outra_midia(importar, pg):
    marca = uuid.uuid4().hex[:8]
    id_loja, appid = _da_loja(pg, f'Jogo {marca}')
    jogo = _jogo(pg, f'Jogo {marca}')
    fonte = _Rawg([[jogo]], lojas={jogo['slug']: [appid + 1]})

    stats = importar(fonte)

    assert (stats.sucessos, stats.ja_existia) == (1, 0)
    assert fonte.pedidas(f"/games/{jogo['slug']}/stores")
    assert _id_do_slug(jogo['slug']) not in (None, id_loja)
    assert _filha(id_loja)['rawg_slug'] is None


@pytest.mark.parametrize('outro', ['titulo', 'ano', 'sem data na loja'])
def test_sem_candidato_na_loja_nao_chama_stores(importar, pg, outro):
    marca = uuid.uuid4().hex[:8]
    nome_loja = f'Jogo {marca}' + (' 2' if outro == 'titulo' else '')
    lancamento = {'ano': date(2012, 4, 18), 'sem data na loja': None}.get(outro, date(2011, 4, 18))
    _da_loja(pg, nome_loja, lancamento=lancamento)
    jogo = _jogo(pg, f'Jogo {marca}')
    fonte = _Rawg([[jogo]])

    stats = importar(fonte)

    assert (stats.sucessos, stats.ja_existia) == (1, 0)
    assert not fonte.pedidas('/stores')


def test_chamada_a_stores_passa_pelo_rate_limiter(importar, pg):
    marca = uuid.uuid4().hex[:8]
    _da_loja(pg, f'Jogo {marca}')
    jogo = _jogo(pg, f'Jogo {marca}')
    fonte = _Rawg([[jogo]])

    importar(fonte)

    # A página, o detalhe e o /stores.
    assert _SemEspera.chamadas == len(fonte.chamadas) == 3


def test_fim_da_fonte_para_e_volta_o_cursor_para_1(importar, pg):
    fonte = _Rawg([[_jogo(pg, 'A')], [_jogo(pg, 'B')]])

    stats = importar(fonte, paginas=10)

    assert [p['page'] for c, p in fonte.chamadas if c == '/games'] == [1, 2]
    assert stats.sucessos == 2
    assert _cursor() == 1


def test_titulo_normalizado_sem_caixa_acento_pontuacao_nem_marca():
    normalizar = importar_jogos.titulo_normalizado
    assert normalizar('Pórtal™ 2: Édition!') == normalizar('PORTAL 2 edition') == 'portal2edition'
    assert normalizar('Half-Life®') == normalizar('Half Life') == 'halflife'
    assert normalizar('') == normalizar(None) == ''
