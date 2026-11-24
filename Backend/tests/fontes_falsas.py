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


class SessaoGet:
    """Responde cada GET por `rotas`: {regex do caminho: corpo | Resposta | Exception | callable(params)}.

    Guarda (url, params) de cada chamada em `chamadas`.
    """

    def __init__(self, rotas: dict):
        self.rotas = rotas
        self.chamadas: list[tuple[str, dict]] = []
        self.timeouts: list[float | None] = []

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
