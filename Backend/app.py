"""
MediaList API.

Importar este módulo não conecta em nada: o pool do PostgreSQL abre na
primeira consulta (módulo `banco`).
"""
import json
import logging
import os
import re
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from flask import Flask, jsonify, request
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.exceptions import HTTPException

from banco import Conflito, Indisponivel, Integridade
from config import EM_PRODUCAO, JWT_ACCESS_TOKEN_EXPIRES, JWT_SECRET_KEY, token_blocklist
from parametros import ErroEntrada
from routes import (
    animes_bp,
    auth_bp,
    avaliacoes_bp,
    jogos_bp,
    lista_bp,
    mangas_bp,
    midias_bp,
    moderacao_bp,
    noticias_bp,
    preferencias_bp,
    usuario_bp,
    utils_bp,
)

logger = logging.getLogger(__name__)

# Front web em dev roda em localhost/127.0.0.1, em qualquer porta.
ORIGEM_LOCAL = re.compile(r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$')


class FormatoJSON(logging.Formatter):
    """Uma linha JSON por registro, para o coletor de logs em produção."""

    def format(self, record):
        registro = {
            'momento': datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            'nivel': record.levelname,
            'logger': record.name,
            'mensagem': record.getMessage(),
        }
        if record.exc_info:
            registro['excecao'] = self.formatException(record.exc_info)
        return json.dumps(registro, ensure_ascii=False)


def configurar_logging(em_producao):
    """Texto legível em dev, JSON em produção; nível por LOG_LEVEL (padrão INFO)."""
    handler = logging.StreamHandler()
    if em_producao:
        handler.setFormatter(FormatoJSON())
    else:
        handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(name)s: %(message)s'))

    raiz = logging.getLogger()
    raiz.handlers[:] = [handler]
    raiz.setLevel(os.getenv('LOG_LEVEL', 'INFO').upper())


class ProvedorJSON(DefaultJSONProvider):
    """Toda resposta: Decimal vira número, data vira ISO 8601, UUID vira texto."""

    @staticmethod
    def default(o):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        if isinstance(o, uuid.UUID):
            return str(o)
        return DefaultJSONProvider.default(o)


def configurar_cors(flask_app, em_producao, cors_origins=None):
    """CORS desligado em produção (front e API no mesmo domínio).

    Em dev aceita só origens locais mais as de CORS_ORIGINS (separadas por
    vírgula). Apps nativos não mandam Origin e não dependem de CORS.
    """
    if em_producao:
        return
    extras = [origem.strip() for origem in (cors_origins or '').split(',') if origem.strip()]
    CORS(flask_app, origins=[ORIGEM_LOCAL, *extras])


def debug_ativo():
    return os.getenv('APP_DEBUG', 'false').lower() == 'true'


configurar_logging(EM_PRODUCAO)

app = Flask(__name__)
app.json = ProvedorJSON(app)
configurar_cors(app, EM_PRODUCAO, os.getenv('CORS_ORIGINS'))

app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = JWT_ACCESS_TOKEN_EXPIRES

jwt = JWTManager(app)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(usuario_bp, url_prefix='/api/usuario')

app.register_blueprint(midias_bp, url_prefix='/api/midias')
app.register_blueprint(animes_bp, url_prefix='/api/animes')
app.register_blueprint(mangas_bp, url_prefix='/api/mangas')
app.register_blueprint(jogos_bp, url_prefix='/api/jogos')

app.register_blueprint(lista_bp, url_prefix='/api/lista')
app.register_blueprint(avaliacoes_bp, url_prefix='/api/avaliacoes')
app.register_blueprint(noticias_bp, url_prefix='/api/noticias')
app.register_blueprint(moderacao_bp, url_prefix='/api/moderacao')
app.register_blueprint(preferencias_bp, url_prefix='/api/preferencias')
app.register_blueprint(utils_bp, url_prefix='/api')


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    """Verificar se token foi revogado."""
    return jwt_payload['jti'] in token_blocklist


@jwt.token_verification_loader
def token_serve_para_a_rota(jwt_header, jwt_payload):
    """Token de recuperação de senha só vale em /auth/redefinir-senha."""
    if jwt_payload.get('tipo') == 'recuperacao_senha':
        return request.endpoint == 'auth.redefinir_senha'
    return True


@jwt.token_verification_failed_loader
def token_fora_da_rota(jwt_header, jwt_payload):
    return jsonify({'erro': 'Token inválido para esta operação'}), 401


@app.errorhandler(Conflito)
def conflito(_erro):
    return jsonify({'erro': 'Registro já existe'}), 409


@app.errorhandler(Integridade)
def integridade(_erro):
    return jsonify({'erro': 'Dados inválidos'}), 400


@app.errorhandler(Indisponivel)
def indisponivel(_erro):
    return jsonify({'erro': 'Serviço temporariamente indisponível'}), 503


@app.errorhandler(ErroEntrada)
def erro_entrada(erro):
    return jsonify({'erro': str(erro)}), 400


@app.errorhandler(Exception)
def erro_inesperado(erro):
    """Qualquer outra exceção: log com traceback, 500 sem detalhe para o cliente."""
    if isinstance(erro, HTTPException):
        return erro
    logger.exception('Erro não tratado em %s %s', request.method, request.path)
    return jsonify({'erro': 'Erro interno do servidor'}), 500


@app.errorhandler(404)
def not_found(_error):
    return jsonify({'erro': 'Endpoint não encontrado'}), 404


@app.errorhandler(500)
def internal_error(_error):
    return jsonify({'erro': 'Erro interno do servidor'}), 500


@app.errorhandler(401)
def unauthorized(_error):
    return jsonify({'erro': 'Não autorizado'}), 401


@app.errorhandler(403)
def forbidden(_error):
    return jsonify({'erro': 'Acesso negado'}), 403


if __name__ == '__main__':
    host = os.getenv('APP_HOST', '0.0.0.0')
    port = int(os.getenv('APP_PORT', '5000'))
    logger.info('MediaList API em http://localhost:%s', port)
    app.run(host=host, debug=debug_ativo(), port=port)
