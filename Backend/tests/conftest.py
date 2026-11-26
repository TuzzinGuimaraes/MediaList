import os
import pathlib
import random
import sys
import uuid

import pytest
from flask_jwt_extended import create_access_token

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import banco
from app import app as flask_app

from .fontes_falsas import CHAVE_RAWG, CHAVE_STEAM, SessaoGet, rotas_steam
from .helpers import FakeAcessoRepository, FakeRefreshTokenRepository, criar_usuario

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')


def _sem_banco_real():
    raise RuntimeError('Teste tentou abrir o PostgreSQL real: troque a interface do módulo banco (FakeBanco)')


@pytest.fixture(autouse=True)
def banco_isolado(monkeypatch):
    """Nenhum teste abre o pool de verdade sem pedir: test_banco.py troca a URL."""
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', _sem_banco_real)
    yield
    banco.fechar()


@pytest.fixture
def app():
    # Resposta fora do modelo do contrato falha o teste (500), em vez de só ir para o log.
    flask_app.config.update(TESTING=True, CONTRATO_RESPOSTA_ESTRITA=True)
    return flask_app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def refresh_tokens(monkeypatch):
    """Tabela de refresh tokens em memória para todo teste: o login grava nela,
    e nenhum teste de rota deve escrever no PostgreSQL de verdade."""
    from routes import auth as auth_routes

    falso = FakeRefreshTokenRepository()
    monkeypatch.setattr(auth_routes, 'refresh_token_repository', falso)
    return falso


@pytest.fixture(autouse=True)
def acesso(monkeypatch):
    """Blocklist e Usuários em memória para todo teste: os callbacks do JWT
    consultam o repositório em cada rota autenticada."""
    from routes import auth as auth_routes

    falso = FakeAcessoRepository()
    monkeypatch.setattr(auth_routes, 'acesso_repository', falso)
    return falso


@pytest.fixture(autouse=True)
def logs_da_importacao_isolados(tmp_path, monkeypatch):
    """Os logs da importação vão para tmp_path: nenhum teste toca em
    Backend/importacao_logs/ (o arquivo real pode nem ser gravável)."""
    from importacao import utils as importacao_utils

    monkeypatch.setattr(importacao_utils, 'LOG_PATH', tmp_path / 'importacao.log')
    monkeypatch.setattr(importacao_utils, 'ERROR_LOG_PATH', tmp_path / 'importacao_erros.jsonl')
    yield
    importacao_utils.remover_log()


@pytest.fixture
def make_token(app):
    def _make(user_id='USR-TEST-0001', additional_claims=None):
        with app.app_context():
            return create_access_token(
                identity=user_id,
                additional_claims=additional_claims or {},
            )

    return _make


@pytest.fixture
def auth_headers(make_token):
    token = make_token()
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def admin_headers(make_token):
    token = make_token('USR-ADMIN-0001')
    return {'Authorization': f'Bearer {token}'}



# ============================================
# PostgreSQL de teste (TEST_DATABASE_URL); cada módulo pula sem ela
# ============================================

@pytest.fixture
def pg(monkeypatch):
    """O `banco` no PostgreSQL de teste; as Mídias e os Usuários anotados aqui são apagados no fim."""
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    criados = {'midias': [], 'usuarios': []}
    yield criados
    if criados['midias']:
        banco.executar('DELETE FROM midias WHERE id_midia = ANY(%s::uuid[])', (criados['midias'],))
    if criados['usuarios']:
        banco.executar('DELETE FROM usuarios WHERE id_usuario = ANY(%s::uuid[])', (criados['usuarios'],))
    banco.fechar()


@pytest.fixture
def usuario(pg, make_token):
    """(id, headers) de um Usuário novo no PostgreSQL de teste."""
    id_usuario = criar_usuario(pg)
    return id_usuario, {'Authorization': f'Bearer {make_token(id_usuario)}'}


@pytest.fixture
def limpar(pg):
    """appids e slugs do teste: apagados no fim (inclusive as Mídias importadas)."""
    usados = {'appids': [], 'slugs': []}
    yield usados
    banco.executar('DELETE FROM steam_appids WHERE appid = ANY(%s)', (usados['appids'],))
    banco.executar(
        'DELETE FROM midias WHERE id_midia IN '
        '(SELECT id_midia FROM jogos WHERE rawg_slug = ANY(%s) OR steam_appid = ANY(%s))',
        (usados['slugs'], usados['appids']),
    )


@pytest.fixture
def jogo(limpar):
    """Cria (appid, slug, nome) únicos para o teste."""
    def novo(nome='Jogo'):
        appid = random.randint(10**8, 2 * 10**9)
        slug = f'int-steam-{uuid.uuid4().hex[:12]}'
        limpar['appids'].append(appid)
        limpar['slugs'].append(slug)
        return appid, slug, f'{nome} {slug}'

    return novo


@pytest.fixture
def fontes(monkeypatch):
    """`fontes(jogos_steam, rotas_rawg, loja=rotas_da_loja, cabecas=heads_do_cdn)` instala a Steam, o RAWG e a loja da
    Steam falsos; devolve a sessão do RAWG (a da loja fica em `.loja`). A loja padrão não tem
    nenhuma appid (`success: false`)."""
    from integracoes import servico, sincronizacao_steam
    from integracoes.loja_steam import LojaSteam
    from integracoes.rawg import Rawg
    from integracoes.steam import Steam

    def instalar(jogos, rawg=None, loja=None, cabecas=None, **steam):
        monkeypatch.setitem(
            servico.PLATAFORMAS, 'steam', Steam(sessao=SessaoGet(rotas_steam(jogos, **steam)), chave=CHAVE_STEAM),
        )
        sessao_rawg = SessaoGet(rawg or {})
        sessao_rawg.loja = SessaoGet(loja or {r'/api/appdetails': lambda p: {str(p['appids']): {'success': False}}},
                                     cabecas)
        monkeypatch.setattr(sincronizacao_steam, 'Rawg', lambda **kw: Rawg(sessao=sessao_rawg, chave=CHAVE_RAWG, **kw))
        monkeypatch.setattr(sincronizacao_steam, 'LojaSteam', lambda **kw: LojaSteam(sessao=sessao_rawg.loja, **kw))
        return sessao_rawg

    return instalar
