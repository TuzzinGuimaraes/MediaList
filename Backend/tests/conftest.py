import pathlib
import sys

import pytest
from flask_jwt_extended import create_access_token

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import banco
from app import app as flask_app

from .helpers import FakeAcessoRepository, FakeRefreshTokenRepository


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
