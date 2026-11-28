"""
Sugestões para o Usuário (CONTEXT.md, Sugestão; spec `sugestoes`).

As sementes são os Itens de anime e mangá do Usuário com Nota pessoal 8 ou mais, ou Favoritos.
O peso da semente é a Nota pessoal, ou 9 para o Favorito sem nota. Cada recomendação do AniList
que parte de uma semente vale `rating × peso`, e a obra recomendada por várias sementes soma os
pontos. O motivo cita a semente que mais contribuiu; entre sementes empatadas, a de maior peso e
depois a de título menor. No empate de pontos vem antes a obra mais popular na fonte (só o anime
guarda popularidade) e depois o título. Abaixo de 12, o Em alta completa a faixa, com o motivo
"Em alta".

O limiar da semente (`NOTA_MINIMA`) é daqui; a consulta das recomendações o recebe por parâmetro.

As exclusões (na Lista, adulta, fora do Catálogo, Relação das sementes) ficam na consulta
(`repositories.sugestoes`): aqui chegam só as recomendações que podem virar Sugestão.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any, Literal

#: Quantas Sugestões a faixa mostra.
LIMITE = 12
#: A Nota pessoal mínima de uma semente.
NOTA_MINIMA = Decimal(8)
#: O peso do Favorito sem Nota pessoal.
PESO_DO_FAVORITO = Decimal(9)

Porque = Literal['nota', 'favorito', 'em_alta']

EM_ALTA = {'porque': 'em_alta', 'nota': None, 'titulo': None}


def _nota_de_semente(nota: Decimal | None) -> bool:
    """A Nota pessoal faz do Item uma semente por si só (≥ `NOTA_MINIMA`)."""
    return nota is not None and nota >= NOTA_MINIMA


def peso_da_semente(nota: Decimal | None, favorito: bool) -> Decimal | None:
    """O peso do Item como semente (Nota pessoal ≥ 8 ou Favorito), ou None se ele não é semente.

    O peso é a Nota pessoal; o Favorito sem nota pesa `PESO_DO_FAVORITO`, e o Favorito com nota
    abaixo de 8 pesa a nota.
    """
    if not (_nota_de_semente(nota) or favorito):
        return None
    return PESO_DO_FAVORITO if nota is None else nota


def _motivo(linha: dict[str, Any]) -> dict[str, Any]:
    if _nota_de_semente(linha['nota']):
        return {'porque': 'nota', 'nota': float(linha['nota']), 'titulo': linha['titulo_semente']}
    return {'porque': 'favorito', 'nota': None, 'titulo': linha['titulo_semente']}


def sugerir(recomendacoes: list[dict[str, Any]], limite: int = LIMITE) -> list[dict[str, Any]]:
    """As Sugestões, em ordem: `{id_midia, motivo}`.

    Cada recomendação tem a obra recomendada (`id_midia`, `popularidade` na fonte, `titulo`
    exibido), o `rating` no AniList e a semente de onde partiu (`nota`, `favorito`,
    `titulo_semente`). Recomendação de Item que não é semente não conta.
    """
    pontos: dict[str, Decimal] = defaultdict(Decimal)
    # Por obra, a semente do motivo: a que mais contribuiu; no empate, a de maior peso, depois a
    # de título menor. A chave é comparada como tupla: a menor vence.
    mais_forte: dict[str, tuple[tuple[Decimal, Decimal, str], dict[str, Any]]] = {}
    for linha in recomendacoes:
        peso = peso_da_semente(linha['nota'], linha['favorito'])
        if peso is None:
            continue
        destino = linha['id_midia']
        contribuicao = linha['rating'] * peso
        pontos[destino] += contribuicao
        chave = (-contribuicao, -peso, linha['titulo_semente'])
        atual = mais_forte.get(destino)
        if atual is None or chave < atual[0]:
            mais_forte[destino] = (chave, linha)

    def ordem(destino: str) -> tuple:
        linha = mais_forte[destino][1]
        popularidade = linha['popularidade']
        return -pontos[destino], popularidade is None, -(popularidade or 0), linha['titulo'], destino

    return [
        {'id_midia': destino, 'motivo': _motivo(mais_forte[destino][1])}
        for destino in sorted(pontos, key=ordem)[:limite]
    ]


def completar_com_em_alta(
    sugestoes: list[dict[str, Any]], em_alta: list[dict[str, Any]], limite: int = LIMITE,
) -> list[dict[str, Any]]:
    """As Sugestões e, até `limite`, as Mídias do Em alta que ainda não saíram, com o motivo "Em alta"."""
    ja = {s['id_midia'] for s in sugestoes}
    complemento = [{**midia, 'motivo': dict(EM_ALTA)} for midia in em_alta if midia['id_midia'] not in ja]
    return [*sugestoes, *complemento][:limite]


def montar_faixa(
    escolhidas: list[dict[str, Any]], midias: dict[str, dict[str, Any]], limite: int = LIMITE,
) -> tuple[list[dict[str, Any]], int]:
    """(a faixa, quantas faltam para o Em alta completar).

    Junta cada Sugestão de `sugerir` à sua Mídia (`midias`, pelo id), com o motivo, e descarta a
    que não tem Mídia. A faixa para em `limite`.
    """
    faixa = [{**midias[s['id_midia']], 'motivo': s['motivo']} for s in escolhidas if s['id_midia'] in midias]
    faixa = faixa[:limite]
    return faixa, limite - len(faixa)
