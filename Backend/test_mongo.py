"""
Script de teste de conexão com MongoDB.
"""
from pymongo import MongoClient

from config import MONGO_DB_NAME, MONGO_URI

try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)

    client.server_info()
    print("✅ Conexão com MongoDB bem-sucedida!")
    print("Databases disponíveis:", client.list_database_names())

    db = client[MONGO_DB_NAME]
    collection = db['test_connection']
    collection.insert_one({'teste': 'funcionou!'})
    print("✅ Inserção de teste bem-sucedida!")

    collection.delete_one({'teste': 'funcionou!'})
    print("✅ Limpeza do teste realizada!")
except Exception as exc:
    print(f"❌ Erro ao conectar: {exc}")
