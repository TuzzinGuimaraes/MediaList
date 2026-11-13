"""
Configuração dos scripts de importação.

Reexporta o config do Backend (fonte única de env e defaults) com os nomes
que os importadores já usam. O banco vem do módulo `banco` (DB_* do config).
"""
from config import ANILIST_API_URL, RAWG_API_KEY, RAWG_API_URL

ANILIST_URL = ANILIST_API_URL
RAWG_BASE_URL = RAWG_API_URL

__all__ = ['ANILIST_URL', 'RAWG_API_KEY', 'RAWG_BASE_URL']
