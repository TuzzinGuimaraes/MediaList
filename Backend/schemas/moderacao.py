"""Modelos do contrato das rotas do blueprint `moderacao` (ADR 0011)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from contrato import Id, Instante, TipoDeMidia
from schemas.auth import NivelAcesso
from schemas.avaliacoes import CamposDaAvaliacao


class AvaliacaoModeracao(CamposDaAvaliacao):
    titulo_ingles: str | None
    titulo_romaji: str | None
    titulo_original: str
    tipo: TipoDeMidia


class RespostaAvaliacoesModeracao(BaseModel):
    avaliacoes: list[AvaliacaoModeracao] = Field(description='As 50 mais recentes')


class UsuarioModeracao(BaseModel):
    id_usuario: Id
    nome_completo: str
    email: str
    data_cadastro: Instante
    ultimo_acesso: Instante | None
    ativo: bool
    nivel_acesso: NivelAcesso
    total_midias: int = Field(description='Itens na Lista pessoal')
    total_avaliacoes: int
