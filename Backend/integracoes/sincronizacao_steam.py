"""Sincronização da Steam (Q111, Q113): sem prévia, grava direto pela `servico.aplicar_itens`.

1. Lê os jogos já abertos do perfil conectado (`integracoes.steam`).
2. Os já casados em `steam_appids` vão primeiro: atualizar horas é barato e é o que o
   "Sincronizar agora" mais precisa entregar.
3. Os que faltam casar passam pelo RAWG (`integracoes.rawg`), um por vez, enquanto houver
   orçamento: casou, a Mídia entra no Catálogo (se faltava) e o appid fica gravado; não casou,
   grava o negativo (só é buscado de novo depois de `RETENTAR_NEGATIVO_DIAS`). O que não coube
   no orçamento, ou o RAWG fora do ar, fica `pendente` para a próxima (o job diário).

O orçamento conta do início (ler a biblioteca e aplicar os já casados entram nele) e é
conferido antes de cada chamada ao RAWG, não só entre jogos: um jogo pode pedir a busca, as
lojas e o detalhe. `orcamento=None` (job diário) casa tudo. O resultado vai para
`integracoes.ultimo_resultado`.
"""
from __future__ import annotations

import time
from dataclasses import replace
from datetime import date
from typing import Any, Callable

from integracoes import catalogo, repositorio, servico, steam_appids
from integracoes.plataforma import Conta, ItemDeOrigem, OrigemIndisponivel, RefCatalogo, conferir_tamanho
from integracoes.rawg import Rawg

#: Orçamento do "Sincronizar agora", em segundos (a função da Vercel tem 300 s).
ORCAMENTO_SEGUNDOS = 60


class _OrcamentoEsgotado(OrigemIndisponivel):
    """O orçamento acabou antes de uma chamada ao RAWG: o jogo fica pendente."""


def _casar(item: ItemDeOrigem, rawg: Rawg) -> ItemDeOrigem | None:
    """O item com a referência do Catálogo, importando a Mídia se faltava; None se não casa.

    Grava o casamento (positivo ou negativo). Levanta OrigemIndisponivel sem gravar nada.
    """
    appid = int(item.origem_id)
    slug = rawg.casar(appid, item.titulo)
    if slug is None:
        steam_appids.gravar(appid, None, item.titulo)
        return None
    casado = replace(item, catalogo=RefCatalogo('rawg', slug))
    midia = catalogo.localizar([casado]).get(catalogo.chave(casado))
    if midia is None:
        detalhe = rawg.detalhe(slug)
        if not detalhe:
            steam_appids.gravar(appid, None, item.titulo)
            return None
        midia = catalogo.importar(replace(item, catalogo=RefCatalogo('rawg', slug, detalhe)))
        if midia is None:
            raise OrigemIndisponivel(f'não deu para importar {slug}')
    steam_appids.gravar(appid, midia['id_midia'], item.titulo)
    return casado


def _somar(*resultados: dict[str, Any]) -> dict[str, Any]:
    nao_encontrados = [n for r in resultados for n in r['nao_encontrados']]
    return {
        'novos': sum(r['novos'] for r in resultados),
        'atualizados': sum(r['atualizados'] for r in resultados),
        'nao_encontrados': nao_encontrados[:servico.AMOSTRA_NAO_ENCONTRADOS],
        'total_nao_encontrados': sum(r['total_nao_encontrados'] for r in resultados),
    }


def sincronizar(
    id_usuario: str, *, orcamento: float | None, relogio: Callable[[], float] = time.monotonic,
    hoje: date | None = None,
) -> dict[str, Any]:
    """Sincroniza a Steam do Usuário; devolve novos, atualizados, Não encontrados e `pendentes`."""
    inicio = relogio()
    steam = servico.plataforma_disponivel('steam')
    conta = repositorio.conta(id_usuario, 'steam')
    if conta is None:
        raise servico.SemConta('steam')
    itens = steam.ler(Conta(conta['identificador'], conta['nome_exibicao']))
    conferir_tamanho(len(itens))

    casamentos = steam_appids.ler([int(i.origem_id) for i in itens])
    casados, a_casar, sem_casamento = [], [], []
    for item in itens:
        casamento = casamentos.get(int(item.origem_id))
        if casamento and casamento['rawg_slug']:
            casados.append(replace(item, catalogo=RefCatalogo('rawg', casamento['rawg_slug'])))
        elif casamento and not casamento['vencido']:
            sem_casamento.append(item)
        else:
            a_casar.append(item)

    ja_casados = servico.aplicar_itens(id_usuario, casados, hoje=hoje)

    def conferir_orcamento() -> None:
        if orcamento is not None and relogio() - inicio >= orcamento:
            raise _OrcamentoEsgotado('orçamento do Sincronizar agora esgotado')

    rawg = Rawg(antes_de_chamar=conferir_orcamento)
    recem_casados: list[ItemDeOrigem] = []
    pendentes = 0
    try:
        for posicao, item in enumerate(a_casar):
            if not rawg.disponivel():
                pendentes = len(a_casar) - posicao
                break
            try:
                casado = _casar(item, rawg)
            except OrigemIndisponivel:
                # Orçamento ou prazo esgotado, ou o RAWG caiu: este e o resto ficam para a próxima.
                pendentes = len(a_casar) - posicao
                break
            if casado:
                recem_casados.append(casado)
            else:
                sem_casamento.append(item)
    finally:
        rawg.fechar()

    novos_casados = servico.aplicar_itens(id_usuario, recem_casados, hoje=hoje)
    nao_casados = [{'titulo': i.titulo, 'link': i.link} for i in sem_casamento]
    resultado = {
        **_somar(ja_casados, novos_casados, {
            'novos': 0, 'atualizados': 0, 'nao_encontrados': nao_casados, 'total_nao_encontrados': len(nao_casados),
        }),
        'pendentes': pendentes,
    }
    repositorio.registrar_resultado(id_usuario, 'steam', resultado)
    return resultado
