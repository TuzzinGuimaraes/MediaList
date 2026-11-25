"""Steam: jogos com horas do perfil público, pela Steam Web API (`STEAM_API_KEY`, sem OAuth).

O Usuário informa a URL do perfil (`steamcommunity.com/id/<vanity>` ou `/profiles/<SteamID64>`),
o SteamID64 puro ou só o vanity. O vanity vira SteamID64 por `ISteamUser/ResolveVanityURL`;
`ISteamUser/GetPlayerSummaries` diz se o perfil existe e é público
(`communityvisibilitystate` 3); `IPlayerService/GetOwnedGames` (`include_appinfo`,
`include_played_free_games`) traz os jogos com `playtime_forever` em minutos e
`rtime_last_played` (Unix; 0 ou ausente quando a Steam não informa). Com os "Detalhes dos
jogos" privados, `GetOwnedGames` devolve `{"response": {}}`: também é perfil privado.

Os itens saem sem `catalogo`: o casamento com o Catálogo (por `steam_appids` ou pelo RAWG)
é da `integracoes.sincronizacao_steam`. A chave vai na query string (`key=`), então toda
mensagem de erro passa por `ocultar_segredos` antes de ir para o log ou para a exceção.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from config import STEAM_API_KEY, STEAM_API_URL
from importacao.utils import ocultar_segredos
from integracoes import prazo
from integracoes.plataforma import (
    Conta,
    ItemDeOrigem,
    OrigemIndisponivel,
    PerfilNaoEncontrado,
    PerfilPrivado,
)

logger = logging.getLogger(__name__)

#: `communityvisibilitystate` de perfil público.
PUBLICO = 3

_STEAMID = re.compile(r'^\d{17}$')
_URL_PROFILES = re.compile(r'steamcommunity\.com/profiles/(\d{17})(?:[/?#]|$)', re.IGNORECASE)
_URL_ID = re.compile(r'steamcommunity\.com/id/([^/?#\s]+)', re.IGNORECASE)
_VANITY = re.compile(r'^[A-Za-z0-9_-]{2,32}$')

MENSAGEM_PRIVADO = (
    'O perfil da Steam é privado. Na Steam, em Editar perfil > Configurações de privacidade, deixe '
    '"Meu perfil" e "Detalhes dos jogos" como Público e tente de novo.'
)
MENSAGEM_NAO_ENCONTRADO = (
    'Nenhum perfil da Steam com essa URL. Use o endereço do perfil, como steamcommunity.com/id/fulano.'
)
MENSAGEM_INDISPONIVEL = 'A Steam não respondeu agora. Tente de novo em alguns minutos.'


def horas_de(minutos: int | None) -> int:
    """`playtime_forever` (minutos) em horas inteiras, arredondando a meia hora para cima.

    Jogo aberto (minutos > 0) tem pelo menos 1 hora (Q111b): 10 minutos não somem da Lista.
    """
    minutos = max(minutos or 0, 0)
    return max(1, (minutos + 30) // 60) if minutos else 0


def link_da_loja(appid: int | str) -> str:
    return f'https://store.steampowered.com/app/{appid}'


def _data(unix: int | None) -> str | None:
    if not unix:
        return None
    return datetime.fromtimestamp(unix, tz=timezone.utc).date().isoformat()


def _referencia(identificador: str) -> tuple[str, str]:
    """('steamid', SteamID64) ou ('vanity', nome) do que o Usuário digitou."""
    texto = (identificador or '').strip()
    if _STEAMID.match(texto):
        return 'steamid', texto
    url = _URL_PROFILES.search(texto)
    if url:
        return 'steamid', url.group(1)
    url = _URL_ID.search(texto)
    if url:
        texto = url.group(1)
    if _VANITY.match(texto):
        return 'vanity', texto
    raise PerfilNaoEncontrado(MENSAGEM_NAO_ENCONTRADO)


class Steam:
    """Plataforma `steam` (ver `integracoes.plataforma.Plataforma`)."""

    nome = 'steam'
    rotulo = 'Steam'

    def __init__(self, sessao=None, chave: str | None = None):
        """`sessao` é um `requests.Session` (os testes passam uma falsa); `chave` padrão: `STEAM_API_KEY`."""
        self._sessao = sessao
        self._chave = chave

    @property
    def chave(self) -> str:
        return STEAM_API_KEY if self._chave is None else self._chave

    def disponivel(self) -> bool:
        return bool(self.chave)

    def _get(self, metodo: str, params: dict) -> dict:
        prazo.conferir()
        sessao = self._sessao or prazo.sessao_http(1, 0.5)
        try:
            resposta = sessao.get(
                f'{STEAM_API_URL}/{metodo}', params={'key': self.chave, **params}, timeout=prazo.timeout(20),
            )
            if resposta.status_code != 200:
                raise OrigemIndisponivel(f'{metodo} respondeu {resposta.status_code}')
            return (resposta.json() or {}).get('response') or {}
        except Exception as exc:
            # `from None`: a exceção original (com a URL e a chave) não segue encadeada.
            logger.warning('Steam sem resposta: %s', ocultar_segredos(str(exc)))
            raise OrigemIndisponivel(MENSAGEM_INDISPONIVEL) from None
        finally:
            if self._sessao is None:
                sessao.close()

    def _steamid(self, identificador: str) -> str:
        tipo, valor = _referencia(identificador)
        if tipo == 'steamid':
            return valor
        resposta = self._get('ISteamUser/ResolveVanityURL/v1/', {'vanityurl': valor})
        if resposta.get('success') != 1 or not resposta.get('steamid'):
            raise PerfilNaoEncontrado(MENSAGEM_NAO_ENCONTRADO)
        return str(resposta['steamid'])

    def _jogos(self, steamid: str) -> list[dict]:
        resposta = self._get('IPlayerService/GetOwnedGames/v1/', {
            'steamid': steamid, 'include_appinfo': 1, 'include_played_free_games': 1, 'format': 'json',
        })
        if not resposta:
            raise PerfilPrivado(MENSAGEM_PRIVADO)
        return resposta.get('games') or []

    def conectar(self, identificador: str) -> Conta:
        steamid = self._steamid(identificador)
        jogadores = self._get('ISteamUser/GetPlayerSummaries/v2/', {'steamids': steamid}).get('players') or []
        if not jogadores:
            raise PerfilNaoEncontrado(MENSAGEM_NAO_ENCONTRADO)
        if jogadores[0].get('communityvisibilitystate') != PUBLICO:
            raise PerfilPrivado(MENSAGEM_PRIVADO)
        self._jogos(steamid)
        return Conta(steamid, jogadores[0].get('personaname') or steamid)

    def ler(self, conta: Conta) -> list[ItemDeOrigem]:
        """Os jogos já abertos (`playtime_forever` > 0, Q111b): biblioteca nunca aberta não lota a Lista."""
        itens = []
        for jogo in self._jogos(conta.identificador):
            horas = horas_de(jogo.get('playtime_forever'))
            if horas <= 0 or not jogo.get('appid'):
                continue
            appid = str(jogo['appid'])
            itens.append(ItemDeOrigem(
                origem_id=appid,
                tipo='jogo',
                titulo=jogo.get('name') or f'Steam {appid}',
                link=link_da_loja(appid),
                horas=horas,
                jogado_em=_data(jogo.get('rtime_last_played')),
            ))
        return itens
