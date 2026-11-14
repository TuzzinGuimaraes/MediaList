"""Modelos do contrato das rotas do blueprint `moderacao` (ADR 0011)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from contrato import ConsultaPaginada, Id, Instante, Nota, TipoDeMidia


class AvaliacaoModeracao(BaseModel):
    id_avaliacao: Id
    id_usuario: Id
    id_midia: Id
    nota: Nota
    titulo_avaliacao: str | None
    texto_avaliacao: str | None
    data_avaliacao: Instante
    data_edicao: Instante | None
    nome_completo: str = Field(description='Nome do autor')
    titulo_portugues: str | None
    titulo_original: str
    tipo: TipoDeMidia


class RespostaAvaliacoesModeracao(BaseModel):
    avaliacoes: list[AvaliacaoModeracao] = Field(description='As 50 mais recentes')


class ConsultaUsuariosModeracao(ConsultaPaginada):
    pass


class UsuarioModeracao(BaseModel):
    id_usuario: Id
    nome_completo: str
    email: str
    data_cadastro: Instante
    ultimo_acesso: Instante | None
    ativo: bool
    grupos: str | None = Field(description='Nomes dos Grupos separados por vírgula; null sem Grupo')
    total_midias: int = Field(description='Itens na Lista pessoal')
    total_avaliacoes: int


class StatusUsuarioAlterado(BaseModel):
    mensagem: str
