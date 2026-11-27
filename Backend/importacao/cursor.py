"""
Cursor da Importação, por Tipo de mídia (`importacao_cursor`).

A Importação diária continua de onde a anterior parou, em vez de recomeçar do início.

- RAWG (jogos): `proxima_pagina`, a próxima página da fonte. Sem linha, a página 1.
- AniList (animes e mangás), uma passada de cada (`importacao.anilist`):
  - crescimento: a fronteira (`crescimento_popularidade`, `crescimento_id`,
    `crescimento_empate`); sem ela, o topo, a partir da `proxima_pagina` (o cursor de página de
    antes da spec `anilist-sem-limite`; o novo a grava sempre em 1);
  - atualização das populares: `atualizacao_pagina`, de 1 a 100.
- Passada lenta da série dos jogos (`importacao.serie_jogos`), na linha `jogo`: a posição do
  último jogo passado na ordem de Popularidade (`serie_usuarios`, `serie_nota`, `serie_id`) e
  `serie_fim`, quando ela chegou ao fim.
"""
from __future__ import annotations

from collections.abc import Callable, Iterable

from banco import consultar_um, executar
from importacao import anilist


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


def ler_anilist(tipo_midia: str) -> dict:
    """`{'fronteira', 'pagina_topo', 'atualizacao_pagina'}` das duas passadas do AniList."""
    linha = consultar_um(
        'SELECT proxima_pagina, crescimento_popularidade, crescimento_id, crescimento_empate, '
        'atualizacao_pagina FROM importacao_cursor WHERE tipo_midia = %s',
        (tipo_midia,),
    )
    if not linha:
        return {'fronteira': None, 'pagina_topo': 1, 'atualizacao_pagina': 1}
    fronteira = None
    if linha['crescimento_id'] is not None:
        fronteira = anilist.Fronteira(
            linha['crescimento_popularidade'], linha['crescimento_id'], linha['crescimento_empate']
        )
    return {'fronteira': fronteira, 'pagina_topo': linha['proxima_pagina'],
            'atualizacao_pagina': linha['atualizacao_pagina']}


def gravar_crescimento(tipo_midia: str, fronteira: anilist.Fronteira | None) -> None:
    """Grava a fronteira do crescimento; `None` volta ao topo (página 1)."""
    valores = (None, None, None) if fronteira is None else (fronteira.popularidade, fronteira.id, fronteira.empate)
    executar(
        'INSERT INTO importacao_cursor (tipo_midia, proxima_pagina, crescimento_popularidade, crescimento_id, '
        'crescimento_empate) VALUES (%s, 1, %s, %s, %s) '
        'ON CONFLICT (tipo_midia) DO UPDATE SET proxima_pagina = 1, '
        'crescimento_popularidade = EXCLUDED.crescimento_popularidade, crescimento_id = EXCLUDED.crescimento_id, '
        'crescimento_empate = EXCLUDED.crescimento_empate, atualizado_em = now()',
        (tipo_midia, *valores),
    )


def gravar_atualizacao(tipo_midia: str, pagina: int) -> None:
    executar(
        'INSERT INTO importacao_cursor (tipo_midia, atualizacao_pagina) VALUES (%s, %s) '
        'ON CONFLICT (tipo_midia) DO UPDATE '
        'SET atualizacao_pagina = EXCLUDED.atualizacao_pagina, atualizado_em = now()',
        (tipo_midia, pagina),
    )


def ler_serie() -> dict | None:
    """O cursor da passada lenta: `{'posicao': (usuarios, nota, id_midia) | None, 'fim'}`; None se nunca rodou."""
    linha = consultar_um(
        "SELECT serie_usuarios, serie_nota, serie_id, serie_fim FROM importacao_cursor WHERE tipo_midia = 'jogo'"
    )
    if not linha or (linha['serie_id'] is None and not linha['serie_fim']):
        return None
    posicao = None if linha['serie_id'] is None else (linha['serie_usuarios'], linha['serie_nota'], linha['serie_id'])
    return {'posicao': posicao, 'fim': linha['serie_fim']}


