"""Modelos do contrato das rotas do blueprint `noticias` (ADR 0011)."""
from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, model_validator

from contrato import ConsultaPaginada, Id, Instante, VazioComoAusente
from parametros import POR_PAGINA_MAX


class ConsultaNoticias(ConsultaPaginada):
    limite: Annotated[int | None, VazioComoAusente, Field(
        default=None, ge=1, deprecated=True,
        description='Sinônimo antigo de `por_pagina`, até o web e o app migrarem; `por_pagina` vence',
    )]

    @model_validator(mode='after')
    def _limite_como_por_pagina(self):
        # Pelo __dict__: o acesso por atributo a campo `deprecated` emite DeprecationWarning.
        limite = self.__dict__['limite']
        if limite is not None and 'por_pagina' not in self.model_fields_set:
            self.por_pagina = min(limite, POR_PAGINA_MAX)
        return self


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
