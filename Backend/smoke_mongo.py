"""Script de teste de conexao com MongoDB."""
from __future__ import annotations

import sys

from pymongo import MongoClient

from config import MONGO_DB_NAME, MONGO_URI


def run_checks() -> dict:
    """Executa validacoes deterministicas de conectividade com MongoDB."""
    report = {
        'server_ok': False,
        'insert_ok': False,
        'cleanup_ok': False,
        'database_names': [],
    }

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.server_info()
    report['server_ok'] = True
    report['database_names'] = client.list_database_names()

    db = client[MONGO_DB_NAME]
    collection = db['test_connection']
    collection.insert_one({'teste': 'funcionou!'})
    report['insert_ok'] = True
    collection.delete_one({'teste': 'funcionou!'})
    report['cleanup_ok'] = True

    return report


def main() -> int:
    try:
        report = run_checks()
        print("TESTANDO CONEXAO COM MONGODB")
        print(f"server_ok={report['server_ok']}")
        print(f"insert_ok={report['insert_ok']}")
        print(f"cleanup_ok={report['cleanup_ok']}")
        print(f"database_count={len(report['database_names'])}")
        return 0
    except Exception as exc:
        print(f"ERRO_MONGO={exc}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
