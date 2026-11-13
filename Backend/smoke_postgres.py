"""Smoke test do PostgreSQL: conexão do usuário da aplicação e schema migrado."""
from __future__ import annotations

import sys

import psycopg
from psycopg.rows import dict_row

from config import database_url

CONSULTAS = {
    'simple_query': 'SELECT 1 AS test',
    'tables': "SELECT count(*) AS total FROM information_schema.tables WHERE table_schema = 'public'",
    'groups': 'SELECT count(*) AS total FROM grupos_usuarios',
    'users': 'SELECT count(*) AS total FROM usuarios',
    'migration': 'SELECT version_num FROM alembic_version',
    'create': "SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS pode",
}


def _conectar():
    return psycopg.connect(database_url(), row_factory=dict_row, connect_timeout=5)


def run_checks() -> dict:
    """Executa validacoes deterministicas de conectividade, schema e grants."""
    report = {
        'connection_ok': False,
        'simple_query_ok': False,
        'tables_ok': False,
        'groups_ok': False,
        'users_table_ok': False,
        'migrated_ok': False,
        'no_ddl_ok': False,
        'table_count': 0,
        'group_count': 0,
        'user_count': None,
        'migration': None,
    }

    try:
        conn = _conectar()
    except psycopg.Error as exc:
        print(f'Sem conexão com o PostgreSQL: {exc}')
        return report

    with conn:
        report['connection_ok'] = True

        def um(chave):
            return conn.execute(CONSULTAS[chave]).fetchone()

        report['simple_query_ok'] = um('simple_query')['test'] == 1
        report['table_count'] = um('tables')['total']
        report['tables_ok'] = report['table_count'] > 0
        report['group_count'] = um('groups')['total']
        report['groups_ok'] = report['group_count'] >= 3
        report['user_count'] = um('users')['total']
        report['users_table_ok'] = True
        migracao = um('migration')
        report['migration'] = migracao['version_num'] if migracao else None
        report['migrated_ok'] = report['migration'] is not None
        report['no_ddl_ok'] = um('create')['pode'] is False

    return report


def main() -> int:
    report = run_checks()

    print('=' * 60)
    print('TESTANDO CONEXAO COM POSTGRESQL')
    print('=' * 60)
    for chave, valor in report.items():
        print(f'{chave}={valor}')
    print('=' * 60)

    required_flags = [
        report['connection_ok'],
        report['simple_query_ok'],
        report['tables_ok'],
        report['groups_ok'],
        report['users_table_ok'],
        report['migrated_ok'],
        report['no_ddl_ok'],
    ]
    return 0 if all(required_flags) else 1


if __name__ == '__main__':
    sys.exit(main())
