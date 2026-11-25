"""Steam e RAWG falsos para os testes das Integrações: sessão HTTP em memória, nada de rede."""
from __future__ import annotations

import re

CHAVE_STEAM = 'chave-steam-secreta-0123456789'
CHAVE_RAWG = 'chave-rawg-secreta-9876543210'
STEAMID = '76561197960287930'


class Resposta:
    def __init__(self, status_code, corpo):
        self.status_code = status_code
        self._corpo = corpo

    def json(self):
        if isinstance(self._corpo, Exception):
            raise self._corpo
        return self._corpo

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f'HTTP {self.status_code}')


class SessaoGet:
    """Responde cada GET por `rotas`: {regex do caminho: corpo | Resposta | Exception | callable(params)}.

    Guarda (url, params) de cada chamada em `chamadas`. HEAD responde por `cabecas`
    ({regex da URL: status | Exception}; sem rota, 404) e fica à parte, em `heads`.
    """

    def __init__(self, rotas: dict, cabecas: dict | None = None):
        self.rotas = rotas
        self.cabecas = cabecas or {}
        self.chamadas: list[tuple[str, dict]] = []
        self.timeouts: list[float | None] = []
        self.heads: list[str] = []
        self.timeouts_head: list[float | None] = []

    def head(self, url, timeout=None, allow_redirects=False):
        self.heads.append(url)
        self.timeouts_head.append(timeout)
        for padrao, status in self.cabecas.items():
            if re.search(padrao, url):
                if isinstance(status, Exception):
                    raise status
                return Resposta(status, None)
        return Resposta(404, None)

    def get(self, url, params=None, timeout=None):
        self.chamadas.append((url, dict(params or {})))
        self.timeouts.append(timeout)
        for padrao, resposta in self.rotas.items():
            if re.search(padrao, url):
                if callable(resposta) and not isinstance(resposta, type):
                    resposta = resposta(params or {})
                if isinstance(resposta, Exception):
                    raise resposta
                return resposta if isinstance(resposta, Resposta) else Resposta(200, resposta)
        raise AssertionError(f'GET inesperado: {url}')

    def caminhos(self) -> list[str]:
        return [url for url, _ in self.chamadas]

    def close(self):
        pass


def jogo_steam(appid, nome, minutos, ultimo=0):
    return {'appid': appid, 'name': nome, 'playtime_forever': minutos, 'rtime_last_played': ultimo}


def rotas_steam(jogos=None, *, visibilidade=3, nome='Fulano', vanity=None, privado_jogos=False):
    """As três chamadas da Steam. `jogos=None` com `privado_jogos` devolve `{}` (detalhes privados)."""
    vanities = vanity or {}
    return {
        r'ResolveVanityURL': lambda p: {'response': (
            {'steamid': vanities[p['vanityurl']], 'success': 1} if p.get('vanityurl') in vanities
            else {'success': 42, 'message': 'No match'}
        )},
        r'GetPlayerSummaries': lambda p: {'response': {'players': [
            {'steamid': p['steamids'], 'communityvisibilitystate': visibilidade, 'personaname': nome},
        ]}},
        r'GetOwnedGames': {'response': {} if privado_jogos else {
            'game_count': len(jogos or []), 'games': list(jogos or []),
        }},
    }


def resultado_rawg(slug, nome, lojas=('steam',)):
    return {'slug': slug, 'name': nome, 'stores': [{'store': {'id': 1, 'slug': s}} for s in lojas]}


def detalhe_rawg(slug, nome):
    return {
        'id': 1, 'slug': slug, 'name': nome, 'released': '2020-01-01', 'rating': 4.2,
        'background_image': None, 'platforms': [{'platform': {'name': 'PC'}}],
        'genres': [{'name': 'Action'}], 'tags': [], 'developers': [], 'publishers': [],
        'description_raw': 'Um jogo.', 'esrb_rating': None,
    }



def appdetails(appid, nome, *, tipo='game', data='21 ago. 2012', em_breve=False, desenvolvedoras=('Valve',),
               publicadoras=('Valve',), generos=(('1', 'Ação'),), plataformas=None, categorias=(2,),
               descricao='Um jogo.'):
    """Resposta de `store.steampowered.com/api/appdetails?appids=<appid>&l=portuguese` (a forma real, resumida)."""
    return {str(appid): {'success': True, 'data': {
        'type': tipo, 'name': nome, 'steam_appid': int(appid), 'required_age': 0, 'is_free': False,
        'short_description': descricao,
        'header_image': f'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg',
        'developers': list(desenvolvedoras), 'publishers': list(publicadoras),
        'platforms': plataformas or {'windows': True, 'mac': False, 'linux': False},
        'categories': [{'id': c, 'description': f'categoria {c}'} for c in categorias],
        'genres': [{'id': i, 'description': d} for i, d in generos],
        'release_date': {'coming_soon': em_breve, 'date': data},
    }}}



class AniListFalso:
    """`Page.media` do AniList em memória para a Importação: `post` como o GraphQL público.

    `obras` é [(id, popularidade)] por Tipo (`ANIME`/`MANGA`). Entende os argumentos que a
    Importação manda (`sort` [POPULARITY_DESC, ID] ou [ID], `popularity`, `popularity_lesser`) e
    recusa com o 400 de limite a página acima de `limite`, como a API pública acima de 100.
    `falha_em`: chamadas (contadas de 1) que respondem 502. Guarda as variáveis em `pedidos`.
    """

    def __init__(self, obras, limite=100, falha_em=()):
        self.obras = {tipo: list(lista) for tipo, lista in obras.items()}
        self.limite = limite
        self.falha_em = set(falha_em)
        self.pedidos: list[dict] = []

    @staticmethod
    def media(id_anilist, popularidade):
        return {'id': id_anilist, 'popularity': popularidade, 'title': {'romaji': f'Obra {id_anilist}'},
                'genres': []}

    def post(self, url, json=None, timeout=None):
        variaveis = dict(json['variables'])
        self.pedidos.append(variaveis)
        if len(self.pedidos) > 200:
            raise KeyboardInterrupt('AniList chamado demais: laço sem limite')
        if len(self.pedidos) in self.falha_em:
            return Resposta(502, {'errors': [{'message': 'Bad Gateway', 'status': 502}], 'data': None})
        pagina, por_pagina = variaveis['page'], variaveis['perPage']
        if pagina > self.limite:
            return Resposta(400, {'errors': [{
                'message': 'Page exceeds maximum allowed for public API requests', 'status': 400,
            }], 'data': None})
        obras = self.obras[variaveis['tipo']]
        if 'popularity' in variaveis:
            obras = [o for o in obras if o[1] == variaveis['popularity']]
        if 'popularityLesser' in variaveis:
            obras = [o for o in obras if o[1] < variaveis['popularityLesser']]
        if variaveis['sort'] == ['POPULARITY_DESC', 'ID']:
            obras = sorted(obras, key=lambda o: (-o[1], o[0]))
        elif variaveis['sort'] == ['ID']:
            obras = sorted(obras)
        else:
            raise AssertionError(f'sort inesperado: {variaveis["sort"]}')
        inicio = (pagina - 1) * por_pagina
        fatia = obras[inicio:inicio + por_pagina]
        return Resposta(200, {'data': {'Page': {
            'pageInfo': {'hasNextPage': inicio + por_pagina < len(obras)},
            'media': [self.media(*o) for o in fatia],
        }}})

    def close(self):
        pass
