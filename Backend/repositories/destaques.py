"""Destaques do Perfil: as conquistas obtidas que o Usuário escolhe mostrar (`conquistas_destaques`).

Só o Usuário escreve aqui; a sincronização da Steam só apaga, pela FK, o destaque da conquista que
deixou de ser obtida. O limite e a ordem são de `dominio.conquistas`: da mais rara para a mais comum
(sem raridade no fim), no empate a obtida mais recente primeiro. A conquista é dita pela appid e
pelo código, entre as obtidas dos Itens do próprio Usuário.
"""
from __future__ import annotations

from typing import Any

import banco
from dominio.conquistas import (
    DESTACADA,
    LIMITE_ATINGIDO,
    LIMITE_DE_DESTAQUES,
    NAO_OBTIDA,
    cabe_mais_um_destaque,
)
from repositories.titulos import titulo_exibido

#: As obtidas dos Itens de todos os Usuários, com o esquema do jogo e a Mídia (o WHERE escolhe o Usuário).
_OBTIDAS = """
    FROM conquistas_obtidas co
    JOIN conquistas_itens ci ON ci.id_lista = co.id_lista
    JOIN lista_usuarios lu ON lu.id_lista = co.id_lista
    JOIN conquistas c ON c.steam_appid = ci.steam_appid AND c.codigo = co.codigo
    JOIN midias m ON m.id_midia = lu.id_midia
"""

_COLUNAS = f"""
    SELECT c.steam_appid, c.codigo, c.nome, COALESCE(c.icone, c.icone_cinza) AS icone, c.raridade,
           co.obtida_em, co.id_lista, lu.id_midia, {titulo_exibido('m')} AS jogo
"""

_ORDEM = 'ORDER BY c.raridade ASC NULLS LAST, co.obtida_em DESC NULLS LAST, c.steam_appid, c.codigo'


def do_perfil(id_usuario: str) -> dict[str, Any]:
    """Os destaques (os escolhidos, ou as obtidas mais raras com `automaticos`) e o total."""
    escolhidos = banco.consultar(
        f'{_COLUNAS} {_OBTIDAS} JOIN conquistas_destaques cd ON cd.id_lista = co.id_lista AND cd.codigo = co.codigo '
        f'WHERE lu.id_usuario = %s {_ORDEM}',
        (id_usuario,),
    )
    automaticos = not escolhidos
    destaques = escolhidos or banco.consultar(
        f'{_COLUNAS} {_OBTIDAS} WHERE lu.id_usuario = %s {_ORDEM} LIMIT %s', (id_usuario, LIMITE_DE_DESTAQUES),
    )
    total = banco.consultar_um(
        f'SELECT count(*) AS conquistas, count(DISTINCT co.id_lista) AS jogos {_OBTIDAS} WHERE lu.id_usuario = %s',
        (id_usuario,),
    )
    return {'destaques': destaques, 'automaticos': automaticos, 'total': total}


def _obtida(db, id_usuario: str, appid: int, codigo: str) -> dict[str, Any] | None:
    return db.consultar_um(
        f'SELECT co.id_lista, co.codigo {_OBTIDAS} '
        'WHERE lu.id_usuario = %s AND ci.steam_appid = %s AND co.codigo = %s ORDER BY co.id_lista LIMIT 1',
        (id_usuario, appid, codigo),
    )


def destacar(id_usuario: str, appid: int, codigo: str) -> str:
    """Põe a conquista obtida nos destaques: `DESTACADA`, `NAO_OBTIDA` ou `LIMITE_ATINGIDO`.

    Destacar a que já está lá não muda nada. O lock por Usuário impede que duas requisições
    juntas passem do limite.
    """
    with banco.transacao() as db:
        obtida = _obtida(db, id_usuario, appid, codigo)
        if obtida is None:
            return NAO_OBTIDA
        db.executar("SELECT pg_advisory_xact_lock(hashtextextended('conquistas_destaques:' || %s, 0))",
                    (id_usuario,))
        contagem = db.consultar_um(
            'SELECT count(*) AS destacadas, '
            'count(*) FILTER (WHERE cd.id_lista = %s AND cd.codigo = %s) AS esta '
            'FROM conquistas_destaques cd JOIN lista_usuarios lu ON lu.id_lista = cd.id_lista '
            'WHERE lu.id_usuario = %s',
            (obtida['id_lista'], obtida['codigo'], id_usuario),
        )
        if contagem['esta']:
            return DESTACADA
        if not cabe_mais_um_destaque(contagem['destacadas']):
            return LIMITE_ATINGIDO
        db.executar('INSERT INTO conquistas_destaques (id_lista, codigo) VALUES (%s, %s) ON CONFLICT DO NOTHING',
                    (obtida['id_lista'], obtida['codigo']))
        return DESTACADA


def tirar(id_usuario: str, appid: int, codigo: str) -> bool:
    """Tira a conquista dos destaques; False se ela não é uma obtida do Usuário (tirar a que não está é ok)."""
    with banco.transacao() as db:
        obtida = _obtida(db, id_usuario, appid, codigo)
        if obtida is None:
            return False
        db.executar('DELETE FROM conquistas_destaques WHERE id_lista = %s AND codigo = %s',
                    (obtida['id_lista'], obtida['codigo']))
        return True
