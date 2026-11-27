"""Catálogo sob demanda das Integrações: localizar a Mídia de cada item e importar a que falta.

Localizar só lê (a prévia não grava nada). Importar passa pela mesma rotina da Importação
(`processar_e_inserir_*`, upsert pela chave da fonte), então a Mídia entra igual à do lote.

Cada (Tipo, fonte) tem a coluna que acha a Mídia (`_COLUNAS`); a fonte `midia` acha pelo
próprio `id_midia`, em qualquer Tipo (casamento gravado, vínculo). Para outra fonte, some a
coluna em `_COLUNAS` e a função `dados -> {'id_midia', ...}` em `IMPORTADORES`.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Iterable

from banco import consultar
from importacao.importar_animes import processar_e_inserir_anime
from importacao.importar_jogos import processar_e_inserir_jogo_do_detalhe, processar_e_inserir_jogo_steam
from importacao.importar_mangas import processar_e_inserir_manga
from integracoes.plataforma import ItemDeOrigem, uuid_valido
from tipos_midia import TIPOS

logger = logging.getLogger(__name__)

#: (fonte, Tipo) -> função que grava a obra no formato da fonte e devolve `{'id_midia', ...}`.
IMPORTADORES: dict[tuple[str, str], Callable[[dict], dict]] = {
    ('anilist', 'anime'): processar_e_inserir_anime,
    ('anilist', 'manga'): processar_e_inserir_manga,
    # O detalhe do RAWG (`GET /games/<slug>`) traz o básico da listagem e o resto; `game_series`,
    # se veio, é a série que a Integração buscou.
    ('rawg', 'jogo'): processar_e_inserir_jogo_do_detalhe,
    # O `data` do `appdetails` da loja da Steam (jogo que o RAWG não reconhece).
    ('steam', 'jogo'): processar_e_inserir_jogo_steam,
}

#: (Tipo, fonte) -> coluna da tabela filha que acha a Mídia (UNIQUE), e se ela é inteira.
_COLUNAS: dict[tuple[str, str], tuple[str, bool]] = {
    ('anime', 'anilist'): ('anilist_id', True),
    ('manga', 'anilist'): ('anilist_id', True),
    ('jogo', 'rawg'): ('rawg_slug', False),
    ('jogo', 'steam'): ('steam_appid', True),
}

#: Mídia localizada: `{'id_midia', 'tipo', 'total'}` (total do Progresso; None no jogo).
Localizada = dict[str, Any]
#: (Tipo, fonte, id na fonte).
Chave = tuple[str, str, str]


def chave(item: ItemDeOrigem) -> Chave | None:
    """(Tipo, fonte, id na fonte) do item, ou None se ele não casa."""
    return (item.tipo, item.catalogo.fonte, item.catalogo.id_fonte) if item.catalogo else None



def localizar(itens: Iterable[ItemDeOrigem]) -> dict[Chave, Localizada]:
    """As Mídias que já estão no Catálogo, por `chave(item)`. Uma consulta por (Tipo, fonte)."""
    por_fonte: dict[tuple[str, str], set[str]] = {}
    for item in itens:
        if item.catalogo and item.tipo in TIPOS and (
            item.catalogo.fonte == 'midia' or (item.tipo, item.catalogo.fonte) in _COLUNAS
        ):
            por_fonte.setdefault((item.tipo, item.catalogo.fonte), set()).add(item.catalogo.id_fonte)

    achadas: dict[Chave, Localizada] = {}
    for (tipo, fonte), ids in por_fonte.items():
        config = TIPOS[tipo]
        total = f'{config.coluna_total}' if config.coluna_total else 'NULL::integer'
        if fonte == 'midia':
            coluna, valores, tipo_sql = 'id_midia', sorted(i for i in ids if uuid_valido(i)), '::uuid[]'
        else:
            coluna, inteira = _COLUNAS[(tipo, fonte)]
            # Coluna inteira: comparar como inteiro usa o índice da UNIQUE.
            valores = sorted(int(i) for i in ids if i.isdigit()) if inteira else sorted(ids)
            tipo_sql = ''
        linhas = consultar(
            f'SELECT {coluna}::text AS id_fonte, id_midia, {total} AS total '
            f'FROM {config.tabela} WHERE {coluna} = ANY(%s{tipo_sql})',
            (valores,),
        )
        for linha in linhas:
            achadas[(tipo, fonte, linha['id_fonte'])] = {
                'id_midia': linha['id_midia'], 'tipo': tipo, 'total': linha['total'],
            }
    return achadas


def importavel(item: ItemDeOrigem) -> bool:
    """O item traz a obra no formato de uma fonte que sabemos importar."""
    return bool(item.catalogo and item.catalogo.dados and (item.catalogo.fonte, item.tipo) in IMPORTADORES)


def importar(item: ItemDeOrigem) -> Localizada | None:
    """Grava a obra do item no Catálogo; None se não deu (vira Não encontrado)."""
    if not importavel(item):
        return None
    try:
        gravada = IMPORTADORES[(item.catalogo.fonte, item.tipo)](item.catalogo.dados)
    except Exception as exc:
        logger.warning('Falha ao importar %s %s sob demanda: %s', item.tipo, item.catalogo.id_fonte, exc)
        return None
    return localizar([item]).get(chave(item)) or {'id_midia': gravada['id_midia'], 'tipo': item.tipo, 'total': None}
