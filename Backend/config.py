"""
Configurações centrais da aplicação.
"""
import os
import sys
from datetime import timedelta

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

# Configuração JWT
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'sua-chave-secreta-super-segura')
JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=int(os.getenv('JWT_ACCESS_TOKEN_DAYS', '1')))

# Configuração MySQL
MYSQL_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '3308')),
    'user': os.getenv('DB_USER', 'media_app_user'),
    'password': os.getenv('DB_PASSWORD', 'MediaList@2025!Secure'),
    'database': os.getenv('DB_NAME', 'medialist_db'),
    'charset': 'utf8mb4',
    'use_unicode': True,
}

# Configuração MongoDB
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://admin:senha123@localhost:27017/')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'medialist_updates_db')

# Configurações das APIs de importação
ANILIST_API_URL = os.getenv('ANILIST_API_URL', 'https://graphql.anilist.co')
RAWG_API_KEY = os.getenv('RAWG_API_KEY', '')
RAWG_API_URL = os.getenv('RAWG_API_URL', 'https://api.rawg.io/api')

# Token Blocklist
token_blocklist = set()
