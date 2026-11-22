"""
Cursor da Importação: a próxima página de cada Tipo de mídia na fonte (`importacao_cursor`).

A Importação diária continua de onde a anterior parou, em vez de recomeçar da
página 1. Sem linha para o Tipo, começa da página 1.
"""
from __future__ import annotations

from banco import consultar_um, executar


def ler(tipo_midia: str) -> int:
    """Página da fonte em que a próxima execução deste Tipo de mídia começa."""
    linha = consultar_um(
        'SELECT proxima_pagina FROM importacao_cursor WHERE tipo_midia = %s', (tipo_midia,)
    )
    return linha['proxima_pagina'] if linha else 1


def iniciar(tipo_midia: str, do_inicio: bool = False) -> int:
    """Página inicial da execução; `do_inicio` ignora o cursor e o reinicia em 1."""
    if do_inicio:
        gravar(tipo_midia, 1)
        return 1
    return ler(tipo_midia)


def gravar(tipo_midia: str, proxima_pagina: int) -> None:
    executar(
        'INSERT INTO importacao_cursor (tipo_midia, proxima_pagina) VALUES (%s, %s) '
        'ON CONFLICT (tipo_midia) DO UPDATE '
        'SET proxima_pagina = EXCLUDED.proxima_pagina, atualizado_em = now()',
        (tipo_midia, proxima_pagina),
    )
