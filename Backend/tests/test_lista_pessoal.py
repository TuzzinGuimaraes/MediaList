"""Regras de escrita do Item de lista (ver CONTEXT.md: Item de lista, Progresso)."""
from datetime import date

from dominio.lista_pessoal import INVALIDO, NAO_ENCONTRADO, NEGADO, OK, ListaPessoal

from .helpers import FakeListaRepository, FakeMidiaRepository

DONO = 'USR-1'
OUTRO = 'USR-2'


def _catalogo():
    """Catálogo mínimo: um de cada tipo, com o total que vem da Mídia."""
    return {
        'MID-ANIME': {'tipo': 'anime', 'progresso_total_padrao': 24},
        'MID-MANGA': {'tipo': 'manga', 'progresso_total_padrao': 100},
        'MID-JOGO': {'tipo': 'jogo', 'progresso_total_padrao': None},
    }


def _item(**over):
    item = {
        'id_lista': 'LST-1',
        'id_usuario': DONO,
        'id_midia': 'MID-ANIME',
        'status_consumo': 'assistindo',
        'progresso_atual': 3,
        'data_conclusao': None,
    }
    item.update(over)
    return item


def _modulo(itens=None, midias=None):
    """Módulo com repositórios em memória; devolve também o de lista, para inspeção."""
    midias = _catalogo() if midias is None else midias
    lista = FakeListaRepository(midias=midias, itens=itens)
    return ListaPessoal(lista, FakeMidiaRepository(midias)), lista


def _com_item(**over):
    item = _item(**over)
    return _modulo(itens={item['id_lista']: item})


# --- adicionar ---------------------------------------------------------------


def test_adicionar_cria_item_e_devolve_o_id():
    modulo, repo = _modulo()

    resultado = modulo.adicionar(DONO, {'id_midia': 'MID-ANIME', 'status_consumo': 'assistindo'})

    assert resultado.codigo == OK
    assert resultado.id_lista is not None
    assert repo.obter_item_usuario(DONO, 'MID-ANIME')['status_consumo'] == 'assistindo'


def test_adicionar_exige_midia_e_estado():
    modulo, repo = _modulo()

    resultado = modulo.adicionar(DONO, {})

    assert resultado.codigo == INVALIDO
    assert set(resultado.detalhes) == {'id_midia', 'status_consumo'}
    assert repo.escritas == []


def test_adicionar_rejeita_midia_fora_do_catalogo():
    modulo, repo = _modulo()

    resultado = modulo.adicionar(DONO, {'id_midia': 'MID-404', 'status_consumo': 'planejado'})

    assert resultado.codigo == INVALIDO
    assert 'id_midia' in resultado.detalhes
    assert repo.escritas == []


def test_adicionar_rejeita_rotulo_de_outro_tipo():
    """`platinado` é rótulo de jogo; num anime tem que ser recusado."""
    modulo, repo = _modulo()

    resultado = modulo.adicionar(DONO, {'id_midia': 'MID-ANIME', 'status_consumo': 'platinado'})

    assert resultado.codigo == INVALIDO
    assert 'não se aplica' in resultado.detalhes['status_consumo']
    assert repo.escritas == []


def test_adicionar_a_mesma_midia_duas_vezes_e_conflito():
    modulo, _repo = _modulo()
    modulo.adicionar(DONO, {'id_midia': 'MID-ANIME', 'status_consumo': 'assistindo'})

    resultado = modulo.adicionar(DONO, {'id_midia': 'MID-ANIME', 'status_consumo': 'pausado'})

    assert resultado.codigo == INVALIDO
    assert 'já está na lista' in resultado.detalhes['id_midia']


def test_adicionar_rejeita_progresso_acima_do_total_da_midia():
    modulo, repo = _modulo()

    resultado = modulo.adicionar(DONO, {
        'id_midia': 'MID-ANIME',
        'status_consumo': 'assistindo',
        'progresso_atual': 25,
    })

    assert resultado.codigo == INVALIDO
    assert '24' in resultado.detalhes['progresso_atual']
    assert repo.escritas == []


def test_adicionar_rejeita_progresso_negativo():
    modulo, _repo = _modulo()

    resultado = modulo.adicionar(DONO, {
        'id_midia': 'MID-ANIME',
        'status_consumo': 'assistindo',
        'progresso_atual': -1,
    })

    assert resultado.codigo == INVALIDO
    assert 'progresso_atual' in resultado.detalhes


def test_adicionar_com_progresso_no_total_ja_entra_concluido():
    modulo, repo = _modulo()

    resultado = modulo.adicionar(DONO, {
        'id_midia': 'MID-ANIME',
        'status_consumo': 'assistindo',
        'progresso_atual': 24,
    })

    item = repo.obter_item_por_id(resultado.id_lista)
    assert item['status_consumo'] == 'completo'
    assert item['data_conclusao'] == date.today().isoformat()


