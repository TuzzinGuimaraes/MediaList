"""Resultado da integração (Q132): o que uma prévia, um confirmar, uma sincronização da Steam ou o
Vincular deixam para o Usuário. É o único dono do formato: monta, soma, corta a amostra, tira um
item e guarda. Também é dono do formato da prévia guardada (`Previa`), que guarda Não encontrados
do mesmo jeito e de onde o Vincular os tira pela mesma regra.

Um resultado tem novos, atualizados, os Não encontrados (cada um o item inteiro, para o Vincular
aplicá-lo depois) e o total deles; na Steam, também os `pendentes`. A resposta HTTP leva a amostra
de `AMOSTRA` e o total; o que fica guardado (`integracoes.ultimo_resultado`) leva todos, até
`MAXIMO_ITENS`, para que qualquer um possa ser vinculado. Resultado antigo, guardado só com a
amostra, continua valendo: o total vem guardado ao lado e não é recalculado pela lista.

A prévia guardada (`importacao_previas.conteudo`) tem os `itens` que mudam algo (o confirmar os
aplica) e os `nao_encontrados`, sem total nem amostra.
"""
from __future__ import annotations

from dataclasses import dataclass, fields, replace
from typing import Any, Iterable

from integracoes.plataforma import MAXIMO_ITENS, ItemDeOrigem, RefCatalogo, item_de_json, item_para_json

#: Quantos Não encontrados saem na resposta (o total sai à parte).
AMOSTRA = 100


@dataclass(frozen=True)
class Resultado:
    novos: int
    atualizados: int
    nao_encontrados: tuple[dict[str, Any], ...]
    total_nao_encontrados: int
    #: Só a sincronização da Steam: jogos que ficaram para a próxima.
    pendentes: int | None = None

    def resposta(self) -> dict[str, Any]:
        """O que a rota devolve: a amostra dos Não encontrados e o total."""
        return self._formato(AMOSTRA)

    def guardado(self) -> dict[str, Any]:
        """O que fica no banco: todos os Não encontrados (até `MAXIMO_ITENS`), para o Vincular."""
        return self._formato(MAXIMO_ITENS)

    def sem_o_item(self, origem_id: str, tipo: str) -> Resultado:
        """O resultado sem esse item nos Não encontrados, com o total ajustado (ele mesmo, se não estava)."""
        restantes = _tirar(self.nao_encontrados, origem_id, tipo)
        if restantes is None:
            return self
        tirados = len(self.nao_encontrados) - len(restantes)
        return replace(self, nao_encontrados=restantes,
                       total_nao_encontrados=max(self.total_nao_encontrados - tirados, 0))

    def _formato(self, quantos: int) -> dict[str, Any]:
        formato = {
            'novos': self.novos,
            'atualizados': self.atualizados,
            'nao_encontrados': list(self.nao_encontrados[:quantos]),
            'total_nao_encontrados': self.total_nao_encontrados,
        }
        if self.pendentes is not None:
            formato['pendentes'] = self.pendentes
        return formato


def criar(*, novos: int = 0, atualizados: int = 0, nao_encontrados: Iterable[dict[str, Any]] = (),
          pendentes: int | None = None) -> Resultado:
    """O resultado com estas contagens; o total é a quantidade de Não encontrados."""
    nao_encontrados = tuple(nao_encontrados)
    return Resultado(novos, atualizados, nao_encontrados, len(nao_encontrados), pendentes)


def somar(*resultados: Resultado) -> Resultado:
    """Contagens e totais somados; os Não encontrados um atrás do outro, na ordem."""
    pendentes = [r.pendentes for r in resultados if r.pendentes is not None]
    return Resultado(
        novos=sum(r.novos for r in resultados),
        atualizados=sum(r.atualizados for r in resultados),
        nao_encontrados=tuple(n for r in resultados for n in r.nao_encontrados),
        total_nao_encontrados=sum(r.total_nao_encontrados for r in resultados),
        pendentes=sum(pendentes) if pendentes else None,
    )


def de_guardado(guardado: dict[str, Any]) -> Resultado:
    """O resultado lido do banco (inverso de `Resultado.guardado`; aceita o antigo, só com a amostra)."""
    nao_encontrados = tuple(guardado.get('nao_encontrados') or ())
    total = guardado.get('total_nao_encontrados')
    pendentes = guardado.get('pendentes')
    return Resultado(
        novos=int(guardado.get('novos') or 0),
        atualizados=int(guardado.get('atualizados') or 0),
        nao_encontrados=nao_encontrados,
        total_nao_encontrados=len(nao_encontrados) if total is None else int(total),
        pendentes=None if pendentes is None else int(pendentes),
    )


@dataclass(frozen=True)
class Previa:
    """A prévia guardada: os itens que o confirmar aplica e os Não encontrados (já como ficam guardados)."""

    itens: tuple[dict[str, Any], ...]
    nao_encontrados: tuple[dict[str, Any], ...]

    def guardada(self) -> dict[str, Any]:
        """O que fica em `importacao_previas.conteudo`."""
        return {'itens': list(self.itens), 'nao_encontrados': list(self.nao_encontrados)}

    def itens_de_origem(self) -> list[ItemDeOrigem]:
        return [item_de_json(i) for i in self.itens]

    def sem_o_item(self, origem_id: str, tipo: str) -> Previa:
        """A prévia sem esse item nos Não encontrados (ela mesma, se não estava)."""
        restantes = _tirar(self.nao_encontrados, origem_id, tipo)
        return self if restantes is None else replace(self, nao_encontrados=restantes)


def previa(*, itens: Iterable[ItemDeOrigem], nao_encontrados: Iterable[ItemDeOrigem]) -> Previa:
    """A prévia a guardar: os itens como vêm (com a obra a importar) e os Não encontrados sem a obra."""
    return Previa(tuple(item_para_json(i) for i in itens), tuple(nao_encontrado(i) for i in nao_encontrados))


def previa_de_guardada(conteudo: dict[str, Any]) -> Previa:
    """A prévia lida do banco (inverso de `Previa.guardada`)."""
    return Previa(tuple(conteudo.get('itens') or ()), tuple(conteudo.get('nao_encontrados') or ()))


def _tirar(nao_encontrados: tuple[dict[str, Any], ...], origem_id: str,
           tipo: str) -> tuple[dict[str, Any], ...] | None:
    """Os Não encontrados sem esse item (por `origem_id` e Tipo); None se ele não estava."""
    restantes = tuple(n for n in nao_encontrados if (n.get('origem_id'), n.get('tipo')) != (origem_id, tipo))
    return None if len(restantes) == len(nao_encontrados) else restantes


def nao_encontrado(item: ItemDeOrigem) -> dict[str, Any]:
    """O Não encontrado como fica guardado: o item inteiro, sem a obra da fonte (o Vincular o aplica).

    A resposta só mostra título, link, `origem_id` e Tipo (o contrato corta o resto).
    """
    return item_para_json(replace(item, catalogo=None))


def item_do_nao_encontrado(entrada: dict[str, Any], id_midia: str) -> ItemDeOrigem:
    """O item guardado num Não encontrado, agora na Mídia `id_midia` (o Vincular o aplica)."""
    campos = {f.name for f in fields(ItemDeOrigem)} - {'catalogo'}
    return replace(item_de_json({k: v for k, v in entrada.items() if k in campos}),
                   catalogo=RefCatalogo('midia', id_midia))
