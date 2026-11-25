"""Sincronização da Steam (Q111, Q113, Q115): sem prévia, grava direto pela `servico.aplicar_itens`.

1. Lê os jogos já abertos do perfil conectado (`integracoes.steam`).
2. Os já casados em `steam_appids`, e os que o Catálogo já tem pela appid (`jogos.steam_appid`),
   vão primeiro: atualizar horas é barato e é o que o "Sincronizar agora" mais precisa entregar.
   Os ignorados (a loja disse que não são jogo) somem: nem "Não encontrados" nem pendentes.
3. Os que faltam casar passam, um por vez e enquanto houver orçamento, pelo RAWG
   (`integracoes.rawg`) e, se ele não tem o jogo, pela loja da Steam (`integracoes.loja_steam`):
   - o RAWG casou: a Mídia entra no Catálogo (se faltava) e guarda a appid;
   - a loja diz `game`: a Mídia é criada com os dados da loja (mesma gravação da Importação);
   - a loja diz outro tipo (software, DLC, trilha): a appid fica ignorada;
   - nenhum dos dois tem: grava o negativo (só é buscado de novo depois de `RETENTAR_NEGATIVO_DIAS`).
   O que não coube no orçamento, ou o RAWG ou a loja fora do ar, fica `pendente` para a próxima
   (o job diário), sem gravar nada.

O orçamento conta do início (ler a biblioteca e aplicar os já casados entram nele) e é
conferido antes de cada chamada ao RAWG e à loja, não só entre jogos: um jogo pode pedir a
busca, as lojas, o detalhe e a loja da Steam. `orcamento=None` (job diário) casa tudo. O
resultado vai para `integracoes.ultimo_resultado`.
"""
from __future__ import annotations

import time
from dataclasses import replace
from datetime import date
from typing import Any, Callable

from integracoes import catalogo, repositorio, servico, steam_appids
from integracoes.loja_steam import LojaSteam
from integracoes.plataforma import Conta, ItemDeOrigem, OrigemIndisponivel, RefCatalogo, conferir_tamanho
from integracoes.rawg import Rawg

#: Orçamento do "Sincronizar agora", em segundos (a função da Vercel tem 300 s).
ORCAMENTO_SEGUNDOS = 60

#: O que `_casar` devolve quando a loja diz que a appid não é jogo.
IGNORADO = object()


class _OrcamentoEsgotado(OrigemIndisponivel):
    """O orçamento acabou antes de uma chamada ao RAWG ou à loja: o jogo fica pendente."""


def _na_midia(item: ItemDeOrigem, id_midia: Any) -> ItemDeOrigem:
    return replace(item, catalogo=RefCatalogo('midia', str(id_midia)))


def _pelo_rawg(item: ItemDeOrigem, rawg: Rawg) -> catalogo.Localizada | None:
    """A Mídia do RAWG que vende esta appid na Steam, importada se faltava; None se o RAWG não tem."""
    slug = rawg.casar(int(item.origem_id), item.titulo)
    if slug is None:
        return None
    casado = replace(item, catalogo=RefCatalogo('rawg', slug))
    midia = catalogo.localizar([casado]).get(catalogo.chave(casado))
    if midia is not None:
        return midia
    detalhe = rawg.detalhe(slug)
    if not detalhe:
        return None
    midia = catalogo.importar(replace(item, catalogo=RefCatalogo('rawg', slug, detalhe)))
    if midia is None:
        raise OrigemIndisponivel(f'não deu para importar {slug}')
    return midia


def _pela_loja(item: ItemDeOrigem, loja: LojaSteam):
    """A Mídia criada pela loja da Steam (só `game`), IGNORADO (outro tipo) ou None (a loja não tem)."""
    dados = loja.detalhes(item.origem_id)
    if dados is None:
        return None
    if dados.get('type') != 'game':
        return IGNORADO
    dados = {**dados, 'name': dados.get('name') or item.titulo,
             'steam_appid': dados.get('steam_appid') or int(item.origem_id)}
    midia = catalogo.importar(replace(item, catalogo=RefCatalogo('steam', item.origem_id, dados)))
    if midia is None:
        raise OrigemIndisponivel(f'não deu para importar a appid {item.origem_id} da loja')
    return midia


