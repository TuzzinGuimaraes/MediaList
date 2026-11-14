"""Modelos do contrato das rotas do blueprint `avaliacoes` (ADR 0011)."""
from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, Field, PlainValidator
from pydantic_core import PydanticCustomError

from contrato import ConsultaPaginada, Id, Instante, Nota


def _numero_ou_texto(valor: Any) -> Any:
    # Um erro só, em `nota` (a união daria um erro por membro, em `nota.float` e `nota.str`).
    if isinstance(valor, bool) or not isinstance(valor, (int, float, str)):
        raise PydanticCustomError('float_type', 'Deve ser número ou texto')
    return float(valor) if isinstance(valor, int) else valor


#: Nota como o cliente manda: número ou texto ('7,5'). A escala quem confere é
#: `dominio.nota`, para a mensagem ser a mesma em toda nota do domínio.
NotaRecebida = Annotated[float | str, PlainValidator(_numero_ou_texto, json_schema_input_type=float | str)]

_DESCRICAO_NOTA = 'De 0 a 10, com no máximo uma casa decimal; aceita texto com vírgula ("7,5")'


class ConsultaAvaliacoes(ConsultaPaginada):
    pass


class AvaliacaoDaMidia(BaseModel):
    id_avaliacao: Id
    id_usuario: Id
    id_midia: Id
    nota: Nota
    titulo_avaliacao: str | None
    texto_avaliacao: str | None
    data_avaliacao: Instante
    data_edicao: Instante | None
    nome_completo: str = Field(description='Nome do autor')
    foto_perfil: str | None = Field(description='Foto do autor')


class CorpoNovaAvaliacao(BaseModel):
    id_midia: Id
    nota: NotaRecebida = Field(description=_DESCRICAO_NOTA)
    titulo_avaliacao: str | None = None
    texto_avaliacao: str | None = None


class CorpoEdicaoAvaliacao(BaseModel):
    """Só os campos enviados são gravados."""

    nota: NotaRecebida | None = Field(default=None, description=_DESCRICAO_NOTA)
    titulo_avaliacao: str | None = None
    texto_avaliacao: str | None = None


class AvaliacaoCriada(BaseModel):
    mensagem: str
    id_avaliacao: Id
    nota_media_atualizada: Nota | None = Field(description='Nota média da Mídia depois da gravação')
    total_avaliacoes: int


class AvaliacaoEditada(BaseModel):
    mensagem: str
    nota_media_atualizada: Nota | None = Field(description='Nota média da Mídia depois da gravação')


class AvaliacaoRemovida(BaseModel):
    mensagem: str
