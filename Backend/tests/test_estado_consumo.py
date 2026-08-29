"""Vocabulário de Estado de consumo e Rótulos de estado (ver CONTEXT.md)."""
import pytest

from schemas import estado_consumo as ec


def test_todo_tipo_cobre_os_cinco_estados_comuns():
    comuns = {ec.PLANEJADO, ec.EM_PROGRESSO, ec.PAUSADO, ec.ABANDONADO, ec.CONCLUIDO}
    for tipo in ec.TIPOS:
        assert comuns <= set(ec.ROTULOS_POR_TIPO[tipo]), tipo


def test_platinado_existe_apenas_para_jogo():
    assert ec.rotulo_para(ec.PLATINADO, 'jogo') == 'platinado'
    assert ec.rotulo_para(ec.PLATINADO, 'anime') is None
    assert ec.rotulo_para(ec.PLATINADO, 'manga') is None


@pytest.mark.parametrize(
    'rotulo,tipo',
    [
        ('assistindo', 'anime'),
        ('completo', 'anime'),
        ('lendo', 'manga'),
        ('lido', 'manga'),
        ('jogando', 'jogo'),
        ('zerado', 'jogo'),
        ('platinado', 'jogo'),
        ('na_fila', 'jogo'),
        ('pausado', 'anime'),
        ('abandonado', 'manga'),
    ],
)
def test_rotulo_do_proprio_tipo_e_valido(rotulo, tipo):
    assert ec.rotulo_valido(rotulo, tipo)
    assert ec.erro_de_rotulo(rotulo, tipo) is None


@pytest.mark.parametrize(
    'rotulo,tipo',
    [
        ('platinado', 'anime'),
        ('assistindo', 'jogo'),
        ('lendo', 'anime'),
        ('zerado', 'manga'),
        ('na_fila', 'anime'),
        ('planejado', 'jogo'),
        ('inventado', 'anime'),
    ],
)
def test_rotulo_de_outro_tipo_e_recusado(rotulo, tipo):
    assert not ec.rotulo_valido(rotulo, tipo)
    erro = ec.erro_de_rotulo(rotulo, tipo)
    assert erro is not None and rotulo in erro and tipo in erro


def test_rotulos_iguais_em_tipos_diferentes_mapeiam_no_mesmo_estado():
    assert ec.estado_de('assistindo', 'anime') == ec.EM_PROGRESSO
    assert ec.estado_de('lendo', 'manga') == ec.EM_PROGRESSO
    assert ec.estado_de('jogando', 'jogo') == ec.EM_PROGRESSO


def test_platinado_e_um_refinamento_de_concluido():
    assert ec.e_terminal('platinado', 'jogo')
    assert ec.e_terminal('zerado', 'jogo')
    assert ec.e_terminal('completo', 'anime')
    assert not ec.e_terminal('jogando', 'jogo')


def test_rotulo_ausente_nunca_e_valido():
    assert not ec.rotulo_valido(None, 'anime')
    assert ec.erro_de_rotulo(None, 'anime') is None  # ausência não é erro aqui


def test_tipo_desconhecido_cai_na_uniao_dos_rotulos():
    assert ec.rotulo_valido('platinado', None)
    assert ec.rotulo_valido('assistindo', 'tipo-que-nao-existe')
    assert not ec.rotulo_valido('inventado', None)


def test_uniao_bate_com_o_enum_do_banco():
    """Os rótulos conhecidos são exatamente os valores de `status_consumo`."""
    enum_do_ddl = {
        'assistindo', 'completo', 'planejado', 'pausado', 'abandonado',
        'lendo', 'lido',
        'jogando', 'zerado', 'platinado', 'na_fila',
    }
    assert set(ec.ROTULOS_VALIDOS) == enum_do_ddl
