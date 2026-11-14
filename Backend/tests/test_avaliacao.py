"""Regras da Avaliação (`dominio.avaliacao`), sem banco: repositório e Catálogo em memória."""
import pytest

from dominio.avaliacao import CONFLITO, Avaliacoes
from dominio.lista_pessoal import INVALIDO, NAO_ENCONTRADO, NEGADO, OK

from .helpers import FakeAvaliacaoRepository, FakeCatalogo

ESCALA = 'A nota vai de 0 a 10, com no máximo uma casa decimal'


@pytest.fixture
def repositorio():
    return FakeAvaliacaoRepository()


@pytest.fixture
def avaliacoes(repositorio):
    return Avaliacoes(repositorio, FakeCatalogo({'MID-1': {'tipo': 'anime'}, 'MID-2': {'tipo': 'jogo'}}))


def _criar(avaliacoes, usuario='USR-1', **payload):
    return avaliacoes.criar(usuario, {'id_midia': 'MID-1', 'nota': 8, **payload})


def test_criar_grava_e_devolve_a_nota_media_da_midia(avaliacoes, repositorio):
    _criar(avaliacoes, 'USR-2', nota=6)

    resultado = _criar(avaliacoes, titulo_avaliacao='Bom', texto_avaliacao='Gostei')

    assert resultado.codigo == OK
    assert resultado.dados == {'id_avaliacao': 'AVL-2', 'nota_media': 7.0, 'total_avaliacoes': 2}
    assert repositorio.avaliacoes['AVL-2']['titulo_avaliacao'] == 'Bom'


def test_id_anime_nao_vale_mais_como_id_midia(avaliacoes, repositorio):
    """Alias legado sem cliente: saiu com o contrato da API (ticket 05)."""
    assert avaliacoes.criar('USR-1', {'id_anime': 'MID-2', 'nota': 5}).codigo == INVALIDO
    assert repositorio.avaliacoes == {}


@pytest.mark.parametrize('nota', [0, 10, '8,5', '7.5', 9.9])
def test_notas_da_escala_sao_aceitas(avaliacoes, nota):
    assert _criar(avaliacoes, nota=nota).codigo == OK


@pytest.mark.parametrize('nota', [8.55, 10.5, -1, 'oito', True, [8]])
def test_nota_fora_da_escala_e_recusada_sem_gravar(avaliacoes, repositorio, nota):
    resultado = _criar(avaliacoes, nota=nota)

    assert (resultado.codigo, resultado.erro, resultado.detalhes) == (INVALIDO, ESCALA, {'nota': ESCALA})
    assert repositorio.avaliacoes == {}


@pytest.mark.parametrize('payload', [{'id_midia': 'MID-1'}, {'nota': 8}, {'id_midia': 'MID-1', 'nota': None}, None])
def test_sem_midia_ou_sem_nota_e_invalido(avaliacoes, payload):
    resultado = avaliacoes.criar('USR-1', payload)

    assert (resultado.codigo, resultado.erro) == (INVALIDO, 'ID da mídia e nota são obrigatórios')


def test_midia_inexistente_nao_e_avaliada(avaliacoes, repositorio):
    resultado = avaliacoes.criar('USR-1', {'id_midia': 'MID-404', 'nota': 8})

    assert (resultado.codigo, resultado.erro) == (NAO_ENCONTRADO, 'Mídia não encontrada')
    assert repositorio.avaliacoes == {}


def test_segunda_avaliacao_da_mesma_midia_e_conflito(avaliacoes, repositorio):
    _criar(avaliacoes)

    resultado = _criar(avaliacoes, nota=3)

    assert (resultado.codigo, resultado.erro) == (CONFLITO, 'Você já avaliou esta mídia')
    assert [a['nota'] for a in repositorio.avaliacoes.values()] == [8]


def test_outro_usuario_avalia_a_mesma_midia(avaliacoes):
    _criar(avaliacoes)

    assert _criar(avaliacoes, 'USR-2').codigo == OK


