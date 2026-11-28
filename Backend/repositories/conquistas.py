"""Conquistas do Item para o Detalhe do jogo (`GET /lista/<id_lista>/conquistas`), só leitura.

Quem escreve as conquistas é a sincronização da Steam (`integracoes.conquistas`); a ordem e a oculta
sem spoiler são de `dominio.conquistas.lista_do_detalhe`.
"""
from __future__ import annotations

from typing import Any

import banco


def do_item_do_usuario(id_usuario: str, id_lista: str) -> list[dict[str, Any]] | None:
    """As conquistas do jogo do Item, pelo esquema guardado, com `obtida`, `obtida_em` e `destacada`;
    None se o Item não é do Usuário. O Item sem leitura, ou de jogo sem conquistas, dá a lista vazia."""
    if not banco.consultar_um('SELECT 1 FROM lista_usuarios WHERE id_lista = %s AND id_usuario = %s',
                              (id_lista, id_usuario)):
        return None
    return banco.consultar(
        """
        SELECT c.steam_appid, c.codigo, c.nome, c.descricao, c.icone, c.icone_cinza, c.oculta, c.raridade,
               co.obtida_em, (co.codigo IS NOT NULL) AS obtida, (cd.codigo IS NOT NULL) AS destacada
        FROM conquistas_itens ci
        JOIN conquistas c ON c.steam_appid = ci.steam_appid
        LEFT JOIN conquistas_obtidas co ON co.id_lista = ci.id_lista AND co.codigo = c.codigo
        LEFT JOIN conquistas_destaques cd ON cd.id_lista = co.id_lista AND cd.codigo = co.codigo
        WHERE ci.id_lista = %s
        """,
        (id_lista,),
    )
