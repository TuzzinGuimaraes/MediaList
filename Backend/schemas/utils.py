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
    """A entrega de uma Atualização de mídia ou de uma Notícia a um Usuário.

    `origem` diz qual das duas: na de Notícia, `id_noticia` vem preenchido e os campos da
    Mídia vêm nulos; na de Atualização, o contrário.
    """

    origem: Literal['atualizacao', 'noticia']
    id_noticia: Id | None = Field(description='A Notícia, na de origem `noticia`')
    id_midia: Id | None = Field(description='A Mídia, na de origem `atualizacao`')
    tipo_midia: TipoDeMidia | None
    tipo: str = Field(description='Tipo da Atualização (episodio, capitulo, dlc...) ou `noticia`')
    titulo: str
    midia_nome: str | None = Field(description='Título em português, ou o original; nulo na de Notícia')
    mensagem: str
    lida: bool
    data_criacao: Instante


class RespostaNotificacoes(BaseModel):
    notificacoes: list[Notificacao] = Field(description='As 50 mais recentes')


class Ping(BaseModel):
    status: Literal['ok']


class Saude(BaseModel):
    status: Literal['healthy', 'unhealthy']
    postgres: Literal['connected', 'disconnected']
