"""Modelos do contrato das rotas do blueprint `preferencias` (ADR 0011)."""
from __future__ import annotations

from pydantic import BaseModel, StrictBool, StrictStr


class Preferencias(BaseModel):
    """As preferências completas: o que o Usuário mudou, e os padrões no resto."""

    tema: str
    idioma: str
    notificacoes_ativas: bool


class RespostaPreferencias(BaseModel):
    preferencias: Preferencias


class CorpoPreferencias(BaseModel):
    """Só os campos enviados mudam; nulo vale como ausente. Tipos estritos: `"true"` não é booleano."""

    tema: StrictStr | None = None
    idioma: StrictStr | None = None
    notificacoes_ativas: StrictBool | None = None


class PreferenciasAtualizadas(BaseModel):
    mensagem: str
    modificado: bool
