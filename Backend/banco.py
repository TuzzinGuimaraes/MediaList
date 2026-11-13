"""Acesso ao PostgreSQL: pool, consultas e transações (ADR-0007, ticket 10).

Interface:

- `consultar(sql, params)` -> lista de dicts;
- `consultar_um(sql, params)` -> dict ou None;
- `executar(sql, params)` -> linhas afetadas;
- `transacao()` -> context manager com os mesmos três métodos, que confirma no
  fim e desfaz em qualquer exceção.

Fora de uma `transacao()`, cada chamada é a sua própria transação.

Erros do banco viram exceções tipadas que o errorhandler do app traduz:
`Conflito` (UNIQUE) -> 409, `Integridade` (FK, CHECK, NOT NULL e valor fora do
tipo, como um uuid malformado) -> 400, `Indisponivel` (sem conexão) -> 503. O
resto (SQL errado, permissão) propaga como está e vira 500.

O pool abre na primeira consulta, nunca no import: `import app` não conecta em
nada. UUIDs voltam como texto, que é como a API e o JWT os tratam.
"""
from __future__ import annotations

import logging
import threading
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

import psycopg
from psycopg import errors
from psycopg.rows import dict_row
from psycopg.types.string import TextLoader
from psycopg_pool import ConnectionPool, PoolTimeout

from config import DB_POOL_MAX, DB_POOL_MIN, DB_POOL_TIMEOUT, database_url

logger = logging.getLogger(__name__)

Params = Sequence[Any] | dict[str, Any] | None


class ErroDeBanco(Exception):
    """Base das exceções tipadas do módulo."""

    def __init__(self, mensagem: str, restricao: str | None = None):
        super().__init__(mensagem)
        #: Nome da constraint violada, quando o PostgreSQL informa.
        self.restricao = restricao


class Conflito(ErroDeBanco):
    """Violação de UNIQUE: o registro já existe."""


class Integridade(ErroDeBanco):
    """FK, CHECK, NOT NULL ou valor que não cabe no tipo da coluna."""


class Indisponivel(ErroDeBanco):
    """Sem conexão com o banco (fora do ar, recusada ou pool esgotado)."""


_INTEGRIDADE = (
    errors.ForeignKeyViolation,
    errors.CheckViolation,
    errors.NotNullViolation,
    errors.ExclusionViolation,
    psycopg.DataError,  # classe 22: uuid malformado, número fora da escala, data inválida
)

_pool: ConnectionPool | None = None
_trava = threading.Lock()


def _configurar_conexao(conn: psycopg.Connection) -> None:
    conn.adapters.register_loader('uuid', TextLoader)


def _obter_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        with _trava:
            if _pool is None:
                pool = ConnectionPool(
                    database_url(),
                    min_size=DB_POOL_MIN,
                    max_size=DB_POOL_MAX,
                    timeout=DB_POOL_TIMEOUT,
                    kwargs={'row_factory': dict_row, 'connect_timeout': DB_POOL_TIMEOUT},
                    configure=_configurar_conexao,
                    check=ConnectionPool.check_connection,
                    open=False,
                    name='medialist',
                )
                pool.open(wait=False)
                _pool = pool
    return _pool


def pool_aberto() -> bool:
    return _pool is not None


def fechar() -> None:
    """Fecha o pool; a próxima consulta abre outro. Usado em testes e no shutdown."""
    global _pool
    with _trava:
        if _pool is not None:
            _pool.close()
            _pool = None


@contextmanager
def _traduzir_erros() -> Iterator[None]:
    try:
        yield
    except errors.UniqueViolation as exc:
        raise Conflito('Registro já existe', exc.diag.constraint_name) from exc
    except _INTEGRIDADE as exc:
        raise Integridade('Dados inválidos', exc.diag.constraint_name) from exc
    except (psycopg.OperationalError, PoolTimeout) as exc:
        logger.warning('Banco indisponível: %s', exc)
        raise Indisponivel('Banco indisponível') from exc


class Transacao:
    """Executor ligado a uma conexão; os mesmos métodos do módulo."""

    def __init__(self, conn: psycopg.Connection):
        self._conn = conn

    def consultar(self, sql: str, params: Params = None) -> list[dict[str, Any]]:
        with _traduzir_erros():
            return self._conn.execute(sql, params).fetchall()

    def consultar_um(self, sql: str, params: Params = None) -> dict[str, Any] | None:
        with _traduzir_erros():
            return self._conn.execute(sql, params).fetchone()

    def executar(self, sql: str, params: Params = None) -> int:
        with _traduzir_erros():
            return self._conn.execute(sql, params).rowcount


@contextmanager
def transacao() -> Iterator[Transacao]:
    """Uma conexão do pool numa transação: commit no fim, rollback em exceção."""
    with _traduzir_erros(), _obter_pool().connection() as conn, conn.transaction():
        yield Transacao(conn)


def consultar(sql: str, params: Params = None) -> list[dict[str, Any]]:
    with transacao() as t:
        return t.consultar(sql, params)


def consultar_um(sql: str, params: Params = None) -> dict[str, Any] | None:
    with transacao() as t:
        return t.consultar_um(sql, params)


def executar(sql: str, params: Params = None) -> int:
    with transacao() as t:
        return t.executar(sql, params)
