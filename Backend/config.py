"""
Configurações centrais da aplicação.
"""
import os
import sys
from datetime import timedelta
from urllib.parse import quote

from dotenv import load_dotenv


def _forcar_saida_utf8() -> None:
    """Garante que stdout/stderr aceitem os emojis das mensagens de log.

    No Windows, quando a saída não é um console — pipe, arquivo de log, um
    serviço, o CI — o Python usa a codificação da localidade (cp1252), que não
    codifica emoji. Um simples `print("✅ ...")` levanta UnicodeEncodeError e,
    quando isso acontece dentro de um `except`, derruba a aplicação na
    inicialização. Reconfigurar aqui cobre todos os pontos de entrada, porque
    este módulo é importado por todos eles.
    """
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, 'reconfigure', None)
        if reconfigure is None:
            continue
        try:
            reconfigure(encoding='utf-8', errors='replace')
        except (ValueError, OSError):
            # Fluxo já fechado ou não reconfigurável: não é motivo para abortar.
            pass


_forcar_saida_utf8()

load_dotenv()
APP_ENV = os.getenv('APP_ENV', 'development')
EM_PRODUCAO = APP_ENV == 'production'

APP_ENV = os.getenv('APP_ENV', 'development')
EM_PRODUCAO = APP_ENV == 'production'

# Defaults de desenvolvimento. Em produção nenhum deles é aceito: o app recusa
# iniciar (ver _validar_segredos_de_producao, no fim do módulo).
_JWT_SECRET_DEV = 'sua-chave-secreta-super-segura'
_DB_PASSWORD_DEV = 'MediaList@2025!Secure'
_MONGO_URI_DEV = (
    'mongodb://medialist_app:medialist-app-dev@localhost:27017/'
    'medialist_updates_db?authSource=medialist_updates_db'
)
_SEGREDOS_CONHECIDOS = {
    'JWT_SECRET_KEY': {_JWT_SECRET_DEV, 'troque-esta-chave-em-producao'},
    'DB_PASSWORD': {_DB_PASSWORD_DEV},
}
# Senhas default do Mongo (root antigo e usuário da aplicação em dev).
_SENHAS_MONGO_CONHECIDAS = ('senha123', 'medialist-app-dev')


def _env(nome, default):
    """Variável de ambiente; vazia conta como ausente e cai no default."""
    return os.getenv(nome) or default


# Configuração JWT
JWT_SECRET_KEY = _env('JWT_SECRET_KEY', _JWT_SECRET_DEV)
JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=int(os.getenv('JWT_ACCESS_TOKEN_DAYS', '1')))
# Refresh token opaco e rotativo (ADR-0006). Não é JWT: vale o que está na
# tabela `refresh_tokens`, então expira e é revogado no banco.
REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_DAYS', '30')))

# Só a Importação (Backend/importacao) ainda lê isto; o app fala PostgreSQL
# pelo módulo `banco`. Sai com a Importação sobre o PostgreSQL (ticket 23).
MYSQL_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '3308')),
    'user': os.getenv('DB_USER', 'media_app_user'),
    'password': _env('DB_PASSWORD', _DB_PASSWORD_DEV),
    'database': os.getenv('DB_NAME', 'medialist_db'),
    'charset': 'utf8mb4',
    'use_unicode': True,
}

# Pool do PostgreSQL (módulo `banco`), por processo: com N workers do gunicorn
# o banco vê até N * DB_POOL_MAX conexões. O timeout (segundos) vale para abrir
# conexão e para esperar uma livre no pool; estourado, a API responde 503.
DB_POOL_MIN = int(os.getenv('DB_POOL_MIN', '1'))
DB_POOL_MAX = int(os.getenv('DB_POOL_MAX', '10'))
DB_POOL_TIMEOUT = float(os.getenv('DB_POOL_TIMEOUT', '5'))


def database_url(*, dono: bool = False) -> str:
    """URL do PostgreSQL (postgresql://user:pass@host:port/name).

    Por padrão usa o usuário da aplicação (DB_USER/DB_PASSWORD, só DML). Com
    `dono=True`, para as migrações, usa DB_OWNER_USER/DB_OWNER_PASSWORD quando
    definidos. Usuário e senha vão escapados: '@', ':' e '/' não quebram a URL.
    """
    user = _env('DB_USER', 'media_app_user')
    password = _env('DB_PASSWORD', _DB_PASSWORD_DEV)
    if dono and os.getenv('DB_OWNER_USER'):
        user = os.environ['DB_OWNER_USER']
        password = os.getenv('DB_OWNER_PASSWORD', '')
    host = _env('DB_HOST', 'localhost')
    port = _env('DB_PORT', '5433')
    name = _env('DB_NAME', 'medialist_db')
    return f'postgresql://{quote(user, safe="")}:{quote(password, safe="")}@{host}:{port}/{name}'

# Configuração MongoDB: usuário da aplicação com readWrite só no MONGO_DB_NAME,
# nunca o root (ver docker/mongo-init/01-app-user.js).
MONGO_URI = _env('MONGO_URI', _MONGO_URI_DEV)
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'medialist_updates_db')

# Configurações das APIs de importação
ANILIST_API_URL = os.getenv('ANILIST_API_URL', 'https://graphql.anilist.co')
RAWG_API_KEY = os.getenv('RAWG_API_KEY', '')
RAWG_API_URL = os.getenv('RAWG_API_URL', 'https://api.rawg.io/api')

# Token Blocklist
token_blocklist = set()


def _problemas_de_producao():
    """Segredos ausentes ou iguais a um default conhecido."""
    problemas = []
    for nome, conhecidos in _SEGREDOS_CONHECIDOS.items():
        valor = os.getenv(nome)
        if not valor:
            problemas.append(f'{nome} ausente')
        elif valor in conhecidos:
            problemas.append(f'{nome} igual a um default conhecido')

    uri = os.getenv('MONGO_URI')
    if not uri:
        problemas.append('MONGO_URI ausente')
    elif any(f':{senha}@' in uri for senha in _SENHAS_MONGO_CONHECIDAS):
        problemas.append('MONGO_URI usa uma senha default conhecida')
    return problemas


def _validar_segredos_de_producao():
    problemas = _problemas_de_producao()
    if problemas:
        raise SystemExit(
            'APP_ENV=production recusou iniciar: ' + '; '.join(problemas)
        )


if EM_PRODUCAO:
    _validar_segredos_de_producao()
