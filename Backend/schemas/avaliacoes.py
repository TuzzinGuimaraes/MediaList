"""Modelos do contrato das rotas do blueprint `avaliacoes` (ADR 0011)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from contrato import Id, Instante, Nota

_DESCRICAO_NOTA = 'De 0 a 10, com no máximo uma casa decimal'


class CamposDaAvaliacao(BaseModel):
    """Os campos de uma Avaliação, com o nome do autor; na Mídia e na moderação."""

    id_avaliacao: Id
    id_usuario: Id
    id_midia: Id
    nota: Nota
    titulo_avaliacao: str | None
    texto_avaliacao: str | None
    data_avaliacao: Instante
    data_edicao: Instante | None
    nome_completo: str = Field(description='Nome do autor')


class AvaliacaoDaMidia(CamposDaAvaliacao):
    foto_perfil: str | None = Field(description='Foto do autor')


class CorpoNovaAvaliacao(BaseModel):
    id_midia: Id
    nota: Nota = Field(description=_DESCRICAO_NOTA)
    titulo_avaliacao: str | None = None
    texto_avaliacao: str | None = None


class CorpoEdicaoAvaliacao(BaseModel):
    """Só os campos enviados são gravados."""

    nota: Nota | None = Field(default=None, description=_DESCRICAO_NOTA)
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