def _casar(item: ItemDeOrigem, rawg: Rawg, loja: LojaSteam):
    """A Mídia do item (RAWG, senão a loja da Steam), IGNORADO ou None (não casa).

    Grava o casamento (positivo, ignorado ou negativo). Levanta OrigemIndisponivel sem gravar nada.
    """
    appid = int(item.origem_id)
    midia = _pelo_rawg(item, rawg)
    if midia is not None:
        steam_appids.marcar_na_midia(appid, midia['id_midia'])
    else:
        midia = _pela_loja(item, loja)
    if midia is IGNORADO:
        steam_appids.ignorar(appid, item.titulo)
        return IGNORADO
    steam_appids.gravar(appid, midia['id_midia'] if midia else None, item.titulo)
    return midia


def _somar(*resultados: dict[str, Any]) -> dict[str, Any]:
    nao_encontrados = [n for r in resultados for n in r['nao_encontrados']]
    return {
        'novos': sum(r['novos'] for r in resultados),
        'atualizados': sum(r['atualizados'] for r in resultados),
        'nao_encontrados': nao_encontrados[:servico.AMOSTRA_NAO_ENCONTRADOS],
        'total_nao_encontrados': sum(r['total_nao_encontrados'] for r in resultados),
    }


def _separar(itens: list[ItemDeOrigem]):
    """(casados, a casar, sem casamento): pelo `steam_appids` e, os que faltam, pela appid no Catálogo."""
    casamentos = steam_appids.ler([int(i.origem_id) for i in itens])
    casados, a_casar, sem_casamento = [], [], []
    for item in itens:
        casamento = casamentos.get(int(item.origem_id))
        if casamento and casamento['ignorado']:
            continue
        if casamento and casamento['id_midia']:
            casados.append(_na_midia(item, casamento['id_midia']))
        elif casamento and not casamento['vencido']:
            sem_casamento.append(item)
        else:
            a_casar.append(item)

    pela_appid = catalogo.localizar([replace(i, catalogo=RefCatalogo('steam', i.origem_id)) for i in a_casar])
    restantes = []
    for item in a_casar:
        midia = pela_appid.get(('jogo', 'steam', item.origem_id))
        if midia is None:
            restantes.append(item)
            continue
        steam_appids.gravar(int(item.origem_id), midia['id_midia'], item.titulo)
        casados.append(_na_midia(item, midia['id_midia']))
    return casados, restantes, sem_casamento


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

    casados, a_casar, sem_casamento = _separar(itens)
    ja_casados = servico.aplicar_itens(id_usuario, casados, hoje=hoje)

    def conferir_orcamento() -> None:
        if orcamento is not None and relogio() - inicio >= orcamento:
            raise _OrcamentoEsgotado('orçamento do Sincronizar agora esgotado')

    rawg = Rawg(antes_de_chamar=conferir_orcamento)
    loja = LojaSteam(antes_de_chamar=conferir_orcamento)
    recem_casados: list[ItemDeOrigem] = []
    pendentes = 0
    try:
        for posicao, item in enumerate(a_casar):
            if not rawg.disponivel():
                pendentes = len(a_casar) - posicao
                break
            try:
                casado = _casar(item, rawg, loja)
            except OrigemIndisponivel:
                # Orçamento ou prazo esgotado, ou o RAWG/a loja caiu: este e o resto ficam para a próxima.
                pendentes = len(a_casar) - posicao
                break
            if casado is IGNORADO:
                continue
            if casado:
                recem_casados.append(_na_midia(item, casado['id_midia']))
            else:
                sem_casamento.append(item)
    finally:
        rawg.fechar()
        loja.fechar()

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
