"""O título exibido de um payload `title` do AniList (CONTEXT.md: Título)."""
import pytest

from importacao.anilist import titulo_exibido


@pytest.mark.parametrize(('title', 'esperado'), [
    ({'english': 'Fullmetal Alchemist: Brotherhood', 'romaji': 'Hagane no Renkinjutsushi', 'native': '鋼の錬金術師'},
     'Fullmetal Alchemist: Brotherhood'),
    ({'english': None, 'romaji': 'Sousou no Frieren', 'native': '葬送のフリーレン'}, 'Sousou no Frieren'),
    ({'english': '  ', 'romaji': '', 'native': ' 葬送のフリーレン '}, '葬送のフリーレン'),
    ({'english': None, 'romaji': None, 'native': None}, None),
    ({}, None),
    (None, None),
    ('Frieren', None),
])
def test_ingles_senao_romaji_senao_original_sem_vazios(title, esperado):
    assert titulo_exibido(title) == esperado