def test_adicionar_grava_uma_vez_so():
    """Uma escrita por requisição: é o que impede o atropelo de estado."""
    modulo, repo = _modulo()

    modulo.adicionar(DONO, {
        'id_midia': 'MID-ANIME',
        'status_consumo': 'assistindo',
        'progresso_atual': 5,
        'nota_usuario': 9.5,
        'favorito': True,
    })

    assert [escrita[0] for escrita in repo.escritas] == ['criar_item']


def test_adicionar_ignora_progresso_total_do_payload():
    """O total pertence à Mídia; o Item não o recebe do cliente."""
    modulo, repo = _modulo()

    modulo.adicionar(DONO, {
        'id_midia': 'MID-ANIME',
        'status_consumo': 'assistindo',
        'progresso_total': 999,
    })

    assert 'progresso_total' not in repo.escritas[0][3]


# --- atualizar ---------------------------------------------------------------


def test_atualizar_item_inexistente_nao_e_encontrado():
    modulo, _repo = _modulo()

    assert modulo.atualizar(DONO, 'LST-404', {'favorito': True}).codigo == NAO_ENCONTRADO


def test_atualizar_item_de_outro_usuario_e_negado():
    modulo, repo = _com_item(id_usuario=OUTRO)

    resultado = modulo.atualizar(DONO, 'LST-1', {'favorito': True})

    assert resultado.codigo == NEGADO
    assert repo.escritas == []


def test_atualizar_grava_apenas_os_campos_enviados_em_uma_escrita():
    modulo, repo = _com_item()

    resultado = modulo.atualizar(DONO, 'LST-1', {'nota_usuario': 8, 'comentario': 'bom'})

    assert resultado.codigo == OK
    assert repo.escritas == [('atualizar_campos', 'LST-1', {'nota_usuario': 8.0, 'comentario': 'bom'})]


def test_atualizar_sem_campos_gravaveis_nao_escreve():
    modulo, repo = _com_item()

    assert modulo.atualizar(DONO, 'LST-1', {}).codigo == OK
    assert repo.escritas == []


def test_atualizar_rejeita_rotulo_de_outro_tipo():
    modulo, repo = _com_item()

    resultado = modulo.atualizar(DONO, 'LST-1', {'status_consumo': 'zerado'})

    assert resultado.codigo == INVALIDO
    assert 'status_consumo' in resultado.detalhes
    assert repo.escritas == []


def test_atualizar_rejeita_progresso_acima_do_total_da_midia():
    modulo, repo = _com_item()

    resultado = modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 25})

    assert resultado.codigo == INVALIDO
    assert repo.escritas == []


def test_atualizar_rejeita_valor_de_tipo_errado():
    modulo, _repo = _com_item()

    resultado = modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 'muitos'})

    assert resultado.codigo == INVALIDO
    assert 'progresso_atual' in resultado.detalhes


def test_progresso_no_total_promove_a_concluido_apesar_do_status_enviado():
    """O estado que o cliente mandou não desfaz a promoção: o módulo é o autor."""
    modulo, repo = _com_item()

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 24, 'status_consumo': 'assistindo'})

    assert repo.itens['LST-1']['status_consumo'] == 'completo'


def test_progresso_no_total_de_manga_promove_ao_rotulo_do_tipo():
    modulo, repo = _com_item(id_midia='MID-MANGA', status_consumo='lendo')

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 100})

    assert repo.itens['LST-1']['status_consumo'] == 'lido'


def test_promocao_preenche_a_data_de_conclusao_quando_vazia():
    modulo, repo = _com_item()

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 24})

    assert repo.itens['LST-1']['data_conclusao'] == date.today().isoformat()


def test_data_de_conclusao_do_payload_prevalece_sobre_a_promocao():
    modulo, repo = _com_item()

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 24, 'data_conclusao': '2026-01-02'})

    assert repo.itens['LST-1']['data_conclusao'] == '2026-01-02'


# --- Concluído ⇔ Progresso = total (ADR 0009) --------------------------------


def test_reduzir_o_progresso_abaixo_do_total_rebaixa_para_em_progresso():
    """A data de conclusão fica: descreve a passagem mais recente (ADR 0003)."""
    modulo, repo = _com_item(status_consumo='completo', progresso_atual=24, data_conclusao='2026-01-02')

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 23})

    assert repo.itens['LST-1']['status_consumo'] == 'assistindo'
    assert repo.itens['LST-1']['data_conclusao'] == '2026-01-02'


def test_rebaixar_usa_o_rotulo_do_tipo():
    modulo, repo = _com_item(id_midia='MID-MANGA', status_consumo='lido', progresso_atual=100)

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 61})

    assert repo.itens['LST-1']['status_consumo'] == 'lendo'


