"""Aplicar itens de origem na Lista (Q110, Q111) e o mapeamento de Status e nota (Q114): funções puras."""
from datetime import date

import pytest

from integracoes.aplicar import ATUALIZADO, NOVO, aplicar
from integracoes.mapeamento import estado_da_origem, nota_anilist, nota_mal
from integracoes.plataforma import ItemDeOrigem
from schemas.estado_consumo import ABANDONADO, CONCLUIDO, EM_PROGRESSO, PAUSADO, PLANEJADO

HOJE = date(2026, 11, 25)


def _origem(**campos):
    base = {
        'origem_id': '1', 'tipo': 'anime', 'titulo': 'Frieren', 'link': 'https://anilist.co/anime/1',
        'status': EM_PROGRESSO, 'progresso': 5, 'nota': 8.5,
        'data_inicio': '2026-10-01', 'data_conclusao': None,
    }
    return ItemDeOrigem(**{**base, **campos})


def _jogo(**campos):
    base = {
        'origem_id': '730', 'tipo': 'jogo', 'titulo': 'Counter-Strike 2', 'link': None,
        'status': None, 'progresso': None, 'nota': None, 'horas': 12, 'jogado_em': '2026-11-20',
    }
    return _origem(**{**base, **campos})


def _item(**campos):
    return {
        'status_consumo': 'assistindo', 'progresso_atual': 3, 'nota_usuario': None,
        'data_inicio': None, 'data_conclusao': None, **campos,
    }


# ============================================
# Mapeamento (Q114)
# ============================================

@pytest.mark.parametrize(('status', 'estado'), [
    ('CURRENT', EM_PROGRESSO), ('REPEATING', EM_PROGRESSO), ('PLANNING', PLANEJADO), ('COMPLETED', CONCLUIDO),
    ('PAUSED', PAUSADO), ('DROPPED', ABANDONADO),
    ('watching', EM_PROGRESSO), ('reading', EM_PROGRESSO), ('plan_to_watch', PLANEJADO),
    ('plan_to_read', PLANEJADO), ('completed', CONCLUIDO), ('on_hold', PAUSADO), ('dropped', ABANDONADO),
])
def test_status_da_origem_vira_estado_de_consumo(status, estado):
    assert estado_da_origem(status) == estado


def test_status_desconhecido_nao_tem_estado():
    assert estado_da_origem('FAVORITO') is None
    assert estado_da_origem(None) is None


@pytest.mark.parametrize(('score', 'nota'), [(8.5, 8.5), (10, 10.0), (7, 7.0), (0, None), (None, None)])
def test_nota_do_anilist_em_point_10_decimal(score, nota):
    assert nota_anilist(score) == nota


@pytest.mark.parametrize(('score', 'nota'), [(9, 9.0), (1, 1.0), (0, None), (None, None), (11, None)])
def test_nota_do_mal_de_1_a_10(score, nota):
    assert nota_mal(score) == nota


# ============================================
# Item novo
# ============================================

def test_item_novo_entra_com_status_progresso_nota_e_datas_da_origem():
    mudanca = aplicar(None, _origem(data_conclusao=None), total=28, hoje=HOJE)

    assert mudanca.tipo == NOVO
    assert mudanca.campos == {
        'status_consumo': 'assistindo', 'progresso_atual': 5, 'nota_usuario': 8.5, 'data_inicio': '2026-10-01',
    }


def test_item_novo_de_manga_usa_o_rotulo_do_tipo():
    mudanca = aplicar(None, _origem(tipo='manga', status=CONCLUIDO, progresso=100, data_conclusao='2026-11-01'),
                      total=100, hoje=HOJE)

    assert mudanca.campos['status_consumo'] == 'lido'
    assert mudanca.campos['data_conclusao'] == '2026-11-01'


