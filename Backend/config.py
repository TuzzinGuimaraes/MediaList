"""
Configurações centrais da aplicação.
"""
import os
from datetime import timedelta

from dotenv import load_dotenv

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
