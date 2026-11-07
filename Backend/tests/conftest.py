import pathlib
import sys

import pytest
from flask_jwt_extended import create_access_token

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import database
from app import app as flask_app
from config import token_blocklist

from .helpers import FakeRefreshTokenRepository


@pytest.fixture
def app():
    flask_app.config.update(TESTING=True)
    yield flask_app

    token_blocklist.clear()
    database.mongo_db = None
    database.noticias_collection = None
    database.atualizacoes_collection = None
    database.notificacoes_collection = None
    database.preferencias_collection = None


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def refresh_tokens(monkeypatch):
    """Tabela de refresh tokens em memória para todo teste: o login grava nela,
    e nenhum teste de rota deve escrever no MySQL de verdade."""
    from routes import auth as auth_routes

    falso = FakeRefreshTokenRepository()
    monkeypatch.setattr(auth_routes, 'refresh_token_repository', falso)
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
