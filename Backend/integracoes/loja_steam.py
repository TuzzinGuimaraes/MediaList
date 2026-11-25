"""Loja da Steam: o fallback dos jogos que o RAWG não reconhece (spec `nao-encontrados`, Q115).

`GET store.steampowered.com/api/appdetails?appids=<appid>&l=portuguese` é público (sem chave) e
responde `{"<appid>": {"success": true, "data": {...}}}`; appid que a loja não tem (ou tirou do
ar) vem com `success: false`. `data.type` diz o que é: `game`, `dlc`, `music`, `application`,
`demo`... (a sincronização só cria Mídia de `game`). A loja limita as chamadas (cerca de 200 a
cada 5 minutos) e responde 429 ao passar: vira `OrigemIndisponivel`, e o jogo fica pendente.

O `steam_appid` do `data` é sempre o pedido (a loja às vezes responde por outra appid). A capa
vertical (`library_600x900.jpg` no CDN) não vem no `appdetails` e nem todo jogo a tem:
`capa_vertical` confirma por um HEAD rápido (no CDN, fora do limite da loja; só para o jogo que
vai ser criado) e, sem resposta 200 dentro do orçamento, fica a `header_image`.
"""
from __future__ import annotations

import logging
from typing import Any, Callable

from config import STEAM_STORE_URL
from integracoes import prazo
from integracoes.plataforma import OrigemIndisponivel

logger = logging.getLogger(__name__)

MENSAGEM_INDISPONIVEL = 'A loja da Steam não respondeu agora.'

#: A capa vertical do jogo no CDN da Steam (600x900).
CAPA_VERTICAL = 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{appid}/library_600x900.jpg'
#: Segundos do HEAD da capa vertical: é enfeite, não pode segurar a sincronização.
TIMEOUT_CAPA = 3


class LojaSteam:
    def __init__(self, sessao=None, antes_de_chamar: Callable[[], None] | None = None):
        """`sessao` é um `requests.Session` (os testes passam uma falsa).

        `antes_de_chamar` roda antes de cada GET (o orçamento da sincronização levanta por ele);
        o prazo da requisição (`integracoes.prazo`) também é conferido antes de cada GET.
        """
        self._sessao = sessao
        self._antes_de_chamar = antes_de_chamar

    def detalhes(self, appid: int | str) -> dict[str, Any] | None:
        """O `data` da appid na loja, ou None se a loja não a tem (`success: false`)."""
        if self._antes_de_chamar is not None:
            self._antes_de_chamar()
        prazo.conferir()
        if self._sessao is None:
            self._sessao = prazo.sessao_http(2, 1.0)
        try:
            resposta = self._sessao.get(
                f'{STEAM_STORE_URL}/api/appdetails', params={'appids': int(appid), 'l': 'portuguese'},
                timeout=prazo.timeout(20),
            )
            if resposta.status_code != 200:
                raise OrigemIndisponivel(f'appdetails respondeu {resposta.status_code}')
            corpo = resposta.json()
        except Exception as exc:
            logger.warning('Loja da Steam sem resposta para %s: %s', appid, exc)
            raise OrigemIndisponivel(MENSAGEM_INDISPONIVEL) from None
        app = (corpo or {}).get(str(int(appid))) if isinstance(corpo, dict) else None
        if not isinstance(app, dict) or not app.get('success') or not isinstance(app.get('data'), dict):
            return None
        return {**app['data'], 'steam_appid': int(appid)}

    def capa_vertical(self, appid: int | str) -> str | None:
        """A URL da capa vertical se o CDN confirma (HEAD 200); None se não tem, falhou ou sem orçamento."""
        url = CAPA_VERTICAL.format(appid=int(appid))
        try:
            if self._antes_de_chamar is not None:
                self._antes_de_chamar()
            prazo.conferir()
            if self._sessao is None:
                self._sessao = prazo.sessao_http(2, 1.0)
            resposta = self._sessao.head(url, timeout=min(prazo.timeout(TIMEOUT_CAPA), TIMEOUT_CAPA),
                                         allow_redirects=False)
        except Exception as exc:
            logger.info('Capa vertical da appid %s sem confirmação: %s', appid, exc)
            return None
        return url if resposta.status_code == 200 else None

    def fechar(self) -> None:
        if self._sessao is not None:
            self._sessao.close()
