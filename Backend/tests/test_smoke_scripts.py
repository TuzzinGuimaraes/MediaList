import smoke_mongo
import smoke_permissions
import smoke_postgres
from decorators import get_user_permissions


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


def test_mongo_smoke_report(monkeypatch):
    class FakeCollection:
        def __init__(self):
            self.inserted = []
            self.deleted = []

        def insert_one(self, item):
            self.inserted.append(item)

        def delete_one(self, item):
            self.deleted.append(item)

    class FakeDatabase(dict):
        def __getitem__(self, key):
            if key not in self:
                self[key] = FakeCollection()
            return dict.__getitem__(self, key)

    class FakeMongoClient:
        def __init__(self, *_args, **_kwargs):
            self.databases = {'medialist_updates_db': FakeDatabase()}

        def server_info(self):
            return {'ok': 1}

        def list_database_names(self):
            return list(self.databases.keys())

        def __getitem__(self, key):
            return self.databases.setdefault(key, FakeDatabase())

    monkeypatch.setattr(smoke_mongo, 'MongoClient', FakeMongoClient)

    report = smoke_mongo.run_checks()

    assert report == {
        'server_ok': True,
        'insert_ok': True,
        'cleanup_ok': True,
        'database_names': ['medialist_updates_db'],
    }


def test_permissions_smoke_report(monkeypatch):
    monkeypatch.setattr(smoke_permissions, 'execute_query', lambda *_args, **_kwargs: [
        {'id_usuario': 'USR-1', 'nome_completo': 'User 1', 'email': 'u1@example.com'},
    ])
    monkeypatch.setattr(smoke_permissions, 'get_user_permissions', lambda user_id: (
        {
            'nivel_acesso': 'usuario',
            'grupos': 'Usuários',
            'pode_criar': 1,
            'pode_editar': 1,
        }
        if user_id != 'USR-FAKE-00000'
        else get_user_permissions('USR-FAKE-00000')
    ))

    report = smoke_permissions.run_checks()

    assert report['usuarios_consultados'] == 1
    assert report['usuarios_validos'] == 1
    assert report['fallback_ok'] is True
