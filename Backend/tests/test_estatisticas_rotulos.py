"""As estatísticas do perfil contam pelos Rótulos de estado do vocabulário de Estado de consumo."""
import re

import pytest

from routes.usuario import ESTATISTICAS_POR_TIPO
from schemas import estado_consumo as ec


def _rotulos_do_filtro(coluna: str) -> set[str]:
    achado = re.search(rf"status_consumo IN \(([^)]*)\)\) AS {coluna}\b", ESTATISTICAS_POR_TIPO)
    assert achado, coluna
    return {rotulo.strip().strip("'") for rotulo in achado.group(1).split(',')}


def _rotulos_dos_estados(*estados: str) -> set[str]:
    return {
        rotulo for rotulos in ec.ROTULOS_POR_TIPO.values()
        for estado, rotulo in rotulos.items() if estado in estados
    }


@pytest.mark.parametrize('tipo', ec.TIPOS)
def test_todo_rotulo_de_concluido_e_platinado_entra_nos_concluidos(tipo):
    concluidos = _rotulos_do_filtro('concluidos')
    for estado in (ec.CONCLUIDO, ec.PLATINADO):
        rotulo = ec.rotulo_para(estado, tipo)
        if rotulo is not None:
            assert rotulo in concluidos, (tipo, estado)


@pytest.mark.parametrize('tipo', ec.TIPOS)
def test_todo_rotulo_de_em_progresso_entra_no_em_andamento(tipo):
    assert ec.rotulo_para(ec.EM_PROGRESSO, tipo) in _rotulos_do_filtro('em_andamento')


def test_filtros_das_estatisticas_tem_so_os_rotulos_dos_seus_estados():
    assert _rotulos_do_filtro('concluidos') == _rotulos_dos_estados(ec.CONCLUIDO, ec.PLATINADO)
    assert _rotulos_do_filtro('em_andamento') == _rotulos_dos_estados(ec.EM_PROGRESSO)


def test_rotulo_novo_entra_sozinho_nas_estatisticas(monkeypatch):
    monkeypatch.setitem(ec.ROTULOS_POR_TIPO, 'livro', {ec.EM_PROGRESSO: 'folheando', ec.CONCLUIDO: 'terminado'})
    assert ec.sql_rotulos(ec.CONCLUIDO, ec.PLATINADO) == "'completo', 'lido', 'platinado', 'terminado', 'zerado'"
    assert ec.sql_rotulos(ec.EM_PROGRESSO) == "'assistindo', 'folheando', 'jogando', 'lendo'"


def test_sql_rotulos_recusa_rotulo_fora_de_a_z(monkeypatch):
    monkeypatch.setitem(ec.ROTULOS_POR_TIPO, 'livro', {ec.CONCLUIDO: "lido'); DROP"})
    with pytest.raises(ValueError, match=r'\[a-z_\]'):
        ec.sql_rotulos(ec.CONCLUIDO)
