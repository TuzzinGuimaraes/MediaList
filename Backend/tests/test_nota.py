"""Escala das notas (Avaliação, Nota pessoal, Nota da fonte): 0 a 10, uma casa."""
import pytest

from dominio.nota import MENSAGEM_ESCALA, NotaInvalida, ler_nota


@pytest.mark.parametrize('valor, esperado', [
    (0, 0.0), (10, 10.0), (8.5, 8.5), ('7', 7.0), ('7.5', 7.5), ('7,5', 7.5), (9.9, 9.9),
])
def test_nota_na_escala_e_aceita(valor, esperado):
    assert ler_nota(valor) == esperado


@pytest.mark.parametrize('valor', [8.55, '8.55', 10.1, -0.1, 11, 'oito', True, float('nan'), float('inf'), [], None])
def test_nota_fora_da_escala_e_recusada_sem_arredondar(valor):
    with pytest.raises(NotaInvalida) as erro:
        ler_nota(valor)

    assert str(erro.value) == MENSAGEM_ESCALA


def test_mensagem_diz_a_escala():
    assert MENSAGEM_ESCALA == 'A nota vai de 0 a 10, com no máximo uma casa decimal'
