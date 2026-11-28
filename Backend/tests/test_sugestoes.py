"""Pontos, motivo e ordem das Sugestões (`dominio.sugestoes`, spec `sugestoes`), sem banco."""
from decimal import Decimal

from dominio.sugestoes import LIMITE, completar_com_em_alta, montar_faixa, peso_da_semente, sugerir


def _rec(destino, rating, *, nota=None, favorito=False, semente='Frieren', popularidade=None, titulo=None):
    """Uma recomendação de uma semente (Item do Usuário) para uma obra do Catálogo."""
    return {
        'id_midia': destino, 'rating': rating, 'popularidade': popularidade, 'titulo': titulo or destino,
        'nota': None if nota is None else Decimal(str(nota)), 'favorito': favorito, 'titulo_semente': semente,
    }


def _ids(sugestoes):
    return [s['id_midia'] for s in sugestoes]


def test_peso_da_semente_e_a_nota_ou_9_para_favorito_sem_nota():
    assert peso_da_semente(Decimal('8'), False) == 8
    assert peso_da_semente(Decimal('9.5'), True) == Decimal('9.5')
    assert peso_da_semente(None, True) == 9
    assert peso_da_semente(Decimal('7.9'), False) is None
    assert peso_da_semente(None, False) is None


def test_favorito_com_nota_baixa_e_semente_pelo_peso_da_nota():
    assert peso_da_semente(Decimal('6'), True) == 6


def test_pontos_sao_rating_vezes_peso_somados_entre_sementes():
    sugestoes = sugerir([
        _rec('A', 100, nota=8, semente='X'),          # 800
        _rec('B', 50, nota=9, semente='X'),           # 450
        _rec('B', 50, nota=8, semente='Y'),           # +400 = 850
        _rec('C', 90, favorito=True, semente='Z'),    # 810
    ])

    assert _ids(sugestoes) == ['B', 'C', 'A']


def test_motivo_cita_a_semente_que_mais_contribuiu():
    [b] = sugerir([
        _rec('B', 10, nota=9, semente='Pouco'),
        _rec('B', 100, nota=8, semente='Muito'),
    ])

    assert b['motivo'] == {'porque': 'nota', 'nota': 8.0, 'titulo': 'Muito'}


def test_empate_de_contribuicao_no_motivo_vence_a_semente_de_maior_peso():
    [b] = sugerir([
        _rec('B', 100, nota=9, semente='A nota 9'),    # 900
        _rec('B', 90, nota=10, semente='Z nota 10'),   # 900
    ])

    assert b['motivo'] == {'porque': 'nota', 'nota': 10.0, 'titulo': 'Z nota 10'}


def test_empate_de_contribuicao_e_de_peso_no_motivo_vence_o_titulo_menor():
    [b] = sugerir([
        _rec('B', 100, nota=9, semente='Vinland Saga'),
        _rec('B', 100, nota=9, semente='Frieren'),
    ])

    assert b['motivo']['titulo'] == 'Frieren'


def test_motivo_de_favorito_sem_nota_nao_traz_nota():
    [a] = sugerir([_rec('A', 10, favorito=True, semente='Frieren')])

    assert a['motivo'] == {'porque': 'favorito', 'nota': None, 'titulo': 'Frieren'}


def test_favorito_com_nota_abaixo_de_8_tem_motivo_de_favorito():
    [a] = sugerir([_rec('A', 10, nota=6, favorito=True, semente='Frieren')])

    assert a['motivo'] == {'porque': 'favorito', 'nota': None, 'titulo': 'Frieren'}


def test_nota_com_casa_decimal_sai_como_numero():
    [a] = sugerir([_rec('A', 10, nota=8.5, favorito=True)])

    assert a['motivo'] == {'porque': 'nota', 'nota': 8.5, 'titulo': 'Frieren'}


def test_item_que_nao_e_semente_nao_conta():
    assert sugerir([_rec('A', 100, nota=7)]) == []


def test_empate_por_pontos_vai_pela_popularidade_e_depois_pelo_titulo():
    sugestoes = sugerir([
        _rec('sem-pop', 10, nota=8, titulo='A'),
        _rec('pop-baixa', 10, nota=8, popularidade=5, titulo='Z'),
        _rec('pop-alta', 10, nota=8, popularidade=50, titulo='Z'),
        _rec('pop-baixa-b', 10, nota=8, popularidade=5, titulo='B'),
    ])

    assert _ids(sugestoes) == ['pop-alta', 'pop-baixa-b', 'pop-baixa', 'sem-pop']


def test_no_maximo_12():
    sugestoes = sugerir([_rec(f'M{i:02}', 100 - i, nota=8) for i in range(20)])

    assert LIMITE == 12
    assert _ids(sugestoes) == [f'M{i:02}' for i in range(12)]


def _escolhida(destino):
    return {'id_midia': destino, 'motivo': {'porque': 'nota', 'nota': 9.0, 'titulo': 'Frieren'}}


def test_faixa_junta_a_midia_e_o_motivo_e_diz_quantas_faltam():
    faixa, faltam = montar_faixa([_escolhida('A'), _escolhida('B')], {
        'A': {'id_midia': 'A', 'titulo_exibido': 'Obra A'}, 'B': {'id_midia': 'B', 'titulo_exibido': 'Obra B'},
    })

    assert faixa == [
        {'id_midia': 'A', 'titulo_exibido': 'Obra A', 'motivo': _escolhida('A')['motivo']},
        {'id_midia': 'B', 'titulo_exibido': 'Obra B', 'motivo': _escolhida('B')['motivo']},
    ]
    assert faltam == LIMITE - 2


def test_faixa_descarta_a_sugestao_sem_midia():
    faixa, faltam = montar_faixa([_escolhida('A'), _escolhida('sumiu')], {'A': {'id_midia': 'A'}})

    assert _ids(faixa) == ['A']
    assert faltam == LIMITE - 1


def test_faixa_corta_em_12_e_nao_falta_nada():
    ids = [f'M{i:02}' for i in range(15)]

    faixa, faltam = montar_faixa([_escolhida(i) for i in ids], {i: {'id_midia': i} for i in ids})

    assert _ids(faixa) == ids[:12]
    assert faltam == 0


def test_em_alta_completa_ate_12_sem_repetir_e_com_motivo_em_alta():
    sugestoes = sugerir([_rec('A', 10, nota=9), _rec('B', 5, nota=9)])
    em_alta = [{'id_midia': i} for i in ['B', 'X', 'Y']]

    faixa = completar_com_em_alta(sugestoes, em_alta)

    assert _ids(faixa) == ['A', 'B', 'X', 'Y']
    assert faixa[2]['motivo'] == {'porque': 'em_alta', 'nota': None, 'titulo': None}


def test_em_alta_nao_passa_de_12():
    faixa = completar_com_em_alta([], [{'id_midia': f'E{i:02}'} for i in range(15)])

    assert _ids(faixa) == [f'E{i:02}' for i in range(12)]
