"""Nota da fonte (ticket 13): escala 0..10 com uma casa, nunca acima de 10."""
from decimal import Decimal

import pytest

from importacao.utils import nota_fonte_anilist, nota_fonte_rawg


@pytest.mark.parametrize(
    ('mean_score', 'esperado'),
    [(100, Decimal('10.0')), (87, Decimal('8.7')), (1, Decimal('0.1')), (None, None), (0, None)],
)
def test_nota_fonte_do_anilist_e_o_mean_score_dividido_por_10(mean_score, esperado):
    assert nota_fonte_anilist(mean_score) == esperado


@pytest.mark.parametrize(
    ('rating', 'esperado'),
    [
        (5, Decimal('10.0')),
        (4.47, Decimal('8.9')),
        (4.48, Decimal('9.0')),
        (3.25, Decimal('6.5')),
        (None, None),
        (0, None),
    ],
)
def test_nota_fonte_da_rawg_e_o_rating_vezes_2_com_uma_casa(rating, esperado):
    assert nota_fonte_rawg(rating) == esperado


def test_nota_fonte_nunca_passa_de_10():
    assert nota_fonte_anilist(105) == Decimal('10.0')
    assert nota_fonte_rawg(5.2) == Decimal('10.0')
