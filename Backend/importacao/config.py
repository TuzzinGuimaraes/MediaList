"""
Configuração dos scripts de importação.

Reexporta o config do Backend (fonte única de env e defaults) com os nomes
que os importadores e `importacao/db.py` já usam.
"""
from config import ANILIST_API_URL, MYSQL_CONFIG, RAWG_API_KEY, RAWG_API_URL

DB_HOST = MYSQL_CONFIG['host']
DB_PORT = MYSQL_CONFIG['port']
DB_NAME = MYSQL_CONFIG['database']
DB_USER = MYSQL_CONFIG['user']
DB_PASSWORD = MYSQL_CONFIG['password']

ANILIST_URL = ANILIST_API_URL
RAWG_BASE_URL = RAWG_API_URL

__all__ = [
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
    'ANILIST_URL', 'RAWG_API_KEY', 'RAWG_BASE_URL',
]
