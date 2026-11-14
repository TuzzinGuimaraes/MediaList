"""
Atualizações de mídia e as Notificações que as entregam aos Usuários.

Publicar uma Atualização grava, na mesma transação, a Notificação de cada
Usuário que tem a Mídia na Lista pessoal num Rótulo ativo ou como favorita.
"""
from __future__ import annotations

import json
from typing import Any

from banco import consultar, executar, transacao

#: Rótulos de estado de quem recebe a Notificação, por Tipo de mídia.
ROTULOS_NOTIFICADOS = {
    'anime': ('assistindo', 'planejado'),
    'manga': ('lendo', 'planejado'),
    'jogo': ('jogando', 'na_fila', 'planejado'),
}


class Atualizacoes:
    def recentes(self, id_midia: str) -> list[dict[str, Any]]:
        """As 10 Atualizações mais recentes da Mídia."""
        return consultar(
            """
            SELECT a.id_midia, t.nome_tipo AS tipo_midia, a.tipo_atualizacao, a.titulo,
                   a.descricao, a.dados_adicionais, a.data_atualizacao
            FROM atualizacoes_midia a
            JOIN midias m ON m.id_midia = a.id_midia
            JOIN tipo_midia t ON t.id_tipo = m.id_tipo
            WHERE a.id_midia = %s
            ORDER BY a.data_atualizacao DESC, a.id_atualizacao DESC
            LIMIT 10
            """,
            (id_midia,),
        )

    def publicar(
        self, id_midia: str, tipo_midia: str, tipo: str, titulo: str,
        descricao: str | None = None, dados_adicionais: dict | None = None,
    ) -> int:
        """Grava a Atualização e as Notificações; devolve quantas Notificações saíram."""
        rotulos = sorted(ROTULOS_NOTIFICADOS.get(tipo_midia, ('planejado',)))
        with transacao() as t:
            atualizacao = t.consultar_um(
                """
                INSERT INTO atualizacoes_midia (id_midia, tipo_atualizacao, titulo, descricao, dados_adicionais)
                VALUES (%s, %s, %s, %s, %s::jsonb)
                RETURNING id_atualizacao
                """,
                (id_midia, tipo, titulo, descricao, json.dumps(dados_adicionais or {})),
            )
            return t.executar(
                """
                INSERT INTO notificacoes (id_usuario, id_atualizacao)
                SELECT id_usuario, %s
                FROM lista_usuarios
                WHERE id_midia = %s AND (status_consumo = ANY(%s) OR favorito)
                """,
                (atualizacao['id_atualizacao'], id_midia, rotulos),
            )

    def notificacoes(self, id_usuario: str, apenas_nao_lidas: bool = False) -> list[dict[str, Any]]:
        """As 50 Notificações mais recentes do Usuário.

        Título, tipo e Mídia vêm da Atualização que a Notificação entrega.
        """
        return consultar(
            """
            SELECT a.id_midia, t.nome_tipo AS tipo_midia,
                   a.tipo_atualizacao AS tipo, a.titulo,
                   COALESCE(NULLIF(m.titulo_portugues, ''), m.titulo_original) AS midia_nome,
                   'Novidade em ' || t.nome_tipo || ' da sua lista: '
                       || COALESCE(NULLIF(m.titulo_portugues, ''), m.titulo_original) AS mensagem,
                   n.lida, n.data_criacao
            FROM notificacoes n
            JOIN atualizacoes_midia a ON a.id_atualizacao = n.id_atualizacao
            JOIN midias m ON m.id_midia = a.id_midia
            JOIN tipo_midia t ON t.id_tipo = m.id_tipo
            WHERE n.id_usuario = %s AND (NOT %s OR NOT n.lida)
            ORDER BY n.data_criacao DESC, n.id_notificacao DESC
            LIMIT 50
            """,
            (id_usuario, apenas_nao_lidas),
        )

    def marcar_todas_lidas(self, id_usuario: str) -> int:
        """Marca as Notificações não lidas do Usuário; devolve quantas eram."""
        return executar('UPDATE notificacoes SET lida = true WHERE id_usuario = %s AND NOT lida', (id_usuario,))
