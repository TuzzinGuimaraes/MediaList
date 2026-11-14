"""Modelos do contrato das rotas do blueprint `utils` (ADR 0011)."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from contrato import Id, Instante, TipoDeMidia, VazioComoAusente


class ConsultaGeneros(BaseModel):
    tipo: Annotated[TipoDeMidia | None, VazioComoAusente] = None


class Genero(BaseModel):
    id_genero: Id
    nome_genero: str
    aplicavel_a: list[TipoDeMidia]


class RespostaGeneros(BaseModel):
    generos: list[Genero]


class ConsultaNotificacoes(BaseModel):
    nao_lidas: bool = Field(default=False, description='Só as não lidas')


class Notificacao(BaseModel):
    """A entrega de uma Atualização de mídia a um Usuário."""

    id_midia: Id
    tipo_midia: TipoDeMidia
    tipo: str = Field(description='Tipo da Atualização: episodio, capitulo, dlc...')
    titulo: str
    midia_nome: str = Field(description='Título em português, ou o original')
    mensagem: str
    lida: bool
    data_criacao: Instante


class RespostaNotificacoes(BaseModel):
    notificacoes: list[Notificacao] = Field(description='As 50 mais recentes')


class Saude(BaseModel):
    status: Literal['healthy', 'unhealthy']
    postgres: Literal['connected', 'disconnected']
