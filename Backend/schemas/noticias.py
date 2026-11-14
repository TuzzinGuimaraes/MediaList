"""Modelos do contrato das rotas do blueprint `noticias` (ADR 0011)."""
from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from contrato import Id, Instante


class Noticia(BaseModel):
    id_noticia: Id
    titulo: str
    conteudo: str
    autor: str = Field(description='Nome de quem publicou; "Admin" se o Usuário foi apagado')
    categoria: str
    tags: list[str]
    imagem_url: str | None
    data_publicacao: Instante


class CorpoNoticia(BaseModel):
    """O autor é o Usuário logado; `autor` no corpo é ignorado."""

    titulo: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    conteudo: str | None = None
    categoria: str | None = Field(default=None, description='Sem ela, "geral"')
    tags: list[str] | None = None
    imagem_url: str | None = None


class NoticiaCriada(BaseModel):
    mensagem: str
    id: Id = Field(description='id_noticia da Notícia criada')
