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

As conquistas de um jogo (`conquistas`, `esquema`, `raridades`) vêm de `ISteamUserStats`:
`GetPlayerAchievements` (as do perfil, com a data em Unix, 0 se não obtida), `GetSchemaForGame` v2
(nome, descrição, ícones e oculta, em `l=brazilian`; a Steam cai para o inglês sem tradução) e
`GetGlobalAchievementPercentagesForApp` v2 (a raridade, sem a chave, com o percentual em texto).
Quem decide quando ler é a `integracoes.sincronizacao_conquistas`.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone

from config import STEAM_API_KEY, STEAM_API_URL
from importacao.importar_jogos import HOSTS_DE_IMAGEM_STEAM
from importacao.utils import imagem_https, ocultar_segredos, truncar
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

    def _pedir(self, metodo: str, params: dict, *, com_chave: bool = True) -> tuple[int, dict]:
        """(status HTTP, corpo JSON) de um método da Steam Web API; corpo `{}` se o de erro não for JSON.

        A resposta 200 que não é um objeto JSON e a falha de rede levantam OrigemIndisponivel.
        """
        prazo.conferir()
        sessao = self._sessao or prazo.sessao_http(1, 0.5)
        try:
            resposta = sessao.get(
                f'{STEAM_API_URL}/{metodo}', params={**({'key': self.chave} if com_chave else {}), **params},
                timeout=prazo.timeout(20),
            )
            if resposta.status_code == 200:
                corpo = resposta.json() or {}
                if not isinstance(corpo, dict):
                    raise ValueError(f'{metodo} respondeu algo que não é um objeto')
                return 200, corpo
            try:
                corpo = resposta.json()
            except Exception:
                corpo = None
            return resposta.status_code, corpo if isinstance(corpo, dict) else {}
        except Exception as exc:
            # `from None`: a exceção original (com a URL e a chave) não segue encadeada.
            logger.warning('Steam sem resposta: %s', ocultar_segredos(str(exc)))
            raise OrigemIndisponivel(MENSAGEM_INDISPONIVEL) from None
        finally:
            if self._sessao is None:
                sessao.close()

    def _get(self, metodo: str, params: dict) -> dict:
        status, corpo = self._pedir(metodo, params)
        if status != 200:
            raise _sem_resposta(metodo, status)
        return corpo.get('response') or {}

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


    # ============================================
    # Conquistas (spec `conquistas-steam`)
    # ============================================

    def conquistas(self, steamid: str, appid: int) -> ConquistasDoJogador | None:
        """As conquistas do jogo para o perfil (`GetPlayerAchievements`), ou None se a Steam não dá o dado.

        Jogo sem stats (HTTP 400, "Requested app has no stats") é um jogo sem conquistas (total 0).
        Qualquer outro `success: false` (os detalhes de jogo privados) é None: sem dado, sem falha.
        Outra resposta de erro levanta OrigemIndisponivel.
        """
        metodo = 'ISteamUserStats/GetPlayerAchievements/v1/'
        status, corpo = self._pedir(metodo, {'steamid': steamid, 'appid': appid, 'l': 'brazilian'})
        stats = corpo.get('playerstats')
        stats = stats if isinstance(stats, dict) else {}
        if stats.get('success') is False:
            return SEM_CONQUISTAS if stats.get('error') == ERRO_SEM_STATS else None
        if status != 200 or stats.get('success') is not True:
            raise _sem_resposta(metodo, status)
        obtidas: dict[str, datetime | None] = {}
        total = 0
        for conquista in _lista(stats.get('achievements'))[:MAXIMO_CONQUISTAS]:
            codigo = _codigo(conquista.get('apiname'))
            if codigo is None:
                continue
            total += 1
            if conquista.get('achieved') == 1:
                obtidas[codigo] = _instante(conquista.get('unlocktime'))
        return ConquistasDoJogador(total, obtidas)

    def esquema(self, appid: int) -> list[dict]:
        """As conquistas do jogo (`GetSchemaForGame`, em português quando a Steam tem a tradução):
        código, nome, descrição (vazia nas ocultas), ícones `https://` da Steam e se é oculta."""
        metodo = 'ISteamUserStats/GetSchemaForGame/v2/'
        status, corpo = self._pedir(metodo, {'appid': appid, 'l': 'brazilian'})
        if status != 200:
            raise _sem_resposta(metodo, status)
        jogo = corpo.get('game') if isinstance(corpo.get('game'), dict) else {}
        estatisticas = jogo.get('availableGameStats') if isinstance(jogo.get('availableGameStats'), dict) else {}
        esquema = []
        for conquista in _lista(estatisticas.get('achievements'))[:MAXIMO_CONQUISTAS]:
            codigo = _codigo(conquista.get('name'))
            if codigo is None:
                continue
            esquema.append({
                'codigo': codigo,
                'nome': _texto(conquista.get('displayName'), MAXIMO_NOME) or codigo,
                'descricao': _texto(conquista.get('description'), MAXIMO_DESCRICAO),
                'icone': imagem_https(conquista.get('icon'), HOSTS_DE_IMAGEM_STEAM),
                'icone_cinza': imagem_https(conquista.get('icongray'), HOSTS_DE_IMAGEM_STEAM),
                'oculta': conquista.get('hidden') == 1,
            })
        return esquema

    def raridades(self, appid: int) -> dict[str, float]:
        """% dos jogadores que têm cada conquista (`GetGlobalAchievementPercentagesForApp`, sem a chave).

        A Steam manda o percentual como texto; o que não for um número de 0 a 100 fica de fora.
        """
        metodo = 'ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/'
        status, corpo = self._pedir(metodo, {'gameid': appid}, com_chave=False)
        if status != 200:
            raise _sem_resposta(metodo, status)
        percentuais = corpo.get('achievementpercentages')
        percentuais = percentuais if isinstance(percentuais, dict) else {}
        raridades = {}
        for conquista in _lista(percentuais.get('achievements'))[:MAXIMO_CONQUISTAS]:
            codigo = _codigo(conquista.get('name'))
            try:
                percentual = float(conquista.get('percent'))
            except (TypeError, ValueError):
                continue
            if codigo is not None and 0 <= percentual <= 100:
                raridades[codigo] = percentual
        return raridades


