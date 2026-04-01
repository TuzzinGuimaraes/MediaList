"""
Validação leve dos payloads da API.
"""
from __future__ import annotations

from typing import Any


class ValidationError(ValueError):
    """Erro de validação com estrutura amigável para resposta JSON."""

    def __init__(self, errors: dict[str, str]):
        super().__init__('Payload inválido')
        self.errors = errors


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        if value.lower() in {'true', '1', 'sim', 'yes'}:
            return True
        if value.lower() in {'false', '0', 'nao', 'não', 'no'}:
            return False
    return bool(value)


class BaseSchema:
    """Base simples para schemas declarativos."""

    required_fields: set[str] = set()
    field_types: dict[str, type | tuple[type, ...]] = {}
    allowed_values: dict[str, set[Any]] = {}
    cast_fields: dict[str, Any] = {}

    def load(self, data: dict[str, Any] | None, partial: bool = False) -> dict[str, Any]:
        if not isinstance(data, dict):
            raise ValidationError({'payload': 'JSON inválido ou ausente'})

        errors: dict[str, str] = {}
        cleaned: dict[str, Any] = {}

        for field in self.required_fields:
            if not partial and (field not in data or data[field] in (None, '', [])):
                errors[field] = 'Campo obrigatório'

        for field, value in data.items():
            if value == '' and field not in self.required_fields:
                cleaned[field] = None
                continue

            caster = self.cast_fields.get(field)
            if caster and value is not None:
                try:
                    value = caster(value)
                except (TypeError, ValueError):
                    errors[field] = 'Valor inválido'
                    continue

            expected_type = self.field_types.get(field)
            if expected_type and value is not None and not isinstance(value, expected_type):
                errors[field] = 'Tipo inválido'
                continue

            if field in self.allowed_values and value is not None and value not in self.allowed_values[field]:
                errors[field] = 'Valor fora dos permitidos'
                continue

            cleaned[field] = value

        if errors:
            raise ValidationError(errors)

        return cleaned


class BaseMediaSchema(BaseSchema):
    """Campos comuns a todas as mídias."""

    field_types = {
        'titulo_original': str,
        'titulo_ingles': str,
        'titulo_portugues': str,
        'sinopse': str,
        'data_lancamento': str,
        'poster_url': str,
        'banner_url': str,
        'nota_media': (int, float),
        'generos': list,
    }
    cast_fields = {
        'nota_media': float,
    }


class ListaSchema(BaseSchema):
    """Validação do payload de lista do usuário."""

    field_types = {
        'id_midia': str,
        'id_anime': str,
        'status': str,
        'status_consumo': str,
        'status_visualizacao': str,
        'progresso_atual': int,
        'episodios_assistidos': int,
        'progresso_total': int,
        'nota_usuario': (int, float),
        'favorito': bool,
        'comentario': str,
        'data_inicio': str,
        'data_conclusao': str,
        'total_rewatches': int,
        'privado': bool,
    }
    cast_fields = {
        'progresso_atual': int,
        'episodios_assistidos': int,
        'progresso_total': int,
        'nota_usuario': float,
        'favorito': _coerce_bool,
        'total_rewatches': int,
        'privado': _coerce_bool,
    }
