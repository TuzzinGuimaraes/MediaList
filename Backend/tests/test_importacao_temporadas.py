"""Quais Temporadas a Importação de animes traz inteiras: a atual e as seguintes (spec `temporada`)."""
from datetime import date

import pytest

from importacao.anilist import temporadas_a_frente


@pytest.mark.parametrize('hoje, esperadas', [
    (date(2026, 11, 28), [('FALL', 2026), ('WINTER', 2027), ('SPRING', 2027), ('SUMMER', 2027), ('FALL', 2027)]),
    (date(2026, 12, 31), [('FALL', 2026), ('WINTER', 2027), ('SPRING', 2027), ('SUMMER', 2027), ('FALL', 2027)]),
    (date(2027, 1, 1), [('WINTER', 2027), ('SPRING', 2027), ('SUMMER', 2027), ('FALL', 2027), ('WINTER', 2028)]),
    (date(2027, 3, 31), [('WINTER', 2027), ('SPRING', 2027), ('SUMMER', 2027), ('FALL', 2027), ('WINTER', 2028)]),
    (date(2027, 4, 1), [('SPRING', 2027), ('SUMMER', 2027), ('FALL', 2027), ('WINTER', 2028), ('SPRING', 2028)]),
    (date(2027, 7, 1), [('SUMMER', 2027), ('FALL', 2027), ('WINTER', 2028), ('SPRING', 2028), ('SUMMER', 2028)]),
])
def test_a_atual_e_as_4_seguintes_na_divisao_do_anilist(hoje, esperadas):
    assert temporadas_a_frente(hoje, 5) == esperadas


def test_zero_desliga():
    assert temporadas_a_frente(date(2026, 11, 28), 0) == []
