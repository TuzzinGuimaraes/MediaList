"""Prazo total de uma requisição das Integrações (a função da Vercel morre em 300 s).

A rota abre `na_requisicao()`; dentro dela, toda chamada às plataformas confere o prazo antes
(`conferir`) e usa timeout e retries curtos (`timeout`, `retries`). Fora de uma requisição
(o job diário da Steam) não há prazo, e valem os timeouts e retries longos de cada plataforma.

Prazo vencido levanta `TempoEsgotado`, um `OrigemIndisponivel`: a rota responde 502 com a
mensagem, e a sincronização da Steam deixa o resto como pendente.
"""
from __future__ import annotations

import os
import time
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

from integracoes.plataforma import OrigemIndisponivel

#: Prazo total de uma requisição, em segundos (`INTEGRACOES_PRAZO_SEGUNDOS`; folga até os 300 s).
PRAZO_SEGUNDOS = float(os.getenv('INTEGRACOES_PRAZO_SEGUNDOS') or 240)
#: Timeout de cada chamada feita dentro da requisição, em segundos.
TIMEOUT_NA_REQUISICAO = 10.0
#: Retries de cada chamada feita dentro da requisição (e o backoff entre eles).
RETRIES_NA_REQUISICAO = 1
BACKOFF_NA_REQUISICAO = 0.5

MENSAGEM = 'A plataforma demorou demais para responder. Tente de novo em alguns minutos.'

#: Relógio do prazo (os testes trocam).
relogio = time.monotonic

_fim: ContextVar[float | None] = ContextVar('integracoes_prazo_fim', default=None)


class TempoEsgotado(OrigemIndisponivel):
    """O prazo da requisição acabou antes de terminar de falar com a plataforma."""


@contextmanager
def na_requisicao(segundos: float | None = None) -> Iterator[None]:
    """Abre o prazo da requisição (`PRAZO_SEGUNDOS` se não informado)."""
    token = _fim.set(relogio() + (PRAZO_SEGUNDOS if segundos is None else segundos))
    try:
        yield
    finally:
        _fim.reset(token)


def em_requisicao() -> bool:
    return _fim.get() is not None


def restante() -> float | None:
    """Segundos até o fim do prazo; None fora de uma requisição."""
    fim = _fim.get()
    return None if fim is None else fim - relogio()


def conferir() -> None:
    """Levanta TempoEsgotado se o prazo da requisição acabou."""
    sobra = restante()
    if sobra is not None and sobra <= 0:
        raise TempoEsgotado(MENSAGEM)


def timeout(longo: float) -> float:
    """O timeout da próxima chamada: `longo` fora da requisição; dentro, até 10 s e o que sobra do prazo."""
    sobra = restante()
    if sobra is None:
        return longo
    return max(1.0, min(TIMEOUT_NA_REQUISICAO, sobra))


def retries(longos: int, backoff_longo: float) -> tuple[int, float]:
    """(retries, backoff) da sessão HTTP: curtos dentro da requisição, os longos fora."""
    if em_requisicao():
        return RETRIES_NA_REQUISICAO, BACKOFF_NA_REQUISICAO
    return longos, backoff_longo


def sessao_http(longos: int, backoff_longo: float):
    """Sessão HTTP com os retries do contexto (`importacao.utils.criar_sessao_http`)."""
    from importacao.utils import criar_sessao_http

    total, backoff = retries(longos, backoff_longo)
    return criar_sessao_http(total_retries=total, backoff_factor=backoff)