def test_item_novo_sem_status_entra_planejado_e_progresso_nao_passa_do_total():
    mudanca = aplicar(None, _origem(status=None, progresso=30, nota=None, data_inicio=None), total=28, hoje=HOJE)

    assert mudanca.campos == {'status_consumo': 'planejado', 'progresso_atual': 28}


# ============================================
# Item existente (Q110)
# ============================================

def test_existente_fica_com_o_maior_progresso_e_o_status_da_origem():
    mudanca = aplicar(_item(status_consumo='pausado', progresso_atual=3), _origem(progresso=7), total=28, hoje=HOJE)

    assert mudanca.tipo == ATUALIZADO
    assert mudanca.campos['progresso_atual'] == 7
    assert mudanca.campos['status_consumo'] == 'assistindo'


def test_existente_com_progresso_maior_nao_muda_nem_o_status():
    item = _item(status_consumo='pausado', progresso_atual=10, nota_usuario=7.0)

    assert aplicar(item, _origem(status=ABANDONADO, progresso=7), total=28, hoje=HOJE) is None


def test_progresso_igual_nao_muda_o_status():
    item = _item(status_consumo='planejado', progresso_atual=0, nota_usuario=6.0)

    assert aplicar(item, _origem(status=EM_PROGRESSO, progresso=0), total=28, hoje=HOJE) is None


def test_nota_da_origem_so_entra_sem_nota_pessoal():
    sem_nota = aplicar(_item(progresso_atual=9), _origem(progresso=5, nota=9.0), total=28, hoje=HOJE)
    com_nota = aplicar(_item(progresso_atual=9, nota_usuario=6.5), _origem(progresso=5, nota=9.0), total=28, hoje=HOJE)

    assert sem_nota.campos == {'nota_usuario': 9.0}
    assert com_nota is None


def test_nunca_grava_comentario_favorito_privado_nem_recontagem():
    concluido = _origem(status=CONCLUIDO, progresso=28, data_conclusao='2026-11-20')
    mudanca = aplicar(_item(), concluido, total=28, hoje=HOJE)

    assert set(mudanca.campos) <= {'status_consumo', 'progresso_atual', 'nota_usuario', 'data_inicio', 'data_conclusao'}


def test_concluido_na_origem_leva_a_data_de_conclusao_e_preenche_inicio_vazio():
    concluido = _origem(status=CONCLUIDO, progresso=28, data_conclusao='2026-11-20')
    mudanca = aplicar(_item(), concluido, total=28, hoje=HOJE)

    assert mudanca.campos['status_consumo'] == 'completo'
    assert mudanca.campos['data_conclusao'] == '2026-11-20'
    assert mudanca.campos['data_inicio'] == '2026-10-01'


def test_inicio_ja_preenchido_nao_e_trocado():
    mudanca = aplicar(_item(data_inicio='2026-01-01'), _origem(progresso=8), total=28, hoje=HOJE)

    assert 'data_inicio' not in mudanca.campos


def test_repeating_e_em_progresso_sem_mexer_na_recontagem():
    item = _item(status_consumo='completo', progresso_atual=28, data_conclusao='2026-01-01', nota_usuario=9.0)

    assert aplicar(item, _origem(status=estado_da_origem('REPEATING'), progresso=4), total=28, hoje=HOJE) is None


def test_progresso_da_origem_acima_do_total_vira_o_total():
    mudanca = aplicar(_item(progresso_atual=3, nota_usuario=5.0), _origem(progresso=40), total=28, hoje=HOJE)

    assert mudanca.campos['progresso_atual'] == 28


# ============================================
# Jogos (Q111)
# ============================================

def test_jogo_novo_jogado_nos_ultimos_30_dias_entra_jogando_com_as_horas():
    mudanca = aplicar(None, _jogo(jogado_em='2026-10-27'), total=None, hoje=HOJE)

    assert mudanca.campos == {'status_consumo': 'jogando', 'progresso_atual': 12}