def gravar_serie(posicao: tuple | None, fim: bool = False) -> None:
    """Grava a posição da passada lenta (o último jogo passado) e se ela chegou ao fim."""
    usuarios, nota, id_midia = posicao or (None, None, None)
    executar(
        "INSERT INTO importacao_cursor (tipo_midia, serie_usuarios, serie_nota, serie_id, serie_fim) "
        "VALUES ('jogo', %s, %s, %s, %s) "
        'ON CONFLICT (tipo_midia) DO UPDATE SET serie_usuarios = EXCLUDED.serie_usuarios, '
        'serie_nota = EXCLUDED.serie_nota, serie_id = EXCLUDED.serie_id, serie_fim = EXCLUDED.serie_fim, '
        'atualizado_em = now()',
        (usuarios, nota, id_midia, fim),
    )


def importar(
    tipo_midia: str,
    origem: str,
    stats,
    paginas: Iterable[dict],
    importar_pagina: Callable[[dict], None],
    avancar: Callable[[dict], None],
) -> bool:
    """Importa as `paginas` geradas e mantém o cursor em dia; `False` se uma página falhou.

    `paginas` gera `{'pagina', 'itens', 'erro', 'payload', ...}`; `importar_pagina(pagina)` grava
    os itens de uma página que veio e `avancar(pagina)` grava o cursor depois dela.

    Uma página com erro não avança o cursor e encerra a passada, para não abrir buracos: a
    próxima execução tenta a mesma página.
    """
    from importacao.utils import registrar_falha_importacao

    for pagina in paginas:
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
            return False
        importar_pagina(pagina)
        avancar(pagina)
    return True


def importar_paginas(
    tipo_midia: str,
    origem: str,
    stats,
    buscar_paginas: Callable[[int], Iterable[dict]],
    importar_pagina: Callable[[dict], None],
    do_inicio: bool = False,
) -> None:
    """Percorre as páginas da fonte a partir do cursor de página (`proxima_pagina`).

    `buscar_paginas(inicio)` gera páginas `{'pagina', 'itens', 'erro', 'payload', 'fim'}`.
    Depois de cada página que veio, grava a seguinte como próxima; no fim da fonte (`fim`),
    volta à página 1 e passa a atualizar as Mídias já importadas.
    """

    def ate_o_fim(paginas):
        for pagina in paginas:
            yield pagina
            if pagina.get('fim'):
                return

    def avancar(pagina):
        gravar(tipo_midia, 1 if pagina.get('fim') else pagina['pagina'] + 1)

    importar(
        tipo_midia, origem, stats, ate_o_fim(buscar_paginas(iniciar(tipo_midia, do_inicio))),
        importar_pagina, avancar,
    )


def importar_anilist(
    tipo_midia: str,
    stats,
    buscar,
    importar_pagina: Callable[[dict], None],
    paginas: int,
    paginas_atualizacao: int,
    do_inicio: bool = False,
) -> None:
    """As duas passadas do AniList: o crescimento (`paginas`) e a atualização (`paginas_atualizacao`).

    `buscar(pagina, sort, filtros)` é `anilist.buscar_pagina` com a sessão. `do_inicio` volta as
    duas ao topo. Página com falha encerra o Tipo (a atualização não roda depois de falha no
    crescimento).
    """
    if do_inicio:
        gravar_crescimento(tipo_midia, None)
        gravar_atualizacao(tipo_midia, 1)
    estado = ler_anilist(tipo_midia)

    if paginas > 0:
        ok = importar(
            tipo_midia, 'AniList', stats,
            anilist.crescimento(buscar, paginas, estado['fronteira'], estado['pagina_topo']),
            importar_pagina, lambda pagina: gravar_crescimento(tipo_midia, pagina['cursor']),
        )
        if not ok:
            return
    if paginas_atualizacao > 0:
        importar(
            tipo_midia, 'AniList', stats,
            anilist.atualizacao(buscar, paginas_atualizacao, estado['atualizacao_pagina']),
            importar_pagina, lambda pagina: gravar_atualizacao(tipo_midia, pagina['cursor']),
        )
