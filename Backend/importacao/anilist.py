"""
Cliente AniList da Importação de animes e mangás: as duas passadas por Tipo.

A API pública recusa página acima de 100 (com 50 por página, 5000 obras por consulta). Por isso
nenhuma consulta passa da página `ULTIMA_PAGINA`:

- **Crescimento**, sem fim: janelas por popularidade (keyset), sempre a partir da página 1 da
  janela. A fronteira é a última obra importada na ordem `[POPULARITY_DESC, ID]`: a popularidade,
  o id e quantas obras com essa popularidade já vieram (`empate`). O AniList não filtra por id
  maior (`Page.media` não tem `id_greater`), então a faixa da fronteira (`popularity: P`,
  `sort: [ID]`) retoma pela posição: a página onde está a obra `empate + 1`, pulando as de id
  até o da fronteira. Acabada a faixa, segue com `popularity_lesser: P`. Janela que chega à
  última página continua numa janela nova a partir da fronteira. No fim do AniList, volta ao topo.
- **Atualização das populares**: as páginas 1–100 por popularidade, em rodízio.
- **Temporadas** (só anime): todas as páginas da Temporada atual e das seguintes (`season`,
  `seasonYear`, sem os adultos), sem cursor.

Uma faixa de empate com mais de 5000 obras não cabe numa janela: o resto dela fica para a volta
seguinte (em 2026-11-25, a página 100 das faixas de popularidade 0, 1 e 3 vinha vazia).
"""
from __future__ import annotations

import re
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import date

from importacao.config import ANILIST_URL
from importacao.utils import logger

#: Campos de `Media` que `processar_e_inserir_anime`/`_manga` gravam. As Integrações
#: (`integracoes.anilist`) pedem os mesmos, para importar sob demanda pela mesma rotina.
CAMPOS_MEDIA = """
      id
      title {
        romaji
        english
        native
      }
      description(asHtml: false)
      startDate { year month day }
      status
      episodes
      duration
      chapters
      volumes
      coverImage { large extraLarge }
      bannerImage
      meanScore
      genres
      studios(isMain: true) { nodes { name } }
      staff(sort: RELEVANCE) {
        edges {
          role
          node { name { full } }
        }
      }
      source
      trailer { id site }
      isAdult
      season
      seasonYear
      format
      popularity
"""

POR_PAGINA = 50
#: Páginas da atualização das populares por execução (500 obras).
PAGINAS_ATUALIZACAO = 10
#: A maior página que a API pública aceita.
ULTIMA_PAGINA = 100

POR_POPULARIDADE = ['POPULARITY_DESC', 'ID']
POR_ID = ['ID']

#: Filtro de `Page.media` → (variável da consulta, tipo dela); só vão os que a passada usa.
_FILTROS = {
    'popularity': ('popularity', 'Int'),
    'popularity_lesser': ('popularityLesser', 'Int'),
    'season': ('season', 'MediaSeason'),
    'seasonYear': ('seasonYear', 'Int'),
    'isAdult': ('isAdult', 'Boolean'),
}

#: `MediaSeason` do AniList, na ordem do ano: janeiro–março é o inverno (WINTER).
ESTACOES = ('WINTER', 'SPRING', 'SUMMER', 'FALL')
#: Temporadas que a Importação de animes traz inteiras por execução: a atual e as 4 seguintes.
#: Anda junto com `TEMPORADAS_A_FRENTE` de `dominio/temporada.ts` (4: até onde o seletor vai).
TEMPORADAS = 5


@dataclass(frozen=True)
class Fronteira:
    """Última obra importada pelo crescimento; `empate`: quantas com a mesma popularidade já vieram."""

    popularidade: int
    id: int
    empate: int


def _consulta(filtros: dict) -> tuple[str, dict]:
    argumentos = ''.join(f', {nome}: ${_FILTROS[nome][0]}' for nome in filtros)
    declaracoes = ''.join(f', ${_FILTROS[nome][0]}: {_FILTROS[nome][1]}' for nome in filtros)
    query = (
        f'query ($page: Int, $perPage: Int, $tipo: MediaType, $sort: [MediaSort]{declaracoes}) {{\n'
        '  Page(page: $page, perPage: $perPage) {\n'
        '    pageInfo { hasNextPage }\n'
        f'    media(type: $tipo, sort: $sort{argumentos}) {{' + CAMPOS_MEDIA + '    }\n'
        '  }\n}\n'
    )
    return query, {_FILTROS[nome][0]: valor for nome, valor in filtros.items()}