def test_editor_reduzindo_o_progresso_de_item_concluido_rebaixa():
    """O editor reenvia o Estado que já estava: isso não é escolher Concluído."""
    modulo, repo = _com_item(status_consumo='completo', progresso_atual=24)

    modulo.atualizar(DONO, 'LST-1', {'status_consumo': 'completo', 'progresso_atual': 7})

    assert repo.itens['LST-1']['status_consumo'] == 'assistindo'
    assert repo.itens['LST-1']['progresso_atual'] == 7


def test_escolher_concluido_leva_o_progresso_ao_total():
    modulo, repo = _com_item(progresso_atual=3)

    modulo.atualizar(DONO, 'LST-1', {'status_consumo': 'completo', 'progresso_atual': 3})

    assert repo.itens['LST-1']['status_consumo'] == 'completo'
    assert repo.itens['LST-1']['progresso_atual'] == 24
    assert repo.itens['LST-1']['data_conclusao'] == date.today().isoformat()


def test_adicionar_ja_concluido_entra_com_o_progresso_no_total():
    modulo, repo = _modulo()

    resultado = modulo.adicionar(DONO, {'id_midia': 'MID-MANGA', 'status_consumo': 'lido'})

    item = repo.obter_item_por_id(resultado.id_lista)
    assert item['status_consumo'] == 'lido'
    assert item['progresso_atual'] == 100


def test_reentrar_em_concluido_soma_recontagem_e_renova_a_data():
    modulo, repo = _com_item(progresso_atual=23, data_conclusao='2020-01-01', total_rewatches=1)

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 24})

    assert repo.itens['LST-1']['status_consumo'] == 'completo'
    assert repo.itens['LST-1']['total_rewatches'] == 2
    assert repo.itens['LST-1']['data_conclusao'] == date.today().isoformat()


def test_reentrar_em_concluido_respeita_a_data_do_payload():
    modulo, repo = _com_item(progresso_atual=23, data_conclusao='2020-01-01', total_rewatches=0)

    modulo.atualizar(DONO, 'LST-1', {'status_consumo': 'completo', 'data_conclusao': '2026-03-04'})

    assert repo.itens['LST-1']['total_rewatches'] == 1
    assert repo.itens['LST-1']['data_conclusao'] == '2026-03-04'


def test_editor_reenviando_data_e_recontagem_guardadas_nao_conta_como_decisao():
    """O editor manda o formulário inteiro: valor igual ao guardado é silêncio, não escolha."""
    modulo, repo = _com_item(progresso_atual=0, data_conclusao='2020-01-01', total_rewatches=1)

    modulo.atualizar(DONO, 'LST-1', {
        'status_consumo': 'completo',
        'progresso_atual': 0,
        'data_conclusao': '2020-01-01',
        'total_rewatches': 1,
    })

    assert repo.itens['LST-1']['progresso_atual'] == 24
    assert repo.itens['LST-1']['total_rewatches'] == 2
    assert repo.itens['LST-1']['data_conclusao'] == date.today().isoformat()


def test_recontagem_mudada_no_payload_prevalece_ao_reentrar():
    modulo, repo = _com_item(progresso_atual=23, data_conclusao='2020-01-01', total_rewatches=1)

    modulo.atualizar(DONO, 'LST-1', {'status_consumo': 'completo', 'total_rewatches': 5})

    assert repo.itens['LST-1']['total_rewatches'] == 5


def test_primeira_conclusao_nao_soma_recontagem():
    modulo, repo = _com_item(progresso_atual=23, total_rewatches=0)

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 24})

    assert repo.itens['LST-1'].get('total_rewatches', 0) == 0


def test_item_que_continua_concluido_nao_soma_recontagem():
    modulo, repo = _com_item(status_consumo='completo', progresso_atual=24,
                             data_conclusao='2020-01-01', total_rewatches=1)

    modulo.atualizar(DONO, 'LST-1', {'status_consumo': 'completo', 'progresso_atual': 24, 'favorito': True})

    assert repo.itens['LST-1']['total_rewatches'] == 1
    assert repo.itens['LST-1']['data_conclusao'] == '2020-01-01'


def test_sem_total_conhecido_concluido_e_progresso_nao_se_mexem():
    midias = _catalogo()
    midias['MID-MANGA'] = {'tipo': 'manga', 'progresso_total_padrao': None}
    item = _item(id_midia='MID-MANGA', status_consumo='lido', progresso_atual=50)
    lista = FakeListaRepository(midias=midias, itens={'LST-1': item})
    modulo = ListaPessoal(lista, FakeMidiaRepository(midias))

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 40})
    assert lista.itens['LST-1']['status_consumo'] == 'lido'

    modulo.atualizar(DONO, 'LST-1', {'status_consumo': 'lendo'})
    modulo.atualizar(DONO, 'LST-1', {'status_consumo': 'lido'})
    assert lista.itens['LST-1']['progresso_atual'] == 40


