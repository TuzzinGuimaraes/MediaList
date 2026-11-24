"""Status e nota das plataformas no vocabulário do MediaList (Q114), num ponto só.

- Status de AniList (`MediaListStatus`), MAL API v2 e XML do MAL → Estado de consumo.
  `REPEATING` é Em progresso sem mexer na Recontagem (ADR 0003): quem chama não soma nada.
- Nota: AniList pedida em `score(format: POINT_10_DECIMAL)` (0..10, uma casa); MAL de 1 a
  10 inteiros. 0 é "sem nota" nas duas.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from schemas.estado_consumo import ABANDONADO, CONCLUIDO, EM_PROGRESSO, PAUSADO, PLANEJADO

_ESTADOS = {
    # AniList
    'CURRENT': EM_PROGRESSO,
    'REPEATING': EM_PROGRESSO,
    'PLANNING': PLANEJADO,
    'COMPLETED': CONCLUIDO,
    'PAUSED': PAUSADO,
    'DROPPED': ABANDONADO,
    # MAL API v2 (`list_status.status`)
    'watching': EM_PROGRESSO,
    'reading': EM_PROGRESSO,
    'plan_to_watch': PLANEJADO,
    'plan_to_read': PLANEJADO,
    'completed': CONCLUIDO,
    'on_hold': PAUSADO,
    'dropped': ABANDONADO,
    # XML exportado do MAL (`my_status`)
    'Watching': EM_PROGRESSO,
    'Reading': EM_PROGRESSO,
    'Plan to Watch': PLANEJADO,
    'Plan to Read': PLANEJADO,
    'Completed': CONCLUIDO,
    'On-Hold': PAUSADO,
    'Dropped': ABANDONADO,
}


def estado_da_origem(status: str | None) -> str | None:
    """Estado de consumo do status da plataforma, ou None se desconhecido."""
    return _ESTADOS.get(status) if status else None


def _nota(valor, minimo: Decimal, maximo: Decimal) -> float | None:
    if valor is None or isinstance(valor, bool):
        return None
    try:
        nota = Decimal(str(valor)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
    except InvalidOperation:
        return None
    if nota == 0 or not minimo <= nota <= maximo:
        return None
    return float(nota)


def nota_anilist(score) -> float | None:
    """`score(format: POINT_10_DECIMAL)` do AniList; 0 é sem nota."""
    return _nota(score, Decimal('0.1'), Decimal('10'))


def nota_mal(score) -> float | None:
    """Nota do MAL (1 a 10); 0 é sem nota."""
    return _nota(score, Decimal('1'), Decimal('10'))
