"""
Conquistas de um Item na leitura (CONTEXT.md, Conquista; spec `conquistas-steam`, Q238).

A lista do Detalhe do jogo: as obtidas primeiro, da mais recente para a mais antiga; depois as que
faltam, da mais comum para a mais rara (as mais fáceis primeiro). A oculta que o Usuário ainda não
obteve sai sem nome e sem descrição, para não dar spoiler; obtida, aparece inteira. O ícone é o
colorido na obtida e o cinza na que falta (o outro, se a Steam só deu um).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

_ANTES_DE_TUDO = datetime.min.replace(tzinfo=timezone.utc)

#: Quantas conquistas obtidas o Usuário destaca no Perfil (e quantas automáticas saem sem escolha).
LIMITE_DE_DESTAQUES = 6

#: Resultados de `repositories.destaques.destacar` e `tirar`.
DESTACADA = 'destacada'
NAO_OBTIDA = 'nao_obtida'
LIMITE_ATINGIDO = 'limite_atingido'


def cabe_mais_um_destaque(destacadas: int) -> bool:
    """Com `destacadas` já no Perfil, dá para pôr outra (a que já está lá não conta como nova)."""
    return destacadas < LIMITE_DE_DESTAQUES


def _ordem(conquista: dict[str, Any]) -> tuple:
    if conquista['obtida']:
        return (0, -(conquista['obtida_em'] or _ANTES_DE_TUDO).timestamp(), conquista['codigo'])
    raridade = conquista['raridade']
    return (1, -raridade if raridade is not None else 1.0, conquista['codigo'])


def _para_o_detalhe(conquista: dict[str, Any]) -> dict[str, Any]:
    obtida = conquista['obtida']
    escondida = conquista['oculta'] and not obtida
    colorido_e_cinza = (conquista['icone'], conquista['icone_cinza'])
    icones = colorido_e_cinza if obtida else colorido_e_cinza[::-1]
    return {
        'codigo': conquista['codigo'],
        'nome': None if escondida else conquista['nome'],
        'descricao': None if escondida else conquista['descricao'],
        'icone': icones[0] or icones[1],
        'oculta': conquista['oculta'],
        'raridade': conquista['raridade'],
        'obtida': obtida,
        'obtida_em': conquista['obtida_em'],
        'destacada': conquista['destacada'],
    }


def lista_do_detalhe(conquistas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """As conquistas do Item (`integracoes.conquistas.do_item_do_usuario`) na ordem e na forma do Detalhe."""
    return [_para_o_detalhe(c) for c in sorted(conquistas, key=_ordem)]
