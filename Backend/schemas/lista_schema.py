"""
Schema de payloads da lista do usuário.
"""
from .base import ListaSchema


STATUS_CONSUMO_VALIDOS = {
    'assistindo', 'completo', 'planejado', 'pausado', 'abandonado',
    'lendo', 'lido',
    'jogando', 'zerado', 'platinado', 'na_fila',
}


class ListaMidiaSchema(ListaSchema):
    required_fields = {'id_midia', 'status'}
    allowed_values = {
        'status': STATUS_CONSUMO_VALIDOS,
        'status_consumo': STATUS_CONSUMO_VALIDOS,
        'status_visualizacao': STATUS_CONSUMO_VALIDOS,
    }


class AtualizacaoListaSchema(ListaSchema):
    allowed_values = {
        'status': STATUS_CONSUMO_VALIDOS,
        'status_consumo': STATUS_CONSUMO_VALIDOS,
        'status_visualizacao': STATUS_CONSUMO_VALIDOS,
    }
