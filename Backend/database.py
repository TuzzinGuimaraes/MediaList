"""
MongoDB (Notícias, Atualizações de mídia, Notificações e preferências).

O PostgreSQL está no módulo `banco`. O Mongo sai no ticket 12; até lá, a
conexão é tentada uma vez, no primeiro request (`garantir_mongodb`), e não no
import. Sem Mongo, as rotas dele degradam como antes.
"""
import logging
import threading

from pymongo import MongoClient

from config import MONGO_DB_NAME, MONGO_URI

logger = logging.getLogger(__name__)

# Variáveis globais para MongoDB
mongo_db = None
noticias_collection = None
atualizacoes_collection = None
notificacoes_collection = None
preferencias_collection = None

#: True depois da primeira tentativa de conexão, com ou sem sucesso.
mongo_tentado = False
_trava = threading.Lock()


def init_mongodb():
    """Inicializar MongoDB."""
    global mongo_db, noticias_collection, atualizacoes_collection, notificacoes_collection, preferencias_collection

    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        mongo_client.server_info()
        mongo_db = mongo_client[MONGO_DB_NAME]

        noticias_collection = mongo_db['noticias']
        atualizacoes_collection = mongo_db['atualizacoes_midias']
        notificacoes_collection = mongo_db['notificacoes_usuarios']
        preferencias_collection = mongo_db['preferencias_usuarios']

        logger.info('MongoDB conectado')
        return True
    except Exception as exc:
        logger.warning('MongoDB não conectado (notícias, notificações e preferências desabilitadas): %s', exc)
        mongo_db = None
        noticias_collection = None
        atualizacoes_collection = None
        notificacoes_collection = None
        preferencias_collection = None
        return False


def garantir_mongodb():
    """Tenta conectar uma única vez por processo."""
    global mongo_tentado
    if mongo_tentado:
        return
    with _trava:
        if not mongo_tentado:
            init_mongodb()
            mongo_tentado = True
