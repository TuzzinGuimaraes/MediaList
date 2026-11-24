"""Modelos do contrato das rotas do blueprint `integracoes` (ADR 0011, ADR 0015)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from contrato import Id, Instante

#: Valores de `integracoes.plataforma` (CHECK da migração 0008).
NomePlataforma = Literal['anilist', 'mal', 'steam']


class NaoEncontrado(BaseModel):
    """Item da origem que não casou com o Catálogo: o Usuário adiciona à mão."""

    titulo: str
    link: str | None


class ResultadoImportacao(BaseModel):
    """Contagens de uma importação (prévia, confirmação ou a última sincronização)."""

    novos: int
    atualizados: int
    nao_encontrados: list[NaoEncontrado] = Field(description='Amostra (até 100); o total está ao lado')
    total_nao_encontrados: int


class ResultadoSincronizacao(ResultadoImportacao):
    """A sincronização da Steam: grava direto, sem prévia."""

    pendentes: int = Field(description='Jogos ainda não casados com o Catálogo: ficam para a sincronização diária')


class PreviaImportacao(ResultadoImportacao):
    """O que a importação faria; só grava ao confirmar, até `expira_em` (1 h)."""

    id_previa: Id
    expira_em: Instante


class Integracao(BaseModel):
    """Uma plataforma e a conta do Usuário nela, quando conectada."""

    plataforma: NomePlataforma
    rotulo: str = Field(description='Nome da plataforma para a tela')
    disponivel: bool = Field(description='False sem a chave da plataforma no servidor')
    conectada: bool
    identificador: str | None
    nome_exibicao: str | None
    ultima_sincronizacao: Instante | None
    ultimo_resultado: ResultadoImportacao | None


class RespostaIntegracoes(BaseModel):
    integracoes: list[Integracao]


class ConexaoIntegracao(BaseModel):
    """Nome de usuário (AniList, MAL) ou URL do perfil (Steam)."""

    identificador: str = Field(min_length=1, max_length=200)
