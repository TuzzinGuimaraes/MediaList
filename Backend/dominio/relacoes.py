"""
Relações entre Mídias na leitura (CONTEXT.md, Relação; spec `relacoes`).

A Importação grava só as Relações que a fonte deu a cada Mídia, com o código dela (`SEQUEL`,
`PREQUEL`... e `MESMA_SERIE` nos jogos). As Relações de uma Mídia são as dela mais as das outras
Mídias do Catálogo que apontam para ela, com o nome inverso: se A tem a Sequência B, B tem o
Prequel A, mesmo que a fonte só tenha registrado um lado. Quando os dois lados existem, vale o
da própria Mídia. Ficam de fora as ligações vagas (`CHARACTER`, `OTHER`, código que a leitura
não conhece) e as obras adultas.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Literal, get_args

#: Nome inverso de cada Relação. `PARENT` volta como `SIDE_STORY` (a fonte não diz se é
#: História paralela ou Spin-off). As que não estão aqui são simétricas ou ficam com o mesmo nome.
INVERSAS = {
    'SEQUEL': 'PREQUEL',
    'PREQUEL': 'SEQUEL',
    'ADAPTATION': 'SOURCE',
    'SOURCE': 'ADAPTATION',
    'SIDE_STORY': 'PARENT',
    'SPIN_OFF': 'PARENT',
    'PARENT': 'SIDE_STORY',
}

#: As Relações que a leitura mostra, pelo código da fonte: os do AniList e `MESMA_SERIE` nos jogos
#: (o contrato, `schemas.midias.RelacaoDaMidia`, usa este tipo).
NomeRelacao = Literal[
    'PREQUEL', 'SEQUEL', 'ADAPTATION', 'SOURCE', 'PARENT', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'SUMMARY',
    'COMPILATION', 'CONTAINS', 'SAME_UNIVERSE', 'MESMA_SERIE',
]
VISIVEIS: tuple[str, ...] = get_args(NomeRelacao)

#: Link da obra na fonte, por Tipo, para a obra que não está no Catálogo.
LINKS_DA_FONTE = {
    'anime': 'https://anilist.co/anime/{anilist_id}',
    'manga': 'https://anilist.co/manga/{anilist_id}',
    'jogo': 'https://rawg.io/games/{rawg_slug}',
}


def inversa(relacao: str) -> str:
    """O nome da Relação vista do outro lado."""
    return INVERSAS.get(relacao, relacao)


def _destino(linha: dict[str, Any]) -> tuple:
    """A identidade da obra na fonte: o Tipo e o `anilist_id` ou o `rawg_slug`."""
    return linha['tipo'], linha['anilist_id'], linha['rawg_slug']


def _saida(linha: dict[str, Any], relacao: str) -> dict[str, Any]:
    no_catalogo = linha['id_midia'] is not None
    return {
        'relacao': relacao,
        'tipo': linha['tipo'],
        'titulo': linha['titulo'],
        'poster_url': linha['poster_url'],
        'data_lancamento': linha['data_lancamento'],
        'id_midia': linha['id_midia'],
        'link_fonte': None if no_catalogo else LINKS_DA_FONTE[linha['tipo']].format(**linha),
        'status_consumo': linha['status_consumo'] if no_catalogo else None,
    }


def relacoes_da_midia(proprias: list[dict[str, Any]], de_outras: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """As Relações de uma Mídia: as `proprias` e as `de_outras` Mídias que apontam para ela, invertidas.

    Cada linha tem `relacao` (o código gravado na origem), a obra do outro lado (`tipo`,
    `anilist_id` ou `rawg_slug`, `adulto`, `titulo`, `poster_url`, `data_lancamento`), o `id_midia`
    dela no Catálogo (ou nulo) e o `status_consumo` do Usuário. Saem por estreia (sem ela, no
    fim) e título; a ordem por grupo é da interface (`dominio/relacoes.ts`).
    """
    ja_ditas = {_destino(linha) for linha in proprias}
    candidatas = [(linha, linha['relacao']) for linha in proprias] + [
        (linha, inversa(linha['relacao'])) for linha in de_outras if _destino(linha) not in ja_ditas
    ]
    saida = [_saida(linha, relacao) for linha, relacao in candidatas if relacao in VISIVEIS and not linha['adulto']]
    return sorted(saida, key=lambda r: (r['data_lancamento'] is None, r['data_lancamento'] or date.min, r['titulo']))
