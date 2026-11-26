"""O mapa Tipo de mídia → tabela/colunas, que o Catálogo e a Importação dividem."""
import pytest

from tipos_midia import TIPOS, valor_de_coluna


@pytest.mark.parametrize('valor, esperado', [
    ('PC, Switch ,', ['PC', 'Switch']),
    (['PC', ' PS5 ', ''], ['PC', 'PS5']),
    (None, []),
])
def test_plataformas_viram_lista(valor, esperado):
    assert valor_de_coluna('plataformas', valor) == esperado


@pytest.mark.parametrize('valor, esperado', [(None, False), (True, True), (False, False)])
def test_temporada_estimada_nunca_e_nula(valor, esperado):
    assert valor_de_coluna('temporada_estimada', valor) is esperado


def test_outras_colunas_passam_como_vieram():
    assert valor_de_coluna('autor', 'Urasawa, Naoki') == 'Urasawa, Naoki'


def test_so_jogo_nao_tem_total_de_progresso():
    assert {nome: tipo.coluna_total for nome, tipo in TIPOS.items()} == {
        'anime': 'numero_episodios', 'manga': 'numero_capitulos', 'jogo': None,
    }


def test_chave_da_fonte_e_gravavel_e_nao_se_repete():
    for tipo in TIPOS.values():
        assert tipo.colunas_gravaveis.count(tipo.chave_fonte) == 1
