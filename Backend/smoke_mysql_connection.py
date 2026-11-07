"""Script de teste de conexao com MySQL."""
from __future__ import annotations

import sys

from database import execute_query, get_db_connection


def run_checks() -> dict:
    """Executa validacoes deterministicas de conectividade e schema."""
    report = {
        'connection_ok': False,
        'simple_query_ok': False,
        'tables_ok': False,
        'groups_ok': False,
        'users_table_ok': False,
        'table_count': 0,
        'group_count': 0,
        'user_count': None,
    }

    conn = get_db_connection()
    if conn:
        report['connection_ok'] = True
        conn.close()

    simple_query = execute_query("SELECT 1 as test")
    report['simple_query_ok'] = bool(simple_query and simple_query[0].get('test') == 1)

    tables = execute_query("SHOW TABLES") or []
    report['table_count'] = len(tables)
    report['tables_ok'] = report['table_count'] > 0

    grupos = execute_query("SELECT * FROM grupos_usuarios") or []
    report['group_count'] = len(grupos)
    report['groups_ok'] = report['group_count'] >= 3

    usuarios = execute_query("SELECT COUNT(*) as total FROM usuarios") or []
    if usuarios:
        report['user_count'] = usuarios[0]['total']
        report['users_table_ok'] = True

    return report


def main() -> int:
    report = run_checks()

    print("=" * 60)
    print("TESTANDO CONEXAO COM MYSQL")
    print("=" * 60)
    print(f"connection_ok={report['connection_ok']}")
    print(f"simple_query_ok={report['simple_query_ok']}")
    print(f"tables_ok={report['tables_ok']}")
    print(f"groups_ok={report['groups_ok']}")
    print(f"users_table_ok={report['users_table_ok']}")
    print(f"table_count={report['table_count']}")
    print(f"group_count={report['group_count']}")
    print(f"user_count={report['user_count']}")
    print("=" * 60)

    required_flags = [
        report['connection_ok'],
        report['simple_query_ok'],
        report['tables_ok'],
        report['groups_ok'],
        report['users_table_ok'],
    ]
    return 0 if all(required_flags) else 1


if __name__ == '__main__':
    sys.exit(main())

