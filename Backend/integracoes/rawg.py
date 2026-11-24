"""Casamento de um jogo da Steam com o RAWG (Q109): sem palpite, só pela loja.

`casar(appid, nome)` busca o nome em `GET /games?search=` e aceita o primeiro resultado cuja
lista de lojas (`GET /games/<slug>/stores`, a que traz as URLs) tem
`store.steampowered.com/app/<appid>` com o mesmo appid. Os resultados da busca já dizem
quais lojas o jogo tem (`stores[].store.slug`), então só os que estão na Steam são conferidos.
`detalhe(slug)` traz o jogo inteiro (`GET /games/<slug>`), o que a Importação grava.

A chave vai em `key=`; as mensagens de erro passam por `ocultar_segredos`.
"""
from __future__ import annotations

import logging
import re

from importacao.config import RAWG_API_KEY, RAWG_BASE_URL
from importacao.utils import criar_sessao_http, ocultar_segredos
from integracoes.plataforma import OrigemIndisponivel

logger = logging.getLogger(__name__)

#: Quantos resultados da busca que estão na Steam são conferidos, no máximo.
CANDIDATOS = 3

MENSAGEM_INDISPONIVEL = 'O RAWG não respondeu agora.'


class Rawg:
    def __init__(self, sessao=None, chave: str | None = None):
        """`sessao` é um `requests.Session` (os testes passam uma falsa); `chave` padrão: `RAWG_API_KEY`."""
        self._sessao = sessao
        self._chave = chave

    @property
    def chave(self) -> str:
        return RAWG_API_KEY if self._chave is None else self._chave

    def disponivel(self) -> bool:
        return bool(self.chave)

    def _get(self, caminho: str, params: dict | None = None) -> dict | None:
        """O JSON da resposta; None no 404."""
        if self._sessao is None:
            self._sessao = criar_sessao_http(total_retries=2, backoff_factor=1.0)
        try:
            resposta = self._sessao.get(
                f'{RAWG_BASE_URL}{caminho}', params={'key': self.chave, **(params or {})}, timeout=20,
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
        candidatos = [
            r for r in busca.get('results') or []
            if r.get('slug') and any(((s or {}).get('store') or {}).get('slug') == 'steam' for s in r.get('stores') or [])
        ]
        for candidato in candidatos[:CANDIDATOS]:
            lojas = self._get(f"/games/{candidato['slug']}/stores") or {}
            if any(loja.search(str(s.get('url') or '')) for s in lojas.get('results') or []):
                return candidato['slug']
        return None

    def detalhe(self, slug: str) -> dict | None:
        return self._get(f'/games/{slug}')

    def fechar(self) -> None:
        if self._sessao is not None:
            self._sessao.close()
