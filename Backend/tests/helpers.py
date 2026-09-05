from repositories.midia_repository import ListaRepository


class FakeCursor:
    def __init__(self, fetchone_results=None, fetchall_results=None):
        self.fetchone_results = list(fetchone_results or [])
        self.fetchall_results = list(fetchall_results or [])
        self.executed = []
        self.rowcount = 1
        self.closed = False

    def execute(self, query, params=()):
        self.executed.append((query, params))

    def fetchone(self):
        if self.fetchone_results:
            return self.fetchone_results.pop(0)
        return None

    def fetchall(self):
        if self.fetchall_results:
            return self.fetchall_results.pop(0)
        return []

    def close(self):
        self.closed = True


class FakeConnection:
    def __init__(self, cursor):
        self._cursor = cursor
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def cursor(self, dictionary=False):
        return self._cursor

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


class FakeMidiaRepository:
    """Catálogo em memória, na forma que `MidiaRepository.buscar_por_id` devolve."""

    def __init__(self, midias=None):
        #: id_midia -> dict com pelo menos `tipo` e `progresso_total_padrao`.
        self.midias = midias if midias is not None else {}

    def buscar_por_id(self, id_midia, expected_type=None):
        midia = self.midias.get(id_midia)
        if not midia:
            return None
        if expected_type and midia.get('tipo') != expected_type:
            return None
        return dict(midia, id_midia=id_midia)


class FakeListaRepository:
    """CRUD de Item de lista em memória, com a unique key (usuário, mídia).

    Espelha a costura de `ListaRepository`: cinco métodos, uma escrita por
    chamada, e o total da Mídia entrando em `obter_item_por_id` pelo catálogo.
    """

    def __init__(self, midias=None, itens=None):
        self.midias = midias if midias is not None else {}
        #: id_lista -> linha de lista_usuarios.
        self.itens = dict(itens or {})
        self.escritas = []
        self._sequencia = len(self.itens)

    def _proximo_id(self):
        self._sequencia += 1
        return f'LST-{self._sequencia}'

    def _colunas(self, campos):
        """Só as colunas que o repositório real sabe gravar, como ele faz."""
        return {
            campo: valor for campo, valor in campos.items()
            if campo in ListaRepository.COLUNAS_GRAVAVEIS
        }

    def criar_item(self, id_usuario, id_midia, campos):
        """Devolve o id do Item criado, ou None se a unique key barrou."""
        if self.obter_item_usuario(id_usuario, id_midia):
            return None

        id_lista = self._proximo_id()
        self.itens[id_lista] = {
            'id_lista': id_lista,
            'id_usuario': id_usuario,
            'id_midia': id_midia,
            'progresso_atual': 0,
            'data_conclusao': None,
            **self._colunas(campos),
        }
        self.escritas.append(('criar_item', id_usuario, id_midia, dict(campos)))
        return id_lista

    def atualizar_campos(self, id_lista, campos):
        item = self.itens.get(id_lista)
        if not item or not campos:
            return False

        item.update(self._colunas(campos))
        self.escritas.append(('atualizar_campos', id_lista, dict(campos)))
        return True

    def obter_item_por_id(self, id_lista):
        item = self.itens.get(id_lista)
        if not item:
            return None

        midia = self.midias.get(item['id_midia'], {})
        return {
            **item,
            'tipo': midia.get('tipo'),
            'progresso_total_padrao': midia.get('progresso_total_padrao'),
        }

    def obter_item_usuario(self, id_usuario, id_midia):
        for item in self.itens.values():
            if item['id_usuario'] == id_usuario and item['id_midia'] == id_midia:
                return dict(item)
        return None

    def remover_item(self, id_lista, id_usuario):
        """Devolve se apagou alguma linha — item de terceiro não é apagado."""
        item = self.itens.get(id_lista)
        if not item or item['id_usuario'] != id_usuario:
            return False

        del self.itens[id_lista]
        self.escritas.append(('remover_item', id_lista, id_usuario))
        return True


class FakeInsertResult:
    def __init__(self, inserted_id='fake-id'):
        self.inserted_id = inserted_id


class FakeUpdateResult:
    def __init__(self, modified_count=0, upserted_id=None):
        self.modified_count = modified_count
        self.upserted_id = upserted_id


class FakeFindResult:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, *_args, **_kwargs):
        return self

    def limit(self, limit):
        return self.items[:limit]


class FakeMongoCollection:
    def __init__(self, items=None):
        self.items = list(items or [])
        self.inserted = []
        self.inserted_many = []
        self.updated = []

    def find(self, filtro=None, projection=None):
        filtro = filtro or {}
        items = [
            item for item in self.items
            if all(item.get(key) == value for key, value in filtro.items())
        ]
        if projection:
            projected = []
            for item in items:
                projected.append({
                    key: value
                    for key, value in item.items()
                    if projection.get(key, 1) != 0
                })
            items = projected
        return FakeFindResult(items)

    def find_one(self, filtro=None, projection=None):
        items = self.find(filtro, projection).limit(1)
        return items[0] if items else None

    def insert_one(self, item):
        self.items.append(item)
        self.inserted.append(item)
        return FakeInsertResult()

    def insert_many(self, items):
        items = list(items)
        self.items.extend(items)
        self.inserted_many.extend(items)

    def update_many(self, filtro, update):
        modified_count = 0
        for item in self.items:
            if all(item.get(key) == value for key, value in filtro.items()):
                item.update(update.get('$set', {}))
                modified_count += 1
        self.updated.append((filtro, update))
        return FakeUpdateResult(modified_count=modified_count)

    def update_one(self, filtro, update, upsert=False):
        existing = self.find_one(filtro)
        if existing:
            existing.update(update.get('$set', {}))
            self.updated.append((filtro, update, upsert))
            return FakeUpdateResult(modified_count=1)

        if upsert:
            novo = {
                **filtro,
                **update.get('$setOnInsert', {}),
                **update.get('$set', {}),
            }
            self.items.append(novo)
            self.updated.append((filtro, update, upsert))
            return FakeUpdateResult(modified_count=0, upserted_id='fake-upsert-id')

        self.updated.append((filtro, update, upsert))
        return FakeUpdateResult(modified_count=0)
