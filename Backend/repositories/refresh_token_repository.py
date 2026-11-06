"""
Repositório da tabela `refresh_tokens` (ADR-0006).

Só o hash SHA-256 do token chega aqui; o texto em claro vive apenas na resposta
ao cliente. Datas são UTC sem fuso, como o MySQL as devolve.

Leitura e rotação distinguem ausência de falha: `None` quer dizer "não existe"
ou "já foi rotacionado"; banco fora do ar ou query quebrada levanta
`RefreshTokenIndisponivel`. A rota só revoga família no primeiro caso.
"""
from __future__ import annotations

import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterator

from database import get_db_connection


class RefreshTokenIndisponivel(Exception):
    """O banco não respondeu: nada se sabe sobre o token, nada deve ser revogado."""


def _novo_id() -> str:
    return f'RFT-{uuid.uuid4().hex}'


@contextmanager
def _transacao(operacao: str) -> Iterator[tuple[Any, Any]]:
    """Abre conexão e cursor, desfaz em erro e fecha tudo no fim.

    Qualquer falha vira `RefreshTokenIndisponivel`, com a operação no log.
    """
    connection = get_db_connection()
    if not connection:
        raise RefreshTokenIndisponivel(f'{operacao}: sem conexão com o banco')

    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        yield connection, cursor
    except Exception as exc:
        connection.rollback()
        print(f"Erro ao {operacao}: {exc}")
        raise RefreshTokenIndisponivel(f'{operacao}: {exc}') from exc
    finally:
        if cursor:
            cursor.close()
        connection.close()


def _inserir(cursor: Any, id_refresh: str, token_hash: str, id_usuario: str,
             familia: str, expira_em: datetime) -> None:
    cursor.execute(
        """
        INSERT INTO refresh_tokens (id_refresh, token_hash, id_usuario, familia, criado_em, expira_em)
        VALUES (%s, %s, %s, %s, UTC_TIMESTAMP(), %s)
        """,
        (id_refresh, token_hash, id_usuario, familia, expira_em),
    )


class RefreshTokenRepository:
    def criar(self, id_usuario: str, familia: str, token_hash: str, expira_em: datetime) -> str | None:
        """Devolve o id criado, ou None em falha: o login segue sem refresh (ADR-0006)."""
        try:
            with _transacao('criar refresh token') as (connection, cursor):
                id_refresh = _novo_id()
                _inserir(cursor, id_refresh, token_hash, id_usuario, familia, expira_em)
                connection.commit()
                return id_refresh
        except RefreshTokenIndisponivel:
            return None

    def buscar_por_hash(self, token_hash: str) -> dict[str, Any] | None:
        """Devolve a linha, ou None se o hash não existe. Falha de banco levanta."""
        with _transacao('buscar refresh token') as (_connection, cursor):
            cursor.execute(
                """
                SELECT rt.id_refresh, rt.id_usuario, rt.familia, rt.expira_em,
                       rt.revogado, rt.substituido_por, u.ativo AS usuario_ativo
                FROM refresh_tokens rt
                JOIN usuarios u ON u.id_usuario = rt.id_usuario
                WHERE rt.token_hash = %s
                """,
                (token_hash,),
            )
            return cursor.fetchone()

    def rotacionar(self, id_refresh: str, novo_hash: str, expira_em: datetime) -> str | None:
        """Revoga o token atual e cria o sucessor na mesma família, numa transação.

        Devolve o id do sucessor, ou None se o atual já estava revogado: duas
        renovações concorrentes com o mesmo token não geram dois sucessores, a
        segunda perde a corrida e é tratada como reuso. Falha de banco levanta.
        """
        with _transacao('rotacionar refresh token') as (connection, cursor):
            cursor.execute(
                """
                SELECT id_usuario, familia FROM refresh_tokens
                WHERE id_refresh = %s AND revogado = FALSE
                FOR UPDATE
                """,
                (id_refresh,),
            )
            atual = cursor.fetchone()
            if not atual:
                connection.rollback()
                return None

            novo_id = _novo_id()
            _inserir(cursor, novo_id, novo_hash, atual['id_usuario'], atual['familia'], expira_em)
            cursor.execute(
                "UPDATE refresh_tokens SET revogado = TRUE, substituido_por = %s WHERE id_refresh = %s",
                (novo_id, id_refresh),
            )
            connection.commit()
            return novo_id

    def revogar_familia(self, familia: str) -> None:
        self._executar(
            'revogar família de refresh tokens',
            "UPDATE refresh_tokens SET revogado = TRUE WHERE familia = %s AND revogado = FALSE",
            (familia,),
        )

    def revogar(self, token_hash: str, id_usuario: str) -> bool:
        """Revoga o token se ele for do usuário; token de terceiro não é tocado."""
        return self._executar(
            'revogar refresh token',
            "UPDATE refresh_tokens SET revogado = TRUE WHERE token_hash = %s AND id_usuario = %s",
            (token_hash, id_usuario),
        ) > 0

    def _executar(self, operacao: str, query: str, params: tuple[Any, ...]) -> int:
        """Escrita de melhor esforço: devolve as linhas afetadas, 0 em falha (já logada)."""
        try:
            with _transacao(operacao) as (connection, cursor):
                cursor.execute(query, params)
                connection.commit()
                return cursor.rowcount
        except RefreshTokenIndisponivel:
            return 0
