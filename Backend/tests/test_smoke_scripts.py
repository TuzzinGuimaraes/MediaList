import decorators
import smoke_permissions
import smoke_postgres
from decorators import get_user_permissions

from .helpers import FakeBanco


def test_postgres_smoke_report(monkeypatch):
    respostas = {
        'simple_query': {'test': 1},
        'tables': {'total': 21},
        'groups': {'total': 0},
        'users': {'total': 0},
        'migration': {'version_num': '0003_dados_iniciais'},
        'create': {'pode': False},
    }
    por_sql = {smoke_postgres.CONSULTAS[chave]: valor for chave, valor in respostas.items()}

    class FakeCursor:
        def __init__(self, row):
            self.row = row

        def fetchone(self):
            return self.row

    class FakeConnection:
        def execute(self, query):
            return FakeCursor(por_sql[query])

        def __enter__(self):
            return self

        def __exit__(self, *_exc):
            return False

    monkeypatch.setattr(smoke_postgres, '_conectar', lambda: FakeConnection())

    report = smoke_postgres.run_checks()

    assert report['connection_ok'] is True
    assert report['simple_query_ok'] is True
    assert report['tables_ok'] is True
    assert report['groups_ok'] is False
    assert report['users_table_ok'] is True
    assert report['migrated_ok'] is True
    assert report['no_ddl_ok'] is True


def test_postgres_smoke_sem_conexao(monkeypatch):
    def falha():
        raise smoke_postgres.psycopg.OperationalError('recusada')

    monkeypatch.setattr(smoke_postgres, '_conectar', falha)

    report = smoke_postgres.run_checks()

    assert report['connection_ok'] is False
    assert smoke_postgres.main() == 1


def test_permissions_smoke_report(monkeypatch):
    FakeBanco({'FROM usuarios LIMIT 5': [
        {'id_usuario': 'USR-1', 'nome_completo': 'User 1', 'email': 'u1@example.com'},
    ]}).instalar(monkeypatch, smoke_permissions)
    # O usuário inexistente passa pela função real, com o banco sem linha nenhuma.
    FakeBanco().instalar(monkeypatch, decorators)
    monkeypatch.setattr(smoke_permissions, 'get_user_permissions', lambda user_id: (
        {
            'nivel_acesso': 'usuario',
            'grupos': 'Usuários',
            'pode_criar': 1,
            'pode_editar': 1,
        }
        if user_id != smoke_permissions.USUARIO_INEXISTENTE
        else get_user_permissions(user_id)
    ))

    report = smoke_permissions.run_checks()

    assert report['usuarios_consultados'] == 1
    assert report['usuarios_validos'] == 1
    assert report['fallback_ok'] is True
