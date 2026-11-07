"""Debug e CORS: o que a API expõe por padrão."""
from flask import Flask

import app as app_module


def _cors_header(client, origem):
    resposta = client.get('/api/health', headers={'Origin': origem})
    return resposta.headers.get('Access-Control-Allow-Origin')


def _app_isolado(em_producao, cors_origins=None):
    isolado = Flask(__name__)

    @isolado.route('/api/health')
    def health():
        return 'ok'

    app_module.configurar_cors(isolado, em_producao, cors_origins)
    return isolado.test_client()


def test_debug_desligado_por_padrao(monkeypatch):
    monkeypatch.delenv('APP_DEBUG', raising=False)
    assert app_module.debug_ativo() is False


def test_debug_liga_so_quando_pedido(monkeypatch):
    monkeypatch.setenv('APP_DEBUG', 'true')
    assert app_module.debug_ativo() is True


def test_cors_em_dev_permite_localhost_em_qualquer_porta(client):
    assert _cors_header(client, 'http://localhost:3005') == 'http://localhost:3005'
    assert _cors_header(client, 'http://127.0.0.1:8081') == 'http://127.0.0.1:8081'


def test_cors_em_dev_recusa_origem_externa(client):
    assert _cors_header(client, 'https://evil.example') is None
    assert _cors_header(client, 'http://localhost.evil.example') is None


def test_cors_em_dev_aceita_origens_de_cors_origins():
    client = _app_isolado(False, 'http://192.168.0.10:3005, https://app.exemplo.dev')
    assert _cors_header(client, 'http://192.168.0.10:3005') == 'http://192.168.0.10:3005'
    assert _cors_header(client, 'https://app.exemplo.dev') == 'https://app.exemplo.dev'
    assert _cors_header(client, 'https://evil.example') is None


def test_cors_desligado_em_producao():
    client = _app_isolado(True, 'https://app.exemplo.dev')
    assert _cors_header(client, 'http://localhost:3005') is None
    assert _cors_header(client, 'https://app.exemplo.dev') is None