def _limite_de_paginas(response) -> bool:
    """O 400 da API pública para página acima do máximo."""
    if response.status_code != 400:
        return False
    try:
        erros = response.json().get('errors') or []
    except Exception:
        return False
    return any(re.search(r'page exceeds maximum', str(e.get('message', '')), re.I) for e in erros)


def buscar_pagina(session, rate_limiter, tipo: str, pagina: int, sort: list[str], filtros: dict) -> dict:
    """Uma página de `Page.media`: `{'itens', 'fim', 'erro', 'limite', 'payload'}`.

    `limite`: o AniList recusou a página por passar do máximo da API pública.
    """
    if not 1 <= pagina <= ULTIMA_PAGINA:
        raise ValueError(f'página {pagina} fora de 1..{ULTIMA_PAGINA}')
    query, variaveis = _consulta(filtros)
    payload = {
        'query': query,
        'variables': {'page': pagina, 'perPage': POR_PAGINA, 'tipo': tipo, 'sort': sort, **variaveis},
    }
    try:
        rate_limiter.wait()
        # O 429 é tratado pelo Retry da sessão (respeita Retry-After, com limite de
        # tentativas). Esgotado, raise_for_status falha a página.
        response = session.post(ANILIST_URL, json=payload, timeout=30)
        if _limite_de_paginas(response):
            return {'itens': [], 'fim': True, 'erro': None, 'limite': True, 'payload': payload}
        response.raise_for_status()
        data = response.json()['data']['Page']
    except Exception as exc:
        logger.warning('Falha ao buscar página %s do AniList (%s, %s): %s', pagina, tipo, filtros, exc)
        return {'itens': [], 'fim': False, 'erro': exc, 'limite': False, 'payload': payload}
    fim = not data['pageInfo']['hasNextPage']
    return {'itens': data['media'], 'fim': fim, 'erro': None, 'limite': False, 'payload': payload}


Buscar = Callable[[int, list[str], dict], dict]


def crescimento(buscar: Buscar, paginas: int, fronteira: Fronteira | None, pagina_topo: int = 1) -> Iterator[dict]:
    """Até `paginas` consultas do crescimento a partir da `fronteira` (ou do topo, na `pagina_topo`).

    Gera `{'pagina', 'itens', 'erro', 'payload', 'cursor'}`; `cursor` é a fronteira a gravar
    depois de importar os itens (`None`: o crescimento chegou ao fim e volta ao topo).
    Página com erro sai sem `cursor` e encerra a passada.
    """

    def janela_de(f: Fronteira | None, topo: int = 1) -> dict:
        if f is None:
            return {'nome': 'topo', 'sort': POR_POPULARIDADE, 'filtros': {}, 'pagina': min(topo, ULTIMA_PAGINA)}
        # Página da obra `empate` (a última que veio), não da seguinte: se uma obra da faixa mudou
        # de popularidade desde a última execução, a próxima recua para a página anterior. Os ids
        # até a fronteira são pulados, então reler a página só custa a consulta.
        pagina = max(f.empate - 1, 0) // POR_PAGINA + 1
        if pagina > ULTIMA_PAGINA:
            logger.warning('Faixa de popularidade %s passa de %s páginas: o resto fica para a volta seguinte',
                           f.popularidade, ULTIMA_PAGINA)
            return abaixo_de(f.popularidade)
        return {'nome': 'empate', 'sort': POR_ID, 'filtros': {'popularity': f.popularidade}, 'pagina': pagina}

    def abaixo_de(popularidade: int) -> dict:
        return {'nome': 'abaixo', 'sort': POR_POPULARIDADE, 'filtros': {'popularity_lesser': popularidade},
                'pagina': 1}

    janela = janela_de(fronteira, pagina_topo)
    for _ in range(paginas):
        numero = janela['pagina']
        resposta = buscar(numero, janela['sort'], janela['filtros'])
        if resposta['erro'] is not None or (resposta['limite'] and numero == 1):
            erro = resposta['erro'] or RuntimeError('AniList recusou a página 1 pelo limite de páginas')
            yield {'pagina': numero, 'itens': [], 'erro': erro, 'payload': resposta['payload']}
            return

        itens = []
        na_faixa = janela['nome'] == 'empate'
        # Na faixa, a posição manda: a obra n da faixa (por id) é a n desta janela.
        posicao = (numero - 1) * POR_PAGINA
        for item in resposta['itens']:
            if na_faixa:
                posicao += 1
                if fronteira is not None and item['id'] <= fronteira.id:
                    continue  # já veio
                fronteira = Fronteira(janela['filtros']['popularity'], item['id'], posicao)
            else:
                popularidade = item.get('popularity') or 0
                mesma = fronteira is not None and popularidade == fronteira.popularidade
                fronteira = Fronteira(popularidade, item['id'], fronteira.empate + 1 if mesma else 1)
            itens.append(item)

        if resposta['fim'] and not resposta['limite']:
            if janela['nome'] == 'empate':
                janela = abaixo_de(janela['filtros']['popularity'])
            else:
                yield {'pagina': numero, 'itens': itens, 'erro': None, 'cursor': None}
                return
        elif resposta['limite'] or numero >= ULTIMA_PAGINA:
            # Janela nova a partir da fronteira; a faixa que não coube segue abaixo dela.
            if na_faixa:
                logger.warning('Faixa de popularidade %s não coube na janela: o resto fica para a volta seguinte',
                               janela['filtros']['popularity'])
                janela = abaixo_de(janela['filtros']['popularity'])
            else:
                janela = janela_de(fronteira)
        else:
            janela['pagina'] = numero + 1
        yield {'pagina': numero, 'itens': itens, 'erro': None, 'cursor': fronteira}


