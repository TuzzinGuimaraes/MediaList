"""Modelos do contrato das rotas do blueprint `push` (ADR 0011)."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from avisos_push import FORMATO_TOKEN

#: Token Expo do aparelho: `ExponentPushToken[...]` ou `ExpoPushToken[...]`.
TokenPush = Annotated[str, Field(max_length=255, pattern=f'^{FORMATO_TOKEN.pattern}$')]


class CorpoRegistrarToken(BaseModel):
    token: TokenPush
    plataforma: Literal['android', 'ios']


class CorpoRemoverToken(BaseModel):
    token: TokenPush
