import uuid
from contextlib import contextmanager

from repositories.midia_repository import ListaRepository

INTERFACE_BANCO = ('consultar', 'consultar_um', 'executar', 'transacao')


class FakeBanco:
    """A interface do módulo `banco` em memória, para os testes de rota.

    `respostas` mapeia um trecho do SQL para o que a chamada devolve: o valor,
    uma função `(sql, params) -> valor` ou uma exceção, que é levantada. Vence o
    primeiro trecho contido no SQL. Sem resposta, `consultar` devolve [],
    `consultar_um` None e `executar` 1.
    """

    def __init__(self, respostas=None):
        self.respostas = dict(respostas or {})
        #: (método, sql, params) na ordem em que chegaram.
        self.chamadas = []
        self.transacoes = 0

    def _responder(self, metodo, sql, params):
        self.chamadas.append((metodo, sql, params))
        for trecho, valor in self.respostas.items():
            if trecho in sql:
                if isinstance(valor, BaseException):
                    raise valor
                return valor(sql, params) if callable(valor) else valor
        return None

    def consultar(self, sql, params=None):
        resposta = self._responder('consultar', sql, params)
        if resposta is None:
            return []
        return list(resposta) if isinstance(resposta, list) else [resposta]

    def consultar_um(self, sql, params=None):
        resposta = self._responder('consultar_um', sql, params)
        if isinstance(resposta, list):
            return resposta[0] if resposta else None
        return resposta

    def executar(self, sql, params=None):
        resposta = self._responder('executar', sql, params)
        return 1 if resposta is None else resposta

    @contextmanager
    def transacao(self):
        self.transacoes += 1
        yield self

    def sql(self, trecho):
        """As chamadas cujo SQL contém o trecho, como (método, sql, params)."""
        return [chamada for chamada in self.chamadas if trecho in chamada[1]]

    def instalar(self, monkeypatch, *modulos):
        """Troca, em cada módulo, os nomes da interface que ele importou."""
        for modulo in modulos:
            for nome in INTERFACE_BANCO:
                if hasattr(modulo, nome):
                    monkeypatch.setattr(modulo, nome, getattr(self, nome))
        return self


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



class FakeRefreshTokenRepository:
    """Tabela `refresh_tokens` em memória, na costura de `RefreshTokenRepository`.

    Guarda o que o banco guardaria: só o hash do token, nunca o texto em claro.
    `usuarios_ativos` faz o papel do JOIN com `usuarios.ativo`.
    """

    def __init__(self, usuarios_ativos=None):
        #: id_refresh -> linha de refresh_tokens.
        self.tokens = {}
        self.usuarios_ativos = dict(usuarios_ativos or {})
        self._sequencia = 0
        #: Métodos que levantam banco.Indisponivel, como banco fora do ar.
        self.indisponivel = set()
        #: Quando True, `rotacionar` perde a corrida para outra requisição.
        self.perder_corrida = False

    def _checar(self, metodo):
        if metodo in self.indisponivel:
            from banco import Indisponivel
            raise Indisponivel(f'{metodo}: banco indisponível')

    def _proximo_id(self):
        self._sequencia += 1
        return str(uuid.UUID(int=self._sequencia))

    def criar(self, id_usuario, familia, token_hash, expira_em):
        id_refresh = self._proximo_id()
        self.tokens[id_refresh] = {
            'id_refresh': id_refresh,
            'token_hash': token_hash,
            'id_usuario': id_usuario,
            'familia': familia,
            'expira_em': expira_em,
            'revogado': False,
            'substituido_por': None,
        }
        return id_refresh

    def buscar_por_hash(self, token_hash):
        self._checar('buscar_por_hash')
        for linha in self.tokens.values():
            if linha['token_hash'] == token_hash:
                return {
                    **linha,
                    'usuario_ativo': self.usuarios_ativos.get(linha['id_usuario'], True),
                }
        return None

    def rotacionar(self, id_refresh, novo_hash, expira_em):
        self._checar('rotacionar')
        atual = self.tokens.get(id_refresh)
        if not atual or atual['revogado'] or self.perder_corrida:
            return None

        novo_id = self.criar(atual['id_usuario'], atual['familia'], novo_hash, expira_em)
        atual['revogado'] = True
        atual['substituido_por'] = novo_id
        return novo_id

    def revogar_familia(self, familia):
        for linha in self.tokens.values():
            if linha['familia'] == familia:
                linha['revogado'] = True

    def revogar(self, token_hash, id_usuario):
        for linha in self.tokens.values():
            if linha['token_hash'] == token_hash and linha['id_usuario'] == id_usuario:
                linha['revogado'] = True
                return True
        return False
