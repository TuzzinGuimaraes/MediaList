"""
MediaList API.
"""
import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import JWT_ACCESS_TOKEN_EXPIRES, JWT_SECRET_KEY, token_blocklist
from database import get_db_connection, init_mongodb
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

app = Flask(__name__)
CORS(app)

app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = JWT_ACCESS_TOKEN_EXPIRES

jwt = JWTManager(app)

init_mongodb()

try:
    mysql_conn = get_db_connection()
    if mysql_conn:
        mysql_conn.close()
        print("✅ MySQL conectado com sucesso!")
    else:
        print("⚠️  Aviso: MySQL não conectado")
except Exception as exc:
    print(f"⚠️  Aviso: Erro ao conectar MySQL - {exc}")

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
    debug = os.getenv('APP_DEBUG', 'true').lower() == 'true'

    print("=" * 70)
    print("🚀 MediaList API")
    print("=" * 70)
    print(f"🌐 Servidor: http://localhost:{port}")
    print("💾 Banco relacional: medialist_db")
    print("🎬 Tipos suportados: animes, mangás e jogos")
    print("=" * 70)
    app.run(host=host, debug=debug, port=port)
