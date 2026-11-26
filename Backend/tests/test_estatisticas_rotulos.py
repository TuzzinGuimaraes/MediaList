"""O gerador da lista SQL de Rótulos que as estatísticas do perfil e o Catálogo usam.

O que a rota conta por Rótulo está em `test_estatisticas_pg.py`.
"""
import pytest

from repositories.rotulos import sql_rotulos
from schemas import estado_consumo as ec


def test_lista_sql_tem_os_rotulos_dos_estados_em_todos_os_tipos():
    assert sql_rotulos(ec.CONCLUIDO, ec.PLATINADO) == "'completo', 'lido', 'platinado', 'zerado'"
    assert sql_rotulos(ec.EM_PROGRESSO) == "'assistindo', 'jogando', 'lendo'"


def test_tipo_novo_entra_sozinho_na_lista(monkeypatch):
    monkeypatch.setitem(ec.ROTULOS_POR_TIPO, 'livro', {ec.EM_PROGRESSO: 'folheando', ec.CONCLUIDO: 'terminado'})

    assert sql_rotulos(ec.CONCLUIDO, ec.PLATINADO) == "'completo', 'lido', 'platinado', 'terminado', 'zerado'"
    assert sql_rotulos(ec.EM_PROGRESSO) == "'assistindo', 'folheando', 'jogando', 'lendo'"


def test_recusa_rotulo_fora_de_a_z(monkeypatch):
    monkeypatch.setitem(ec.ROTULOS_POR_TIPO, 'livro', {ec.CONCLUIDO: "lido'); DROP"})

    with pytest.raises(ValueError, match=r'\[a-z_\]'):
        sql_rotulos(ec.CONCLUIDO)
