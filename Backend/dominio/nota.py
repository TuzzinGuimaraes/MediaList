"""
Escala das notas do domínio: Avaliação, Nota pessoal e Nota da fonte.

As três vão de 0 a 10, com no máximo uma casa decimal (CONTEXT.md, ticket 13).
Nota com mais casas é recusada, não arredondada: 8,55 não vira 8,6 em silêncio.
O CHECK `numeric(3,1)` do banco continua como rede de segurança.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

MENSAGEM_ESCALA = 'A nota vai de 0 a 10, com no máximo uma casa decimal'

NOTA_MINIMA = Decimal(0)
NOTA_MAXIMA = Decimal(10)


class NotaInvalida(ValueError):
    """Nota fora da escala. A mensagem é a que o cliente vê."""

    def __init__(self):
        super().__init__(MENSAGEM_ESCALA)


def ler_nota(valor: Any) -> float:
    """Converte o que o cliente mandou numa nota da escala, ou levanta NotaInvalida.

    Aceita número ou texto com ponto ou vírgula decimal ('7,5'). Booleano não é nota.
    """
    if isinstance(valor, bool) or not isinstance(valor, (int, float, str)):
        raise NotaInvalida()

    texto = str(valor).strip().replace(',', '.')
    try:
        nota = Decimal(texto)
    except InvalidOperation:
        raise NotaInvalida() from None

    if not nota.is_finite() or not NOTA_MINIMA <= nota <= NOTA_MAXIMA:
        raise NotaInvalida()

    # Decimal(str(8.55)) é exatamente 8.55: o expoente diz quantas casas vieram.
    if nota != nota.quantize(Decimal('0.1')):
        raise NotaInvalida()

    return float(nota)
