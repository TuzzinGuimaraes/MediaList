"""Modelos do contrato das rotas do blueprint `preferencias` (ADR 0011)."""
from __future__ import annotations

from pydantic import BaseModel, Field, StrictBool, StrictStr


class Preferencias(BaseModel):
    """As preferências completas: o que o Usuário mudou, e os padrões no resto."""

    tema: str
    idioma: str
    notificacoes_ativas: bool
    avisar_noticias: bool = Field(description='"Avisar sobre Notícias" (push no app); ligado por padrão')


class RespostaPreferencias(BaseModel):
    preferencias: Preferencias


class CorpoPreferencias(BaseModel):
    """Só os campos enviados mudam; nulo vale como ausente. Tipos estritos: `"true"` não é booleano."""

    tema: StrictStr | None = None
    idioma: StrictStr | None = None
    notificacoes_ativas: StrictBool | None = None
    avisar_noticias: StrictBool | None = None


class PreferenciasAtualizadas(BaseModel):
    mensagem: str
    modificado: bool
