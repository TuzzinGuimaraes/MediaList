"""
Schema de payloads da lista do usuário.

A validação aqui é cega ao Tipo de mídia: aceita qualquer Rótulo de estado
conhecido. A checagem de que o rótulo se aplica *àquela* mídia acontece na rota,
que é onde o tipo é conhecido. Ver `estado_consumo`.
"""
from .base import ListaSchema
from .estado_consumo import ROTULOS_VALIDOS


STATUS_CONSUMO_VALIDOS = set(ROTULOS_VALIDOS)


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
