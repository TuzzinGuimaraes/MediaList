"""Modelos do contrato das rotas do blueprint `usuario` (ADR 0011)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from contrato import Id, Instante, Nota, TipoDeMidia
from schemas.auth import NivelAcesso


class Perfil(BaseModel):
    """Linha de `vw_perfil_usuario`."""

    id_usuario: Id
    nome_completo: str
    email: str
    foto_perfil: str | None
    biografia: str | None
    data_cadastro: Instante
    total_midias: int
    total_animes: int
    total_mangas: int
    total_jogos: int
    nota_media_usuario: Nota | None = Field(description='Média das Notas pessoais; nula sem nenhuma')
    total_favoritos: int
    grupos: str | None


class RespostaPerfil(BaseModel):
    perfil: Perfil


class Permissoes(BaseModel):
    """Permissões efetivas: vence o Grupo mais privilegiado."""

    nivel_acesso: NivelAcesso
    grupos: str | None
    pode_criar: bool
    pode_editar: bool
    pode_deletar: bool
    pode_moderar: bool


class RespostaPermissoes(BaseModel):
    permissoes: Permissoes


class EstatisticaPorTipo(BaseModel):
    tipo: TipoDeMidia
    total_midias: int
    concluidos: int = Field(description='Concluídos e Platinados')
    em_andamento: int = Field(description='Em progresso')
    progresso_total_consumido: int
    nota_media: Nota | None = Field(description='Média das Notas pessoais do Tipo; nula sem nenhuma')
    favoritos: int


class ResumoEstatisticas(BaseModel):
    total_midias: int
    concluidos: int
    em_andamento: int
    favoritos: int


class RespostaEstatisticas(BaseModel):
    estatisticas: list[EstatisticaPorTipo] = Field(description='Uma linha por Tipo presente na Lista pessoal')
    resumo: ResumoEstatisticas
