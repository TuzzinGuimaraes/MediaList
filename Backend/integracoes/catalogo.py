"""Catálogo sob demanda das Integrações: localizar a Mídia de cada item e importar a que falta.

Localizar só lê (a prévia não grava nada). Importar passa pela mesma rotina da Importação
(`processar_e_inserir_*`, upsert pela chave da fonte), então a Mídia entra igual à do lote.

Para outra fonte (ex. `rawg` no ticket da Steam), some uma entrada em `IMPORTADORES` com a
função `dados -> {'id_midia', ...}`; `localizar` já procura por `rawg_slug`.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Iterable

from banco import consultar
from importacao.importar_animes import processar_e_inserir_anime
from importacao.importar_jogos import processar_e_inserir_jogo
from importacao.importar_mangas import processar_e_inserir_manga
from integracoes.plataforma import ItemDeOrigem
from tipos_midia import TIPOS

logger = logging.getLogger(__name__)

#: (fonte, Tipo) -> função que grava a obra no formato da fonte e devolve `{'id_midia', ...}`.
IMPORTADORES: dict[tuple[str, str], Callable[[dict], dict]] = {
    ('anilist', 'anime'): processar_e_inserir_anime,
    ('anilist', 'manga'): processar_e_inserir_manga,
    # O detalhe do RAWG (`GET /games/<slug>`) traz o básico da listagem e o resto.
    ('rawg', 'jogo'): lambda detalhe: processar_e_inserir_jogo(detalhe, detalhe),
}

#: Fonte de cada Tipo: a chave da fonte na tabela filha (`tipos_midia`).
_FONTE_DO_TIPO = {'anime': 'anilist', 'manga': 'anilist', 'jogo': 'rawg'}

#: Mídia localizada: `{'id_midia', 'tipo', 'total'}` (total do Progresso; None no jogo).
Localizada = dict[str, Any]


def chave(item: ItemDeOrigem) -> tuple[str, str] | None:
    """(Tipo, id na fonte) do item, ou None se ele não casa."""
    return (item.tipo, item.catalogo.id_fonte) if item.catalogo else None


def localizar(itens: Iterable[ItemDeOrigem]) -> dict[tuple[str, str], Localizada]:
    """As Mídias que já estão no Catálogo, por `chave(item)`. Uma consulta por Tipo."""
    por_tipo: dict[str, set[str]] = {}
    for item in itens:
        if item.catalogo and _FONTE_DO_TIPO.get(item.tipo) == item.catalogo.fonte:
            por_tipo.setdefault(item.tipo, set()).add(item.catalogo.id_fonte)

    achadas: dict[tuple[str, str], Localizada] = {}
    for tipo, ids in por_tipo.items():
        config = TIPOS[tipo]
        total = f'{config.coluna_total}' if config.coluna_total else 'NULL::integer'
        # anilist_id é inteiro: comparar como inteiro usa o índice da UNIQUE.
        valores: list[Any] = sorted(ids)
        if config.chave_fonte == 'anilist_id':
            valores = sorted(int(i) for i in ids if i.isdigit())
        linhas = consultar(
            f'SELECT {config.chave_fonte}::text AS id_fonte, id_midia, {total} AS total '
            f'FROM {config.tabela} WHERE {config.chave_fonte} = ANY(%s)',
            (valores,),
        )
        for linha in linhas:
            achadas[(tipo, linha['id_fonte'])] = {'id_midia': linha['id_midia'], 'tipo': tipo, 'total': linha['total']}
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
