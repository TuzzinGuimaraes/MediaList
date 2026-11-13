"""Leitura dos parâmetros da query string (ticket 10).

Valor que não é número ou fica abaixo do mínimo levanta `ErroEntrada`, que o
errorhandler do app responde com 400 e a mensagem. Acima do máximo, o valor é
trazido para o máximo: pedir 999 itens por página devolve o teto, não um erro.
"""
from __future__ import annotations

from flask import request

#: Teto de itens por página em toda listagem paginada.
POR_PAGINA_MAX = 50
POR_PAGINA_PADRAO = 20


class ErroEntrada(ValueError):
    """Entrada do cliente inválida; a mensagem vai para a resposta."""


def ler_int(nome: str, padrao: int, minimo: int | None = None, maximo: int | None = None) -> int:
    bruto = request.args.get(nome)
    if bruto is None or bruto.strip() == '':
        return padrao

    try:
        valor = int(bruto)
    except ValueError:
        raise ErroEntrada(f"Parâmetro '{nome}' deve ser um número inteiro") from None

    if minimo is not None and valor < minimo:
        raise ErroEntrada(f"Parâmetro '{nome}' deve ser maior ou igual a {minimo}")
    if maximo is not None and valor > maximo:
        return maximo
    return valor


def ler_paginacao() -> tuple[int, int]:
    """(pagina, por_pagina): página a partir de 1, de 1 a 50 itens."""
    pagina = ler_int('pagina', 1, minimo=1)
    por_pagina = ler_int('por_pagina', POR_PAGINA_PADRAO, minimo=1, maximo=POR_PAGINA_MAX)
    return pagina, por_pagina
