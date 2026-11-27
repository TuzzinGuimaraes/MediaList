"""Casamento de um jogo da Steam com o RAWG (Q109): sem palpite, só pela loja.

`casar(appid, nome)` busca o nome em `GET /games?search=` e aceita o primeiro resultado cuja
lista de lojas (`GET /games/<slug>/stores`, a que traz as URLs) tem
`store.steampowered.com/app/<appid>` com o mesmo appid. Os resultados da busca já dizem
quais lojas o jogo tem (`stores[].store.slug`), então só os que estão na Steam são conferidos.
`detalhe(slug)` traz o jogo inteiro (`GET /games/<slug>`), o que a Importação grava, e
`serie(slug)` os jogos da mesma série (`GET /games/<slug>/game-series`, até 80).

A chave vai em `key=`; as mensagens de erro passam por `ocultar_segredos`.
"""
from __future__ import annotations

import logging
import re
from typing import Callable
from urllib.parse import quote

from importacao import relacoes
from importacao.config import RAWG_API_KEY, RAWG_BASE_URL
from importacao.utils import ocultar_segredos
from integracoes import prazo
from integracoes.plataforma import OrigemIndisponivel

logger = logging.getLogger(__name__)

#: Quantos resultados da busca que estão na Steam são conferidos, no máximo.
CANDIDATOS = 3

MENSAGEM_INDISPONIVEL = 'O RAWG não respondeu agora.'


def _na_steam(resultado: dict) -> bool:
    return any(((s or {}).get('store') or {}).get('slug') == 'steam' for s in resultado.get('stores') or [])


def _caminho_do_jogo(slug: str, resto: str = '') -> str:
    """`/games/<slug><resto>` com o slug (que vem da busca) escapado: não sai do path."""
    return f"/games/{quote(str(slug), safe='')}{resto}"


class Rawg:
    def __init__(self, sessao=None, chave: str | None = None, antes_de_chamar: Callable[[], None] | None = None):
        """`sessao` é um `requests.Session` (os testes passam uma falsa); `chave` padrão: `RAWG_API_KEY`.

        `antes_de_chamar` roda antes de cada GET (o orçamento da Steam levanta por ele); o prazo
        da requisição (`integracoes.prazo`) também é conferido antes de cada GET.
        """
        self._sessao = sessao
        self._chave = chave
        self._antes_de_chamar = antes_de_chamar

    @property
    def chave(self) -> str:
        return RAWG_API_KEY if self._chave is None else self._chave

    def disponivel(self) -> bool:
        return bool(self.chave)

    def _get(self, caminho: str, params: dict | None = None) -> dict | None:
        """O JSON da resposta; None no 404."""
        if self._antes_de_chamar is not None:
            self._antes_de_chamar()
        prazo.conferir()
        if self._sessao is None:
            self._sessao = prazo.sessao_http(2, 1.0)
        try:
            resposta = self._sessao.get(
                f'{RAWG_BASE_URL}{caminho}', params={'key': self.chave, **(params or {})},
                timeout=prazo.timeout(20),
            )
            if resposta.status_code == 404:
                return None
            if resposta.status_code != 200:
                raise OrigemIndisponivel(f'{caminho} respondeu {resposta.status_code}')
            return resposta.json() or {}
        except Exception as exc:
            logger.warning('RAWG sem resposta: %s', ocultar_segredos(str(exc)))
            raise OrigemIndisponivel(MENSAGEM_INDISPONIVEL) from None

    def casar(self, appid: int | str, nome: str) -> str | None:
        """O slug do jogo no RAWG que vende este appid na Steam, ou None (sem palpite)."""
        loja = re.compile(rf'store\.steampowered\.com/app/{int(appid)}(?:\D|$)')
        busca = self._get('/games', {'search': nome, 'page_size': 10}) or {}
        candidatos = [r for r in busca.get('results') or [] if r.get('slug') and _na_steam(r)]
        for candidato in candidatos[:CANDIDATOS]:
            lojas = self._get(_caminho_do_jogo(candidato['slug'], '/stores')) or {}
            if any(loja.search(str(s.get('url') or '')) for s in lojas.get('results') or []):
                return candidato['slug']
        return None

    def detalhe(self, slug: str) -> dict | None:
        return self._get(_caminho_do_jogo(slug))

    def serie(self, slug: str) -> list[dict]:
        """Os jogos de `GET /games/<slug>/game-series` (`relacoes.ler_serie`, até 80)."""
        return relacoes.ler_serie(lambda params: self._get(_caminho_do_jogo(slug, '/game-series'), params))

    def fechar(self) -> None:
        if self._sessao is not None:
            self._sessao.close()