def test_autor_edita_a_nota_e_recebe_a_media_nova(avaliacoes, repositorio):
    _criar(avaliacoes)

    resultado = avaliacoes.editar('USR-1', 'AVL-1', {'nota': '9,5', 'titulo_avaliacao': 'Ótimo', 'outro': 'x'})

    assert resultado.codigo == OK
    assert resultado.dados == {'nota_media': 9.5, 'total_avaliacoes': 1}
    assert (repositorio.avaliacoes['AVL-1']['nota'], repositorio.avaliacoes['AVL-1']['titulo_avaliacao']) == (
        9.5, 'Ótimo')
    assert 'outro' not in repositorio.avaliacoes['AVL-1']


@pytest.mark.parametrize('autor, id_avaliacao', [('USR-2', 'AVL-1'), ('USR-1', 'AVL-404')])
def test_avaliacao_de_outro_e_inexistente_tem_a_mesma_resposta_na_edicao(avaliacoes, repositorio, autor, id_avaliacao):
    _criar(avaliacoes)

    resultado = avaliacoes.editar(autor, id_avaliacao, {'nota': 1})

    assert (resultado.codigo, resultado.erro) == (NEGADO, 'Avaliação não encontrada ou sem permissão')
    assert repositorio.avaliacoes['AVL-1']['nota'] == 8


@pytest.mark.parametrize('payload, erro', [
    ({}, 'Dados não fornecidos'),
    (None, 'Dados não fornecidos'),
    ({'likes': 99}, 'Nenhum campo para atualizar'),
    ({'nota': 11}, ESCALA),
])
def test_edicao_invalida_nao_grava(avaliacoes, repositorio, payload, erro):
    _criar(avaliacoes)

    resultado = avaliacoes.editar('USR-1', 'AVL-1', payload)

    assert (resultado.codigo, resultado.erro) == (INVALIDO, erro)
    assert repositorio.avaliacoes['AVL-1']['nota'] == 8


def test_autor_apaga(avaliacoes, repositorio):
    _criar(avaliacoes)

    assert avaliacoes.apagar('USR-1', 'AVL-1', pode_moderar=False).codigo == OK
    assert repositorio.avaliacoes == {}


def test_quem_pode_moderar_apaga_a_de_outro(avaliacoes, repositorio):
    _criar(avaliacoes)

    assert avaliacoes.apagar('USR-MOD', 'AVL-1', pode_moderar=True).codigo == OK
    assert repositorio.avaliacoes == {}


def test_usuario_comum_nao_apaga_a_de_outro(avaliacoes, repositorio):
    _criar(avaliacoes)

    resultado = avaliacoes.apagar('USR-2', 'AVL-1', pode_moderar=False)

    assert (resultado.codigo, resultado.erro) == (NEGADO, 'Sem permissão para deletar esta avaliação')
    assert 'AVL-1' in repositorio.avaliacoes


def test_apagar_inexistente(avaliacoes):
    resultado = avaliacoes.apagar('USR-1', 'AVL-404', pode_moderar=True)

    assert (resultado.codigo, resultado.erro) == (NAO_ENCONTRADO, 'Avaliação não encontrada')


def test_listar_so_de_midia_que_existe(avaliacoes):
    _criar(avaliacoes)

    assert [a['id_avaliacao'] for a in avaliacoes.listar('MID-1', 20, 0).dados['avaliacoes']] == ['AVL-1']
    assert avaliacoes.listar('MID-2', 20, 0).dados == {'avaliacoes': [], 'total': 0}
    assert (avaliacoes.listar('MID-404', 20, 0).codigo, avaliacoes.listar('MID-404', 20, 0).erro) == (
        NAO_ENCONTRADO, 'Mídia não encontrada')


def test_listar_devolve_a_pagina_pedida_e_o_total_da_midia(avaliacoes):
    for usuario in ('USR-1', 'USR-2', 'USR-3'):
        _criar(avaliacoes, usuario)
    avaliacoes.criar('USR-1', {'id_midia': 'MID-2', 'nota': 5})

    segunda = avaliacoes.listar('MID-1', 2, 2).dados  # 2ª página de 2

    assert segunda['total'] == 3
    assert len(segunda['avaliacoes']) == 1
