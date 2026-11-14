"""Modelos do contrato das rotas do blueprint `utils` (ADR 0011)."""
from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel

from contrato import Id, TipoDeMidia, VazioComoAusente


class ConsultaGeneros(BaseModel):
    tipo: Annotated[TipoDeMidia | None, VazioComoAusente] = None


class Genero(BaseModel):
    id_genero: Id
    nome_genero: str
    aplicavel_a: list[TipoDeMidia]


class RespostaGeneros(BaseModel):
    generos: list[Genero]
