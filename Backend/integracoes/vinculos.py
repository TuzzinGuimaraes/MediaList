"""Vínculos de origem (Q115, Q116): o Usuário liga um Não encontrado a uma Mídia do Catálogo.

O vínculo é global (`vinculos_origem`, migração 0009): vale na hora para todo Usuário com o mesmo
item na mesma plataforma, e guarda autor e data para o admin desfazer. A chave inclui o Tipo
(no MAL, anime 1 e mangá 1 são obras diferentes). O vínculo é reserva: só vale para o item que
a busca da plataforma não casa. Na Steam o casamento também vai para `steam_appids`, mas só onde ele estava
vazio (negativo ou ignorado); casado com outra Mídia, o Vincular recusa. Desfazer deixa ali o
negativo, então a próxima sincronização volta a tratar o jogo como Não encontrado. Desfazer
nunca apaga Itens.

Só SQL de `vinculos_origem` e a troca do `catalogo` dos itens; as regras ficam no
`servico.vincular`, a ordem do casamento no `integracoes.casamento`, o resultado e as prévias
guardados no `integracoes.repositorio` (formato do `integracoes.resultado`).
"""
from __future__ import annotations

from dataclasses import replace
from typing import Any

import banco
from integracoes import steam_appids
from integracoes.plataforma import ItemDeOrigem, RefCatalogo, uuid_valido
from integracoes.steam import link_da_loja

#: Tipos de Mídia a que cada plataforma pode vincular (Q116).
TIPOS_DA_PLATAFORMA: dict[str, tuple[str, ...]] = {
    'anilist': ('anime', 'manga'), 'mal': ('anime', 'manga'), 'steam': ('jogo',),
}



def link(plataforma: str, tipo: str, origem_id: str) -> str | None:
    """A página do item na plataforma (o admin confere o vínculo por ela)."""
    if plataforma == 'steam':
        return link_da_loja(origem_id)
    if plataforma == 'anilist':
        return f'https://anilist.co/{tipo}/{origem_id}'
    if plataforma == 'mal':
        return f'https://myanimelist.net/{tipo}/{origem_id}'
    return None


def aplicar(plataforma: str, itens: list[ItemDeOrigem], db=banco) -> list[ItemDeOrigem]:
    """Os itens, com `catalogo` na Mídia do vínculo quando há um.

    O vínculo é reserva: quem chama (`integracoes.casamento`) só passa os itens que a busca da plataforma não casou.
    """
    if not itens:
        return itens
    linhas = db.consultar(
        'SELECT tipo, origem_id, id_midia::text AS id_midia FROM vinculos_origem '
        'WHERE plataforma = %s AND origem_id = ANY(%s)',
        (plataforma, sorted({i.origem_id for i in itens})),
    )
    por_chave = {(linha['tipo'], linha['origem_id']): linha['id_midia'] for linha in linhas}
    return [
        replace(item, catalogo=RefCatalogo('midia', por_chave[(item.tipo, item.origem_id)]))
        if (item.tipo, item.origem_id) in por_chave else item
        for item in itens
    ]


def midia(id_midia: str) -> dict[str, Any] | None:
    """`{id_midia, tipo}` da Mídia, ou None (inclusive id que não é UUID)."""
    if not uuid_valido(id_midia):
        return None
    return banco.consultar_um(
        'SELECT m.id_midia::text AS id_midia, tm.nome_tipo AS tipo FROM midias m '
        'JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo WHERE m.id_midia = %s',
        (id_midia,),
    )


def nao_encontrados(id_usuario: str, plataforma: str, origem_id: str) -> list[dict[str, Any]]:
    """As entradas desse item nos Não encontrados do Usuário: o último resultado e as prévias válidas."""
    return [linha['entrada'] for linha in banco.consultar(
        """
        SELECT entrada FROM (
            SELECT jsonb_array_elements(ultimo_resultado -> 'nao_encontrados') AS entrada
            FROM integracoes WHERE id_usuario = %s AND plataforma = %s AND ultimo_resultado IS NOT NULL
            UNION ALL
            SELECT jsonb_array_elements(conteudo -> 'nao_encontrados')
            FROM importacao_previas WHERE id_usuario = %s AND plataforma = %s AND expira_em > now()
        ) x WHERE entrada ->> 'origem_id' = %s
        """,
        (id_usuario, plataforma, id_usuario, plataforma, origem_id),
    )]


class JaNoCatalogo(Exception):
    """A appid da Steam já casou com outra Mídia (pela busca): o vínculo não a troca."""

    def __init__(self, id_midia: str):
        super().__init__(id_midia)
        self.id_midia = id_midia


def gravar(db, plataforma: str, origem_id: str, tipo: str, id_midia: str, id_usuario: str,
           titulo: str) -> dict[str, Any]:
    """Grava o vínculo e devolve `{id, id_midia}`; se já havia um, devolve o que estava (talvez outra Mídia).

    Na Steam, preenche o casamento em `steam_appids` só se ele está vazio; casado com outra Mídia,
    levanta JaNoCatalogo (o chamador desfaz a transação, e o vínculo não fica).
    """
    vinculo = db.consultar_um(
        'INSERT INTO vinculos_origem (plataforma, origem_id, tipo, id_midia, id_usuario) VALUES (%s, %s, %s, %s, %s) '
        'ON CONFLICT (plataforma, tipo, origem_id) DO NOTHING RETURNING id, id_midia::text AS id_midia',
        (plataforma, origem_id, tipo, id_midia, id_usuario),
    )
    if vinculo is None:
        return db.consultar_um(
            'SELECT id, id_midia::text AS id_midia FROM vinculos_origem '
            'WHERE plataforma = %s AND tipo = %s AND origem_id = %s',
            (plataforma, tipo, origem_id),
        )
    if plataforma == 'steam':
        casada = steam_appids.vincular(db, int(origem_id), id_midia, titulo)
        if casada != id_midia:
            raise JaNoCatalogo(casada)
    return vinculo


def listar(limite: int, deslocamento: int) -> tuple[list[dict[str, Any]], int]:
    """Uma página dos vínculos, mais recentes primeiro, com a Mídia e o autor; e o total."""
    linhas = banco.consultar(
        """
        SELECT v.id AS id_vinculo, v.plataforma, v.origem_id, v.tipo, v.id_midia, v.criado_em,
               m.titulo_original, m.titulo_portugues, v.id_usuario, u.nome_completo
        FROM vinculos_origem v
        JOIN midias m ON m.id_midia = v.id_midia
        LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario
        ORDER BY v.criado_em DESC, v.id DESC
        LIMIT %s OFFSET %s
        """,
        (limite, deslocamento),
    )
    total = banco.consultar_um('SELECT count(*) AS total FROM vinculos_origem')['total']
    return [{**linha, 'link': link(linha['plataforma'], linha['tipo'], linha['origem_id'])} for linha in linhas], total


def desfazer(id_vinculo: str) -> bool:
    """Apaga o vínculo (os Itens ficam); na Steam, o casamento vira negativo. False se não existe."""
    if not uuid_valido(id_vinculo):
        return False
    with banco.transacao() as t:
        apagado = t.consultar_um(
            'DELETE FROM vinculos_origem WHERE id = %s RETURNING plataforma, origem_id, id_midia',
            (id_vinculo,),
        )
        if apagado is None:
            return False
        if apagado['plataforma'] == 'steam' and apagado['origem_id'].isdigit():
            t.executar(
                'UPDATE steam_appids SET id_midia = NULL, tentado_em = now() WHERE appid = %s AND id_midia = %s',
                (int(apagado['origem_id']), apagado['id_midia']),
            )
    return True
