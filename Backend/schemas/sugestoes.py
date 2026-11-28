"""Modelos do contrato de `GET /sugestoes` (spec `sugestoes`, ADR 0011)."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from contrato import Nota, VazioComoAusente
from dominio.sugestoes import Porque
from schemas.midias import Midia


class ConsultaSugestoes(BaseModel):
    tipo: Annotated[Literal['anime', 'manga'] | None, VazioComoAusente] = Field(
        default=None, description='O recorte do Início: só anime, só mangá ou, sem `tipo`, os dois juntos',
    )


class MotivoDaSugestao(BaseModel):
    """Por que a obra é Sugestão; o texto sai do domínio da interface (`dominio/sugestoes.ts`)."""

    porque: Porque = Field(
        description='`nota`: a semente tem Nota pessoal 8 ou mais; `favorito`: é Favorito; '
        '`em_alta`: completa a faixa com o Em alta',
    )
    nota: Nota | None = Field(description='A Nota pessoal da semente; só em `nota`')
    titulo: str | None = Field(description='O título exibido da semente; nulo em `em_alta`')


class Sugestao(Midia):
    motivo: MotivoDaSugestao


class RespostaSugestoes(BaseModel):
    sugestoes: list[Sugestao] = Field(
        description='Até 12, por pontos; abaixo de 12, o Em alta do recorte completa, sem o que está na Lista',
    )
