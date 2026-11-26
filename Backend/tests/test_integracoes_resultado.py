"""Resultado da integração (Q132): novos, atualizados, Não encontrados e total; a resposta leva a
amostra de 100, o guardado leva todos. Sem banco."""
from integracoes import resultado


def _nao_encontrado(n, tipo='anime'):
    return {'titulo': f'Obra {n}', 'link': None, 'origem_id': str(n), 'tipo': tipo, 'status': 'concluido'}


def test_resposta_leva_a_amostra_de_100_e_o_total():
    todos = [_nao_encontrado(n) for n in range(1, 151)]

    resposta = resultado.criar(novos=2, atualizados=1, nao_encontrados=todos).resposta()

    assert (resposta['novos'], resposta['atualizados'], resposta['total_nao_encontrados']) == (2, 1, 150)
    assert [n['origem_id'] for n in resposta['nao_encontrados']] == [str(n) for n in range(1, 101)]



def test_guardado_leva_todos_e_volta_igual():
    todos = [_nao_encontrado(n) for n in range(1, 151)]
    original = resultado.criar(novos=2, atualizados=1, nao_encontrados=todos)

    guardado = original.guardado()

    assert guardado['nao_encontrados'] == todos
    assert guardado['total_nao_encontrados'] == 150
    assert resultado.de_guardado(guardado) == original


def test_guardado_para_no_teto_de_itens_e_o_total_fica_certo():
    todos = [_nao_encontrado(n) for n in range(resultado.MAXIMO_ITENS + 3)]

    guardado = resultado.criar(nao_encontrados=todos).guardado()

    assert len(guardado['nao_encontrados']) == resultado.MAXIMO_ITENS
    assert guardado['total_nao_encontrados'] == resultado.MAXIMO_ITENS + 3


def test_guardado_antigo_so_com_a_amostra_mantem_o_total():
    antigo = {'novos': 1, 'atualizados': 0, 'nao_encontrados': [_nao_encontrado(n) for n in range(100)],
              'total_nao_encontrados': 130}

    lido = resultado.de_guardado(antigo)

    assert lido.resposta()['total_nao_encontrados'] == 130
    assert len(lido.resposta()['nao_encontrados']) == 100


def test_somar_junta_contagens_e_nao_encontrados_na_ordem():
    a = resultado.criar(novos=1, atualizados=2, nao_encontrados=[_nao_encontrado(1)])
    b = resultado.criar(novos=3, nao_encontrados=[_nao_encontrado(2), _nao_encontrado(3)])

    soma = resultado.somar(a, b, resultado.criar())

    assert (soma.novos, soma.atualizados, soma.total_nao_encontrados) == (4, 2, 3)
    assert [n['origem_id'] for n in soma.resposta()['nao_encontrados']] == ['1', '2', '3']


def test_somar_mantem_o_total_de_um_guardado_antigo():
    antigo = resultado.de_guardado({'novos': 0, 'atualizados': 0, 'nao_encontrados': [_nao_encontrado(1)],
                                    'total_nao_encontrados': 120})

    soma = resultado.somar(antigo, resultado.criar(nao_encontrados=[_nao_encontrado(2)]))

    assert soma.total_nao_encontrados == 121
    assert [n['origem_id'] for n in soma.resposta()['nao_encontrados']] == ['1', '2']


def test_somar_nada_e_vazio():
    assert resultado.somar().resposta() == {
        'novos': 0, 'atualizados': 0, 'nao_encontrados': [], 'total_nao_encontrados': 0,
    }


def test_tirar_o_item_pelo_origem_id_e_tipo_baixa_o_total():
    original = resultado.criar(novos=1, nao_encontrados=[
        _nao_encontrado(1), _nao_encontrado(1, 'manga'), _nao_encontrado(2),
    ])

    sem = original.sem_o_item('1', 'anime')

    assert [(n['origem_id'], n['tipo']) for n in sem.resposta()['nao_encontrados']] == [('1', 'manga'), ('2', 'anime')]
    assert (sem.novos, sem.total_nao_encontrados) == (1, 2)


def test_tirar_item_que_nao_esta_nao_muda_nada():
    original = resultado.criar(nao_encontrados=[_nao_encontrado(1)])

    assert original.sem_o_item('9', 'anime') == original


def test_tirar_item_de_guardado_antigo_nunca_deixa_total_negativo():
    antigo = resultado.de_guardado({'novos': 0, 'atualizados': 0, 'nao_encontrados': [_nao_encontrado(1)],
                                    'total_nao_encontrados': 0})

    assert antigo.sem_o_item('1', 'anime').total_nao_encontrados == 0


def test_pendentes_da_steam_vao_na_resposta_e_no_guardado():
    com_pendentes = resultado.criar(novos=1, pendentes=4)

    assert com_pendentes.resposta()['pendentes'] == 4
    assert resultado.de_guardado(com_pendentes.guardado()) == com_pendentes
    assert 'pendentes' not in resultado.criar().resposta()
