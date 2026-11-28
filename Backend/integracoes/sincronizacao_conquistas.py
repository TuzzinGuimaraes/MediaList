"""Leitura das conquistas na sincronização da Steam (spec `conquistas-steam`), depois das horas.

Lê só os jogos que precisam, comparando as horas da Steam de agora com as da última leitura de
conquistas daquele Item:
- no job diário (`todos=True`), o jogo nunca lido (o novo também) e o de horas que subiram;
- no "Sincronizar agora", só o de horas que subiram, enquanto `ha_orcamento()`; o resto fica
  para o job diário.

Cada jogo pede as conquistas do perfil; com conquistas, o esquema (só quando falta ou o total
mudou) e a raridade (a cada leitura). Tudo do jogo é gravado numa transação, depois das chamadas.
Jogo sem stats grava total 0 (sem resumo, e só volta a ser lido se as horas subirem); detalhes de
jogo privados não gravam nada. A falha de um jogo (a Steam fora do ar, ou um erro inesperado ao
ler ou gravar) mantém a leitura anterior, não para os outros e vai para o log; o erro inesperado
vai também para o jsonl de erros no job diário (no "Sincronizar agora", só o log). O orçamento ou o
prazo esgotado para a leitura.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Callable

import banco
from importacao.utils import registrar_falha_importacao
from integracoes import conquistas, prazo
from integracoes.plataforma import OrigemIndisponivel
from integracoes.steam import Steam

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class Jogo:
    """Um jogo da sincronização, já casado com uma Mídia do Catálogo, com as horas da Steam."""

    appid: int
    id_midia: str
    horas: int


class _SemOrcamento(Exception):
    """O orçamento do "Sincronizar agora" acabou antes de uma chamada."""


def _precisa(leitura: dict, horas: int, todos: bool) -> bool:
    if leitura['horas_lidas'] is None:
        return todos
    return horas > leitura['horas_lidas']


def _ler_jogo(steam: Steam, steamid: str, appid: int, id_lista: str, horas: int,
              antes_de_chamar: Callable[[], None]) -> None:
    antes_de_chamar()
    lidas = steam.conquistas(steamid, appid)
    if lidas is None:
        return  # detalhes de jogo privados: sem dado, fica o anterior
    esquema = raridades = None
    if lidas.total:
        if conquistas.total_do_esquema(appid) != lidas.total:
            antes_de_chamar()
            esquema = steam.esquema(appid)
        antes_de_chamar()
        raridades = steam.raridades(appid)
    with banco.transacao() as t:
        conquistas.gravar_esquema(t, appid, lidas.total, esquema)
        if raridades is not None:
            conquistas.gravar_raridades(t, appid, raridades)
        conquistas.gravar_do_item(t, id_lista, appid, lidas.total, horas, lidas.obtidas)


def atualizar(steam: Steam, steamid: str, id_usuario: str, jogos: list[Jogo], *, todos: bool,
              ha_orcamento: Callable[[], bool] = lambda: True) -> int:
    """Lê as conquistas dos jogos que precisam (ver o módulo); devolve quantos falharam."""
    try:
        itens = conquistas.itens_de_jogo(id_usuario, sorted({jogo.id_midia for jogo in jogos}))
    except Exception as exc:
        _registrar_erro(exc, todos, id_usuario=id_usuario)
        return len(jogos)

    def antes_de_chamar() -> None:
        if not ha_orcamento():
            raise _SemOrcamento

    falhas = 0
    lidos: set[str] = set()
    for jogo in jogos:
        item = itens.get(jogo.id_midia)
        if item is None or item['id_lista'] in lidos or not _precisa(item, jogo.horas, todos):
            continue
        lidos.add(item['id_lista'])
        try:
            _ler_jogo(steam, steamid, jogo.appid, item['id_lista'], jogo.horas, antes_de_chamar)
        except (_SemOrcamento, prazo.TempoEsgotado):
            break
        except OrigemIndisponivel as exc:
            falhas += 1
            logger.warning('Conquistas da appid %s não lidas: %s', jogo.appid, exc)
        except Exception as exc:
            falhas += 1
            _registrar_erro(exc, todos, id_usuario=id_usuario, appid=jogo.appid)
    return falhas


def _registrar_erro(exc: Exception, todos: bool, *, id_usuario: str, appid: int | None = None) -> None:
    """O erro inesperado vai para o log; no job diário (`todos`), também para o jsonl de erros, como o
    `job_steam` faz. No "Sincronizar agora" (a Vercel) não há onde gravar o arquivo."""
    if todos:
        registrar_falha_importacao(tipo_midia='jogo', origem='Steam', exc=exc, identificador=appid,
                                   titulo='conquistas_steam', extra={'id_usuario': id_usuario})
    else:
        logger.exception('Conquistas da appid %s (Usuário %s) não lidas por erro inesperado.', appid, id_usuario)
