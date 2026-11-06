"""
Repositório da tabela `refresh_tokens` (ADR-0006).

Só o hash SHA-256 do token chega aqui; o texto em claro vive apenas na resposta
ao cliente. Datas são UTC sem fuso, como o MySQL as devolve.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from database import get_db_connection


def _novo_id() -> str:
    return f'RFT-{uuid.uuid4().hex}'


class RefreshTokenRepository:
    def criar(self, id_usuario: str, familia: str, token_hash: str, expira_em: datetime) -> str | None:
        connection = get_db_connection()
        if not connection:
            return None

        cursor = None
        try:
            id_refresh = _novo_id()
            cursor = connection.cursor(dictionary=True)
            cursor.execute(
                """
                INSERT INTO refresh_tokens (id_refresh, token_hash, id_usuario, familia, criado_em, expira_em)
                VALUES (%s, %s, %s, %s, UTC_TIMESTAMP(), %s)
                """,
                (id_refresh, token_hash, id_usuario, familia, expira_em),
            )
            connection.commit()
            return id_refresh
        except Exception as exc:
            connection.rollback()
            print(f"Erro ao criar refresh token: {exc}")
            return None
        finally:
            if cursor:
                cursor.close()
            connection.close()

    def buscar_por_hash(self, token_hash: str) -> dict[str, Any] | None:
        connection = get_db_connection()
        if not connection:
            return None

        cursor = None
        try:
            cursor = connection.cursor(dictionary=True)
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
        finally:
            if cursor:
                cursor.close()
            connection.close()

    def rotacionar(self, id_refresh: str, novo_hash: str, expira_em: datetime) -> str | None:
        """Revoga o token atual e cria o sucessor na mesma família, numa transação.

        Devolve o id do sucessor, ou None se o atual já estava revogado: duas
        renovações concorrentes com o mesmo token não geram dois sucessores, a
        segunda perde a corrida e é tratada como reuso.
        """
        connection = get_db_connection()
        if not connection:
            return None

        cursor = None
        try:
            cursor = connection.cursor(dictionary=True)
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
            cursor.execute(
                """
                INSERT INTO refresh_tokens (id_refresh, token_hash, id_usuario, familia, criado_em, expira_em)
                VALUES (%s, %s, %s, %s, UTC_TIMESTAMP(), %s)
                """,
                (novo_id, novo_hash, atual['id_usuario'], atual['familia'], expira_em),
            )
            cursor.execute(
                "UPDATE refresh_tokens SET revogado = TRUE, substituido_por = %s WHERE id_refresh = %s",
                (novo_id, id_refresh),
            )
            connection.commit()
            return novo_id
        except Exception as exc:
            connection.rollback()
            print(f"Erro ao rotacionar refresh token: {exc}")
            return None
        finally:
            if cursor:
                cursor.close()
            connection.close()

    def revogar_familia(self, familia: str) -> None:
        self._executar(
            "UPDATE refresh_tokens SET revogado = TRUE WHERE familia = %s AND revogado = FALSE",
            (familia,),
        )

    def revogar(self, token_hash: str, id_usuario: str) -> bool:
        """Revoga o token se ele for do usuário; token de terceiro não é tocado."""
        return self._executar(
            "UPDATE refresh_tokens SET revogado = TRUE WHERE token_hash = %s AND id_usuario = %s",
            (token_hash, id_usuario),
        ) > 0

    def _executar(self, query: str, params: tuple[Any, ...]) -> int:
        connection = get_db_connection()
        if not connection:
            return 0

        cursor = None
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(query, params)
            connection.commit()
            return cursor.rowcount
        except Exception as exc:
            connection.rollback()
            print(f"Erro ao revogar refresh token: {exc}")
            return 0
        finally:
            if cursor:
                cursor.close()
            connection.close()
