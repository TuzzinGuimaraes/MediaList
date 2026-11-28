"""Conquistas da Steam no banco (migração 0021): só a sincronização da Steam escreve aqui.

O esquema de cada jogo (`conquistas_esquemas` e `conquistas`) é compartilhado pela `steam_appid`;
a leitura de cada Item de jogo (`conquistas_itens`) guarda o total do jogo e as horas da Steam
daquela leitura, e `conquistas_obtidas`, as obtidas com a data. Trocar as obtidas apaga só as que
a Steam deixou de listar, e a FK leva junto o destaque que apontava para elas.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

import banco


def itens_de_jogo(id_usuario: str, id_midias: list[str]) -> dict[str, dict[str, Any]]:
    """Os Itens do Usuário nessas Mídias, por id_midia: `id_lista` e a última leitura (`horas_lidas`
    e `total`, None se o Item nunca foi lido)."""
    if not id_midias:
        return {}
    linhas = banco.consultar(
        'SELECT lu.id_midia, lu.id_lista, ci.horas_lidas, ci.total FROM lista_usuarios lu '
        'LEFT JOIN conquistas_itens ci ON ci.id_lista = lu.id_lista '
        'WHERE lu.id_usuario = %s AND lu.id_midia = ANY(%s::uuid[])',
        (id_usuario, id_midias),
    )
    return {linha['id_midia']: linha for linha in linhas}


def total_do_esquema(appid: int) -> int | None:
    """O total do esquema guardado do jogo, ou None se ele ainda não foi lido."""
    linha = banco.consultar_um('SELECT total FROM conquistas_esquemas WHERE steam_appid = %s', (appid,))
    return linha['total'] if linha else None


def gravar_esquema(db, appid: int, total: int, esquema: list[dict[str, Any]] | None) -> None:
    """Grava o total do jogo e, com `esquema`, troca as conquistas dele (a raridade fica).

    Sem `esquema`, só garante a linha do jogo (o jogo sem conquistas, ou o esquema que não mudou).
    """
    if esquema is None:
        db.executar('INSERT INTO conquistas_esquemas (steam_appid, total) VALUES (%s, %s) '
                    'ON CONFLICT (steam_appid) DO NOTHING', (appid, total))
        return
    db.executar('INSERT INTO conquistas_esquemas (steam_appid, total) VALUES (%s, %s) '
                'ON CONFLICT (steam_appid) DO UPDATE SET total = EXCLUDED.total, lido_em = now()', (appid, total))
    codigos = [c['codigo'] for c in esquema]
    db.executar('DELETE FROM conquistas WHERE steam_appid = %s AND NOT (codigo = ANY(%s::text[]))', (appid, codigos))
    db.executar(
        """
        INSERT INTO conquistas (steam_appid, codigo, nome, descricao, icone, icone_cinza, oculta)
        SELECT %s, * FROM unnest(%s::text[], %s::text[], %s::text[], %s::text[], %s::text[], %s::boolean[])
        ON CONFLICT (steam_appid, codigo) DO UPDATE SET
            nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, icone = EXCLUDED.icone,
            icone_cinza = EXCLUDED.icone_cinza, oculta = EXCLUDED.oculta
        """,
        (appid, codigos, *([c[campo] for c in esquema] for campo in
                           ('nome', 'descricao', 'icone', 'icone_cinza', 'oculta'))),
    )


def gravar_raridades(db, appid: int, raridades: dict[str, float]) -> None:
    """A raridade (% dos jogadores) de cada conquista do jogo; a que a Steam não deu fica sem."""
    db.executar(
        'UPDATE conquistas c SET raridade = (SELECT r.raridade FROM unnest(%s::text[], %s::float8[]) '
        'AS r (codigo, raridade) WHERE r.codigo = c.codigo) WHERE c.steam_appid = %s',
        (list(raridades), list(raridades.values()), appid),
    )


def gravar_do_item(db, id_lista: str, appid: int, total: int, horas: int,
                   obtidas: dict[str, datetime | None]) -> None:
    """A leitura do Item: total, horas da Steam e as obtidas (as que sumiram saem, com o destaque)."""
    db.executar(
        'INSERT INTO conquistas_itens (id_lista, steam_appid, total, horas_lidas) VALUES (%s, %s, %s, %s) '
        'ON CONFLICT (id_lista) DO UPDATE SET steam_appid = EXCLUDED.steam_appid, total = EXCLUDED.total, '
        'horas_lidas = EXCLUDED.horas_lidas, lido_em = now()',
        (id_lista, appid, total, max(horas, 0)),
    )
    codigos = list(obtidas)
    db.executar('DELETE FROM conquistas_obtidas WHERE id_lista = %s AND NOT (codigo = ANY(%s::text[]))',
                (id_lista, codigos))
    db.executar(
        'INSERT INTO conquistas_obtidas (id_lista, codigo, obtida_em) '
        'SELECT %s, * FROM unnest(%s::text[], %s::timestamptz[]) '
        'ON CONFLICT (id_lista, codigo) DO UPDATE SET obtida_em = EXCLUDED.obtida_em',
        (id_lista, codigos, list(obtidas.values())),
    )


def do_item_do_usuario(id_usuario: str, id_lista: str) -> list[dict[str, Any]] | None:
    """As conquistas do Item (as de `do_item` mais `destacada`), ou None se o Item não é do Usuário.

    O Item sem leitura, ou de jogo sem conquistas, dá a lista vazia.
    """
    if not banco.consultar_um('SELECT 1 FROM lista_usuarios WHERE id_lista = %s AND id_usuario = %s',
                              (id_lista, id_usuario)):
        return None
    return banco.consultar(
        """
        SELECT c.codigo, c.nome, c.descricao, c.icone, c.icone_cinza, c.oculta, c.raridade, co.obtida_em,
               (co.codigo IS NOT NULL) AS obtida, (cd.codigo IS NOT NULL) AS destacada
        FROM conquistas_itens ci
        JOIN conquistas c ON c.steam_appid = ci.steam_appid
        LEFT JOIN conquistas_obtidas co ON co.id_lista = ci.id_lista AND co.codigo = c.codigo
        LEFT JOIN conquistas_destaques cd ON cd.id_lista = co.id_lista AND cd.codigo = co.codigo
        WHERE ci.id_lista = %s
        """,
        (id_lista,),
    )


def do_item(id_lista: str) -> list[dict[str, Any]]:
    """As conquistas do jogo do Item, pelo esquema guardado, com `obtida_em` (None: não obtida), por código."""
    return banco.consultar(
        """
        SELECT c.codigo, c.nome, c.descricao, c.icone, c.icone_cinza, c.oculta, c.raridade, co.obtida_em
        FROM conquistas_itens ci
        JOIN conquistas c ON c.steam_appid = ci.steam_appid
        LEFT JOIN conquistas_obtidas co ON co.id_lista = ci.id_lista AND co.codigo = c.codigo
        WHERE ci.id_lista = %s
        ORDER BY c.codigo
        """,
        (id_lista,),
    )