def test_jogo_platinado_nao_e_afetado_pelo_progresso():
    midias = _catalogo()
    midias['MID-JOGO'] = {'tipo': 'jogo', 'progresso_total_padrao': 40}
    item = _item(id_midia='MID-JOGO', status_consumo='platinado', progresso_atual=40)
    lista = FakeListaRepository(midias=midias, itens={'LST-1': item})
    modulo = ListaPessoal(lista, FakeMidiaRepository(midias))

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 10})
    modulo.atualizar(DONO, 'LST-1', {'status_consumo': 'zerado'})

    assert lista.itens['LST-1']['status_consumo'] == 'zerado'
    assert lista.itens['LST-1']['progresso_atual'] == 10
    assert lista.itens['LST-1'].get('total_rewatches') is None


def test_promocao_nao_mexe_em_item_ja_concluido():
    modulo, repo = _com_item(id_midia='MID-MANGA', status_consumo='lido', progresso_atual=100,
                             data_conclusao='2020-01-01')

    modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 100})

    assert repo.escritas == [('atualizar_campos', 'LST-1', {'progresso_atual': 100})]


def test_jogo_nunca_deriva_concluido_do_progresso():
    """As horas do editor não medem Progresso (ver CONTEXT.md, Progresso)."""
    midias = _catalogo()
    midias['MID-JOGO'] = {'tipo': 'jogo', 'progresso_total_padrao': 40}
    item = _item(id_midia='MID-JOGO', status_consumo='jogando')
    lista = FakeListaRepository(midias=midias, itens={'LST-1': item})
    modulo = ListaPessoal(lista, FakeMidiaRepository(midias))

    resultado = modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 40})

    assert resultado.codigo == OK
    assert lista.itens['LST-1']['status_consumo'] == 'jogando'
    assert lista.itens['LST-1']['data_conclusao'] is None


def test_sem_total_conhecido_nao_ha_teto_de_progresso():
    modulo, repo = _com_item(id_midia='MID-JOGO', status_consumo='jogando')

    assert modulo.atualizar(DONO, 'LST-1', {'progresso_atual': 999}).codigo == OK
    assert repo.itens['LST-1']['progresso_atual'] == 999


def test_atualizar_ignora_progresso_total_do_payload():
    modulo, repo = _com_item()

    modulo.atualizar(DONO, 'LST-1', {'progresso_total': 999, 'favorito': True})

    assert repo.escritas == [('atualizar_campos', 'LST-1', {'favorito': True})]


def test_atualizar_converte_booleanos_e_nota():
    modulo, repo = _com_item()

    modulo.atualizar(DONO, 'LST-1', {'favorito': 'true', 'privado': 0, 'nota_usuario': '7'})

    assert repo.escritas == [(
        'atualizar_campos', 'LST-1', {'favorito': True, 'privado': False, 'nota_usuario': 7.0},
    )]


def test_nota_vazia_apaga_a_nota():
    modulo, repo = _com_item()

    modulo.atualizar(DONO, 'LST-1', {'nota_usuario': ''})

    assert repo.escritas == [('atualizar_campos', 'LST-1', {'nota_usuario': None})]


def test_campo_vazio_que_nao_pode_ser_apagado_e_ignorado():
    """Progresso e contadores vazios não são um pedido de apagar: são silêncio."""
    modulo, repo = _com_item()

    resultado = modulo.atualizar(DONO, 'LST-1', {
        'progresso_atual': '',
        'total_rewatches': None,
        'status_consumo': '',
    })

    assert resultado.codigo == OK
    assert repo.escritas == []


def test_recontagem_pode_voltar_o_item_ao_estado_em_progresso():
    """Estado enviado pelo cliente é decisão dele: reassistir não é rebaixamento."""
    modulo, repo = _com_item(status_consumo='completo', progresso_atual=24,
                             data_conclusao='2020-01-01')

    modulo.atualizar(DONO, 'LST-1', {'status_consumo': 'assistindo', 'total_rewatches': 1})

    assert repo.itens['LST-1']['status_consumo'] == 'assistindo'


# --- remover -----------------------------------------------------------------


def test_remover_apaga_o_item_do_dono():
    modulo, repo = _com_item()

    assert modulo.remover(DONO, 'LST-1').codigo == OK
    assert repo.itens == {}


def test_remover_item_de_outro_usuario_nao_apaga():
    modulo, repo = _com_item(id_usuario=OUTRO)

    assert modulo.remover(DONO, 'LST-1').codigo == NAO_ENCONTRADO
    assert 'LST-1' in repo.itens


def test_remover_item_inexistente_nao_e_encontrado():
    modulo, _repo = _modulo()

    assert modulo.remover(DONO, 'LST-404').codigo == NAO_ENCONTRADO