def test_jogo_novo_sem_jogar_ha_mais_de_30_dias_entra_pausado():
    assert aplicar(None, _jogo(jogado_em='2026-10-25'), total=None, hoje=HOJE).campos['status_consumo'] == 'pausado'
    assert aplicar(None, _jogo(jogado_em=None), total=None, hoje=HOJE).campos['status_consumo'] == 'pausado'


def test_jogo_sem_horas_nao_entra():
    assert aplicar(None, _jogo(horas=0), total=None, hoje=HOJE) is None


def test_jogo_existente_atualiza_so_as_horas_maiores():
    zerado = {'status_consumo': 'zerado', 'progresso_atual': 5, 'nota_usuario': 9.0}

    assert aplicar(zerado, _jogo(horas=12), total=None, hoje=HOJE).campos == {'progresso_atual': 12}
    assert aplicar({**zerado, 'progresso_atual': 20}, _jogo(horas=12), total=None, hoje=HOJE) is None


def test_jogo_na_fila_vira_jogando_com_horas_novas():
    na_fila = {'status_consumo': 'na_fila', 'progresso_atual': 0, 'nota_usuario': 7.0}

    assert aplicar(na_fila, _jogo(horas=3), total=None, hoje=HOJE).campos == {
        'progresso_atual': 3, 'status_consumo': 'jogando',
    }


def test_jogo_nunca_vira_zerado_nem_platinado_pela_origem():
    mudanca = aplicar(None, _jogo(status=CONCLUIDO), total=None, hoje=HOJE)
    jogando = {'status_consumo': 'jogando', 'progresso_atual': 1}
    existente = aplicar(jogando, _jogo(status=CONCLUIDO), total=None, hoje=HOJE)

    assert mudanca.campos['status_consumo'] == 'jogando'
    assert 'status_consumo' not in existente.campos



# ============================================
# Datas inválidas da origem: só a data sai, o Item entra (ADR 0015)
# ============================================

AMANHA = '2026-11-26'


def test_item_novo_com_inicio_no_futuro_entra_sem_o_inicio():
    mudanca = aplicar(None, _origem(data_inicio=AMANHA), total=28, hoje=HOJE)

    assert mudanca.campos == {'status_consumo': 'assistindo', 'progresso_atual': 5, 'nota_usuario': 8.5}


def test_item_novo_com_conclusao_no_futuro_entra_sem_a_conclusao():
    mudanca = aplicar(None, _origem(status=CONCLUIDO, progresso=28, data_conclusao=AMANHA), total=28, hoje=HOJE)

    assert mudanca.campos['data_inicio'] == '2026-10-01'
    assert 'data_conclusao' not in mudanca.campos


def test_item_novo_com_conclusao_antes_do_inicio_perde_o_inicio():
    origem = _origem(status=CONCLUIDO, progresso=28, data_inicio='2026-11-10', data_conclusao='2026-11-01')

    mudanca = aplicar(None, origem, total=28, hoje=HOJE)

    assert mudanca.campos['data_conclusao'] == '2026-11-01'
    assert 'data_inicio' not in mudanca.campos


def test_existente_com_inicio_da_origem_depois_da_conclusao_gravada_perde_o_inicio():
    item = _item(data_conclusao=date(2026, 9, 1))

    mudanca = aplicar(item, _origem(progresso=8), total=28, hoje=HOJE)

    assert mudanca.campos['progresso_atual'] == 8
    assert 'data_inicio' not in mudanca.campos


def test_existente_com_conclusao_da_origem_antes_do_inicio_gravado_perde_a_conclusao():
    """O início gravado é do Usuário e não é enviado: a data que sai é a que veio da origem."""
    item = _item(data_inicio=date(2026, 11, 10))
    origem = _origem(status=CONCLUIDO, progresso=28, data_conclusao='2026-11-01')

    mudanca = aplicar(item, origem, total=28, hoje=HOJE)

    assert mudanca.campos['status_consumo'] == 'completo'
    assert 'data_conclusao' not in mudanca.campos