def atualizacao(buscar: Buscar, paginas: int, pagina_inicial: int = 1) -> Iterator[dict]:
    """Até `paginas` páginas das populares a partir de `pagina_inicial`, em rodízio por 1..100.

    Gera `{'pagina', 'itens', 'erro', 'payload', 'cursor'}`; `cursor` é a próxima página. No fim
    do AniList (ou no 400 de limite), volta à 1 e encerra a passada.
    """
    pagina = min(max(pagina_inicial, 1), ULTIMA_PAGINA)
    for _ in range(paginas):
        resposta = buscar(pagina, POR_POPULARIDADE, {})
        if resposta['erro'] is not None:
            yield {'pagina': pagina, 'itens': [], 'erro': resposta['erro'], 'payload': resposta['payload']}
            return
        if resposta['fim']:
            yield {'pagina': pagina, 'itens': resposta['itens'], 'erro': None, 'cursor': 1}
            return
        proxima = 1 if pagina >= ULTIMA_PAGINA else pagina + 1
        yield {'pagina': pagina, 'itens': resposta['itens'], 'erro': None, 'cursor': proxima}
        pagina = proxima


def estacao_do_mes(mes: int) -> int:
    """A posição (0 a 3) da estação de um mês (1 a 12) no ano: um trimestre cada, inverno é janeiro–março."""
    return (mes - 1) // 3


def temporadas_a_frente(hoje: date, quantas: int = TEMPORADAS) -> list[tuple[str, int]]:
    """A Temporada de `hoje` e as seguintes, `quantas` ao todo: [(`MediaSeason`, `seasonYear`)]."""
    indice, ano = estacao_do_mes(hoje.month), hoje.year
    temporadas = []
    for _ in range(quantas):
        temporadas.append((ESTACOES[indice], ano))
        indice, ano = (0, ano + 1) if indice == len(ESTACOES) - 1 else (indice + 1, ano)
    return temporadas


def temporada(buscar: Buscar, estacao: str, ano: int) -> Iterator[dict]:
    """Todas as páginas de uma Temporada, sem os adultos, por popularidade.

    Gera `{'pagina', 'itens', 'erro', 'payload'}`. Página com erro encerra a Temporada (as outras
    seguem). Não tem cursor: cada execução lê a Temporada inteira de novo.
    """
    filtros = {'season': estacao, 'seasonYear': ano, 'isAdult': False}
    for pagina in range(1, ULTIMA_PAGINA + 1):
        resposta = buscar(pagina, POR_POPULARIDADE, filtros)
        if resposta['erro'] is not None:
            yield {'pagina': pagina, 'itens': [], 'erro': resposta['erro'], 'payload': resposta['payload']}
            return
        yield {'pagina': pagina, 'itens': resposta['itens'], 'erro': None}
        if resposta['fim']:
            return
