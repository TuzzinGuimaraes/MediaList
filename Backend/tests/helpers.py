import uuid
from contextlib import contextmanager

from repositories.itens_lista import COLUNAS_GRAVAVEIS

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


class FakeCatalogo:
    """Catálogo em memória, na costura de `Catalogo`; registra as chamadas.

    `midias`: id_midia -> dict com pelo menos `tipo` (e `progresso_total_padrao`
    para a Lista pessoal), na forma que `Catalogo.obter` devolve.
    """

    def __init__(self, midias=None, generos=None, populares=None, distribuicao=None):
        self.midias = midias if midias is not None else {}
        self._generos = list(generos or [])
        self._populares = list(populares or [])
        self._distribuicao = list(distribuicao or [])
        #: (operação, *argumentos) na ordem em que chegaram.
        self.chamadas = []

    def obter(self, id_midia):
        midia = self.midias.get(id_midia)
        return dict(midia, id_midia=id_midia) if midia else None

    def buscar(self, tipo=None, pagina=1, limite=20, filtros=None):
        self.chamadas.append(('buscar', tipo, pagina, limite, filtros))
        midias = [dict(m, id_midia=i) for i, m in self.midias.items() if not tipo or m.get('tipo') == tipo]
        return midias[(pagina - 1) * limite:pagina * limite]

    def contar(self, tipo=None, filtros=None):
        self.chamadas.append(('contar', tipo, filtros))
        return sum(1 for m in self.midias.values() if not tipo or m.get('tipo') == tipo)

    def populares(self, tipo=None):
        self.chamadas.append(('populares', tipo))
        return [m for m in self._populares if not tipo or m.get('tipo') == tipo]

    def generos(self, tipo=None):
        self.chamadas.append(('generos', tipo))
        return [g for g in self._generos if not tipo or tipo in g.get('aplicavel_a', [])]

    def distribuicao(self, id_midia):
        self.chamadas.append(('distribuicao', id_midia))
        return list(self._distribuicao)

    def atualizar(self, id_midia, dados):
        self.chamadas.append(('atualizar', id_midia, dados))
        if id_midia not in self.midias:
            return False
        self.midias[id_midia].update(dados)
        return True

    def apagar(self, id_midia):
        self.chamadas.append(('apagar', id_midia))
        return self.midias.pop(id_midia, None) is not None


class FakeAtualizacoes:
    """Atualizações de mídia e Notificações em memória, na costura de `Atualizacoes`."""

    def __init__(self, recentes=None, notificacoes=None, notificados=0):
        self._recentes = list(recentes or [])
        self._notificacoes = list(notificacoes or [])
        self._notificados = notificados
        self.chamadas = []

    def recentes(self, id_midia):
        self.chamadas.append(('recentes', id_midia))
        return list(self._recentes)

    def publicar(self, id_midia, tipo_midia, tipo, titulo, descricao=None, dados_adicionais=None):
        self.chamadas.append(('publicar', id_midia, tipo_midia, tipo, titulo, descricao, dados_adicionais))
        return self._notificados

    def notificacoes(self, id_usuario, apenas_nao_lidas=False):
        self.chamadas.append(('notificacoes', id_usuario, apenas_nao_lidas))
        return [n for n in self._notificacoes if not apenas_nao_lidas or not n.get('lida')]

    def marcar_todas_lidas(self, id_usuario):
        self.chamadas.append(('marcar_todas_lidas', id_usuario))
        marcadas = [n for n in self._notificacoes if not n.get('lida')]
        for notificacao in marcadas:
            notificacao['lida'] = True
        return len(marcadas)


class FakeItensLista:
    """CRUD de Item de lista em memória, com a unique key (usuário, mídia).

    Espelha a costura de `ItensLista` que o domínio usa: cinco métodos, uma escrita por
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
            if campo in COLUNAS_GRAVAVEIS
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



class FakeAcessoRepository:
    """Costura de `AcessoRepository` em memória: blocklist e quem pode acessar.

    Todo Usuário existe e está ativo, salvo os de `usuarios` (id -> ativo) e os
    de `inexistentes`.
    """

    def __init__(self):
        #: jti -> expira_em, como a tabela access_tokens_revogados.
        self.revogados = {}
        self.usuarios = {}
        self.inexistentes = set()

    def revogar(self, jti, expira_em):
        self.revogados.setdefault(jti, expira_em)

    def revogado(self, jti):
        return jti in self.revogados

    def usuario(self, id_usuario):
        if id_usuario in self.inexistentes:
            return None
        return {'id_usuario': id_usuario, 'ativo': self.usuarios.get(id_usuario, True)}



class FakeAvaliacaoRepository:
    """Tabela `avaliacoes` em memória, na costura de `AvaliacaoRepository`.

    A UNIQUE (usuário, mídia) levanta `banco.Conflito`, como o banco; as notas
    devolvidas são a média das Avaliações da Mídia, como `vw_notas_midia`.
    """

    def __init__(self, avaliacoes=None):
        #: id_avaliacao -> linha de avaliacoes.
        self.avaliacoes = dict(avaliacoes or {})
        self._sequencia = len(self.avaliacoes)

    def _notas(self, id_midia):
        notas = [a['nota'] for a in self.avaliacoes.values() if a['id_midia'] == id_midia]
        if not notas:
            return {'nota_media': None, 'total_avaliacoes': None}
        return {'nota_media': sum(notas) / len(notas), 'total_avaliacoes': len(notas)}

    def listar(self, id_midia):
        return [dict(a) for a in self.avaliacoes.values() if a['id_midia'] == id_midia]

    def criar(self, id_usuario, id_midia, nota, titulo, texto):
        from banco import Conflito

        if any(a['id_usuario'] == id_usuario and a['id_midia'] == id_midia for a in self.avaliacoes.values()):
            raise Conflito('Registro já existe', 'uk_avaliacoes_usuario_midia')
        self._sequencia += 1
        id_avaliacao = f'AVL-{self._sequencia}'
        self.avaliacoes[id_avaliacao] = {
            'id_avaliacao': id_avaliacao, 'id_usuario': id_usuario, 'id_midia': id_midia,
            'nota': nota, 'titulo_avaliacao': titulo, 'texto_avaliacao': texto,
        }
        return {'id_avaliacao': id_avaliacao, **self._notas(id_midia)}

    def obter(self, id_avaliacao):
        linha = self.avaliacoes.get(id_avaliacao)
        return {'id_usuario': linha['id_usuario'], 'id_midia': linha['id_midia']} if linha else None

    def atualizar(self, id_avaliacao, id_midia, campos):
        self.avaliacoes[id_avaliacao].update(campos)
        return self._notas(id_midia)

    def apagar(self, id_avaliacao):
        return self.avaliacoes.pop(id_avaliacao, None) is not None