#: `playerstats.error` de jogo sem conquistas.
ERRO_SEM_STATS = 'Requested app has no stats'
#: Tetos do que vem da Steam.
MAXIMO_CONQUISTAS = 5000
MAXIMO_CODIGO = 200
MAXIMO_NOME = 200
MAXIMO_DESCRICAO = 500


@dataclass(frozen=True)
class ConquistasDoJogador:
    """O total de conquistas do jogo e as obtidas pelo perfil (código → quando; None se a Steam não diz)."""

    total: int
    obtidas: dict[str, datetime | None]


#: Jogo sem conquistas.
SEM_CONQUISTAS = ConquistasDoJogador(0, {})


def _sem_resposta(metodo: str, status: int) -> OrigemIndisponivel:
    """Vai para o log e dá o erro que a Steam fora do ar levanta (o método e o status, nunca a URL com a chave)."""
    logger.warning('Steam sem resposta: %s respondeu %s', metodo, status)
    return OrigemIndisponivel(MENSAGEM_INDISPONIVEL)


def _lista(valor) -> list[dict]:
    return [v for v in valor if isinstance(v, dict)] if isinstance(valor, list) else []


def _codigo(valor) -> str | None:
    return valor if isinstance(valor, str) and 0 < len(valor) <= MAXIMO_CODIGO else None


def _texto(valor, teto: int) -> str | None:
    return truncar(valor.strip(), teto) or None if isinstance(valor, str) else None


def _instante(unix) -> datetime | None:
    if not isinstance(unix, int) or unix <= 0:
        return None
    return datetime.fromtimestamp(unix, tz=timezone.utc)
