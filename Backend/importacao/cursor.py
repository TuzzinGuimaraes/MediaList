"""
Cursor da Importação: a próxima página de cada Tipo de mídia na fonte (`importacao_cursor`).

A Importação diária continua de onde a anterior parou, em vez de recomeçar da
página 1. Sem linha para o Tipo, começa da página 1.
"""
from __future__ import annotations

from collections.abc import Callable, Iterable

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


def importar_paginas(
    tipo_midia: str,
    origem: str,
    stats,
    buscar_paginas: Callable[[int], Iterable[dict]],
    importar_pagina: Callable[[dict], None],
    do_inicio: bool = False,
) -> None:
    """Percorre as páginas da fonte a partir do cursor e o mantém em dia.

    `buscar_paginas(inicio)` gera páginas `{'pagina', 'itens', 'erro', 'payload', 'fim'}`;
    `importar_pagina(pagina)` grava os itens de uma página que veio.

    - Depois de cada página que veio, grava a seguinte como próxima.
    - Uma página com erro não avança o cursor e encerra este Tipo de mídia, para não
      abrir buracos: a próxima execução tenta a mesma página.
    - No fim da fonte (`fim`), volta à página 1 e passa a atualizar as Mídias já importadas.
    """
    from importacao.utils import registrar_falha_importacao

    for pagina in buscar_paginas(iniciar(tipo_midia, do_inicio)):
        numero = pagina['pagina']
        if pagina.get('erro') is not None:
            stats.registrar_falha_pagina(numero)
            registrar_falha_importacao(
                tipo_midia=tipo_midia,
                origem=origem,
                exc=pagina['erro'],
                identificador=f'pagina-{numero}',
                payload=pagina.get('payload'),
                extra={'pagina': numero, 'etapa': 'listar_pagina'},
            )
            return

        importar_pagina(pagina)
        fim = bool(pagina.get('fim'))
        gravar(tipo_midia, 1 if fim else numero + 1)
        if fim:
            return
