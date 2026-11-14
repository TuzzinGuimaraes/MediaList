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

from flask import Flask, request
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from pydantic import ValidationError as PydanticValidationError
from werkzeug.exceptions import HTTPException

from banco import Conflito, Indisponivel, Integridade
from config import EM_PRODUCAO, JWT_ACCESS_TOKEN_EXPIRES, JWT_SECRET_KEY
from contrato import CodigoErro, detalhes_de_validacao, registrar_documentacao, resposta_erro
from parametros import ErroEntrada
from routes import auth as rotas_auth
from routes import (
    auth_bp,
    avaliacoes_bp,
    lista_bp,
    midias_bp,
    moderacao_bp,
    noticias_bp,
    preferencias_bp,
    usuario_bp,
    utils_bp,
)
from schemas import ValidationError as SchemaValidationError

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

app.register_blueprint(lista_bp, url_prefix='/api/lista')
app.register_blueprint(avaliacoes_bp, url_prefix='/api/avaliacoes')
app.register_blueprint(noticias_bp, url_prefix='/api/noticias')
app.register_blueprint(moderacao_bp, url_prefix='/api/moderacao')
app.register_blueprint(preferencias_bp, url_prefix='/api/preferencias')
app.register_blueprint(utils_bp, url_prefix='/api')

# Depois dos blueprints: o OpenAPI é gerado a partir das rotas registradas.
registrar_documentacao(app, EM_PRODUCAO)


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    """Logout e token de recuperação usado: blocklist no banco (ticket 26)."""
    return rotas_auth.acesso_repository.revogado(jwt_payload['jti'])


@jwt.user_lookup_loader
def usuario_do_token(jwt_header, jwt_payload):
    """Usuário inexistente ou desativado não usa o token (ticket 26).

    Sem isso o token de um Usuário apagado seguia válido até expirar, e a rota
    falhava adiante (FK -> 400). Uma consulta por requisição autenticada.
    """
    usuario = rotas_auth.acesso_repository.usuario(jwt_payload['sub'])
    return usuario if usuario and usuario['ativo'] else None


@jwt.user_lookup_error_loader
def usuario_sem_acesso(jwt_header, jwt_payload):
    # 401, não 403: o cliente trata como sessão encerrada (refresh ou login).
    return resposta_erro(401, CodigoErro.SESSAO_INVALIDA, 'Sessão inválida: Usuário inexistente ou desativado')


# Loaders do flask-jwt no envelope de erro (sem `msg`); os status são os padrões
# da biblioteca, inclusive o 422 do token malformado.
@jwt.unauthorized_loader
def sem_token(_motivo):
    return resposta_erro(401, CodigoErro.NAO_AUTENTICADO, 'Faça login para continuar')


@jwt.invalid_token_loader
def token_malformado(_motivo):
    return resposta_erro(422, CodigoErro.TOKEN_INVALIDO, 'Token inválido')


@jwt.expired_token_loader
def token_expirado(_jwt_header, _jwt_payload):
    return resposta_erro(401, CodigoErro.TOKEN_EXPIRADO, 'Sessão expirada')


@jwt.revoked_token_loader
def token_revogado(_jwt_header, _jwt_payload):
    return resposta_erro(401, CodigoErro.TOKEN_REVOGADO, 'Sessão encerrada')


@jwt.needs_fresh_token_loader
def token_nao_recente(_jwt_header, _jwt_payload):
    return resposta_erro(401, CodigoErro.TOKEN_INVALIDO, 'Entre de novo para continuar')


@jwt.token_verification_loader
def token_serve_para_a_rota(jwt_header, jwt_payload):
    """Token de recuperação de senha só vale em /auth/redefinir-senha."""
    if jwt_payload.get('tipo') == 'recuperacao_senha':
        return request.endpoint == 'auth.redefinir_senha'
    return True


@jwt.token_verification_failed_loader
def token_fora_da_rota(jwt_header, jwt_payload):
    return resposta_erro(401, CodigoErro.TOKEN_INVALIDO, 'Token inválido para esta operação')


# ============================================
# Erros no envelope {erro, codigo, detalhes?} (ADR 0011)
# ============================================

@app.errorhandler(PydanticValidationError)
def entrada_fora_do_modelo(erro):
    """Entrada recusada pelo SpecTree (ou por um modelo Pydantic na rota)."""
    return resposta_erro(
        400, CodigoErro.DADOS_INVALIDOS, 'Dados inválidos', detalhes_de_validacao(erro.errors(include_url=False)),
    )


@app.errorhandler(SchemaValidationError)
def payload_invalido(erro):
    """`BaseSchema` legado, enquanto existir; as mensagens já vêm em português."""
    return resposta_erro(400, CodigoErro.DADOS_INVALIDOS, 'Dados inválidos', erro.errors)


@app.errorhandler(Conflito)
def conflito(_erro):
    return resposta_erro(409, CodigoErro.CONFLITO, 'Registro já existe')


@app.errorhandler(Integridade)
def integridade(_erro):
    return resposta_erro(400, CodigoErro.DADOS_INVALIDOS, 'Dados inválidos')


@app.errorhandler(Indisponivel)
def indisponivel(_erro):
    return resposta_erro(503, CodigoErro.INDISPONIVEL, 'Serviço temporariamente indisponível')


@app.errorhandler(ErroEntrada)
def erro_entrada(erro):
    return resposta_erro(400, CodigoErro.DADOS_INVALIDOS, str(erro))


# Erros HTTP do Flask/Werkzeug (404 de rota, 405, abort(...)): status -> (código, mensagem).
ERROS_HTTP = {
    400: (CodigoErro.REQUISICAO_INVALIDA, 'Requisição inválida'),
    401: (CodigoErro.NAO_AUTENTICADO, 'Não autorizado'),
    403: (CodigoErro.ACESSO_NEGADO, 'Acesso negado'),
    404: (CodigoErro.NAO_ENCONTRADO, 'Endpoint não encontrado'),
    405: (CodigoErro.METODO_NAO_PERMITIDO, 'Método não permitido'),
    409: (CodigoErro.CONFLITO, 'Registro já existe'),
}


@app.errorhandler(HTTPException)
def erro_http(erro):
    if erro.response is not None:  # abort(resposta): a resposta já está pronta
        return erro.response
    status = erro.code or 500
    if status >= 500:
        return resposta_erro(status, CodigoErro.ERRO_INTERNO, 'Erro interno do servidor')
    codigo, mensagem = ERROS_HTTP.get(status, (CodigoErro.REQUISICAO_INVALIDA, 'Requisição inválida'))
    return resposta_erro(status, codigo, mensagem)


@app.errorhandler(Exception)
def erro_inesperado(_erro):
    """Qualquer outra exceção: log com traceback, 500 sem detalhe para o cliente."""
    logger.exception('Erro não tratado em %s %s', request.method, request.path)
    return resposta_erro(500, CodigoErro.ERRO_INTERNO, 'Erro interno do servidor')


if __name__ == '__main__':
    host = os.getenv('APP_HOST', '0.0.0.0')
    port = int(os.getenv('APP_PORT', '5000'))
    logger.info('MediaList API em http://localhost:%s', port)
    app.run(host=host, debug=debug_ativo(), port=port)
