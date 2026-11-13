"""
Repositório da tabela `refresh_tokens` (ADR-0006).

Só o hash SHA-256 do token chega aqui; o texto em claro vive apenas na resposta
ao cliente. Ids e família são uuid; datas são timestamptz (datetime com fuso).

Leitura e rotação distinguem ausência de falha: `None` quer dizer "não existe"
ou "já foi rotacionado"; banco fora do ar levanta `banco.Indisponivel` (e
qualquer outro erro propaga). A rota só revoga família no primeiro caso.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from banco import Indisponivel, consultar_um, executar, transacao

logger = logging.getLogger(__name__)

_INSERIR = """
    INSERT INTO refresh_tokens (token_hash, id_usuario, familia, expira_em)
    VALUES (%s, %s, %s, %s)
    RETURNING id_refresh
"""


class RefreshTokenRepository:
    def criar(self, id_usuario: str, familia: str, token_hash: str, expira_em: datetime) -> str | None:
        """Devolve o id criado, ou None com o banco fora: o login segue sem refresh (ADR-0006)."""
        try:
            return consultar_um(_INSERIR, (token_hash, id_usuario, familia, expira_em))['id_refresh']
        except Indisponivel:
            logger.warning('Refresh token não emitido: banco indisponível')
            return None

    def buscar_por_hash(self, token_hash: str) -> dict[str, Any] | None:
        """Devolve a linha, ou None se o hash não existe. Falha de banco levanta."""
        return consultar_um(
            """
            SELECT rt.id_refresh, rt.id_usuario, rt.familia, rt.expira_em,
                   rt.revogado, rt.substituido_por, u.ativo AS usuario_ativo
            FROM refresh_tokens rt
            JOIN usuarios u ON u.id_usuario = rt.id_usuario
            WHERE rt.token_hash = %s
            """,
            (token_hash,),
        )

    def rotacionar(self, id_refresh: str, novo_hash: str, expira_em: datetime) -> str | None:
        """Revoga o token atual e cria o sucessor na mesma família, numa transação.

        Devolve o id do sucessor, ou None se o atual já estava revogado: duas
        renovações concorrentes com o mesmo token não geram dois sucessores, a
        segunda perde a corrida e é tratada como reuso. Falha de banco levanta.
        """
        with transacao() as t:
            atual = t.consultar_um(
                """
                SELECT id_usuario, familia FROM refresh_tokens
                WHERE id_refresh = %s AND revogado = FALSE
                FOR UPDATE
                """,
                (id_refresh,),
            )
            if not atual:
                return None

            novo_id = t.consultar_um(
                _INSERIR, (novo_hash, atual['id_usuario'], atual['familia'], expira_em)
            )['id_refresh']
            t.executar(
                "UPDATE refresh_tokens SET revogado = TRUE, substituido_por = %s WHERE id_refresh = %s",
                (novo_id, id_refresh),
            )
            return novo_id

    def revogar_familia(self, familia: str) -> None:
        executar(
            "UPDATE refresh_tokens SET revogado = TRUE WHERE familia = %s AND revogado = FALSE",
            (familia,),
        )

    def revogar(self, token_hash: str, id_usuario: str) -> bool:
        """Revoga o token se ele for do usuário; token de terceiro não é tocado."""
        return executar(
            "UPDATE refresh_tokens SET revogado = TRUE WHERE token_hash = %s AND id_usuario = %s",
            (token_hash, id_usuario),
        ) > 0
