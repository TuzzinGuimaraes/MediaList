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
    OrdemDoSeletor,
    cabe_mais_um_destaque,
)
from repositories.titulos import sem_caixa_nem_acento, titulo_exibido

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

#: As ordens do seletor (a fonte delas; o TS só dá os rótulos); o Item e o código desempatam, para a
#: paginação não repetir nem pular.
ORDENS_DO_SELETOR: dict[OrdemDoSeletor, str] = {
    'raridade': 'c.raridade ASC NULLS LAST, co.obtida_em DESC NULLS LAST',
    'data': 'co.obtida_em DESC NULLS LAST, c.raridade ASC NULLS LAST',
}

#: Os destaques do Perfil vão na ordem `raridade` do seletor.
_ORDEM = f"ORDER BY {ORDENS_DO_SELETOR['raridade']}, c.steam_appid, c.codigo"


def do_seletor(id_usuario: str, *, busca: str | None, steam_appid: int | None, so_destacadas: bool,
               ordem: OrdemDoSeletor, limite: int, deslocamento: int) -> tuple[list[dict[str, Any]], int]:
    """Uma página das obtidas do Usuário (com `destacada` e o jogo) e quantas são em todas as páginas."""
    clausulas, params = ['lu.id_usuario = %s'], [id_usuario]
    if busca and busca.strip():
        clausulas.append(f"{sem_caixa_nem_acento('c.nome')} LIKE '%%' || {sem_caixa_nem_acento('%s')} || '%%'")
        params.append(busca.strip())
    if steam_appid is not None:
        clausulas.append('ci.steam_appid = %s')
        params.append(steam_appid)
    if so_destacadas:
        clausulas.append('cd.codigo IS NOT NULL')
    de_onde = (f'{_OBTIDAS} LEFT JOIN conquistas_destaques cd ON cd.id_lista = co.id_lista AND cd.codigo = co.codigo '
               f'WHERE {" AND ".join(clausulas)}')
    linhas = banco.consultar(
        f"""
        SELECT c.steam_appid, c.codigo, c.nome, c.descricao, c.icone, c.icone_cinza, c.oculta, c.raridade,
               co.obtida_em, true AS obtida, (cd.codigo IS NOT NULL) AS destacada,
               co.id_lista, lu.id_midia, {titulo_exibido('m')} AS jogo
        {de_onde}
        ORDER BY {ORDENS_DO_SELETOR[ordem]}, co.id_lista, c.codigo
        LIMIT %s OFFSET %s
        """,
        (*params, limite, deslocamento),
    )
    total = banco.consultar_um(f'SELECT count(*) AS total {de_onde}', params)['total']
    return linhas, total


def jogos_com_obtidas(id_usuario: str) -> list[dict[str, Any]]:
    """Os jogos do Usuário com ao menos uma obtida (pela appid), com quantas, pelo título."""
    linhas = banco.consultar(
        f"""
        SELECT ci.steam_appid, min(lu.id_midia::text) AS id_midia, min({titulo_exibido('m')}) AS jogo,
               count(*) AS obtidas
        {_OBTIDAS}
        WHERE lu.id_usuario = %s
        GROUP BY ci.steam_appid
        """,
        (id_usuario,),
    )
    return sorted(linhas, key=lambda j: (j['jogo'].casefold(), j['steam_appid']))


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
        f'SELECT count(*) AS conquistas, count(DISTINCT ci.steam_appid) AS jogos {_OBTIDAS} WHERE lu.id_usuario = %s',
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
