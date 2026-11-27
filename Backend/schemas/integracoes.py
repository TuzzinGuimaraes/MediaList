"""Modelos do contrato das rotas do blueprint `integracoes` (ADR 0011, ADR 0015)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field
from spectree.model_adapter.pydantic_adapter import BaseFile

from contrato import Id, Instante, TipoDeMidia

#: Valores de `integracoes.plataforma` (CHECK da migração 0008).
NomePlataforma = Literal['anilist', 'mal', 'steam']


class NaoEncontrado(BaseModel):
    """Item da origem que não casou com o Catálogo: o Usuário vincula a uma Mídia (`POST /integracoes/vinculos`)."""

    titulo: str
    link: str | None
    origem_id: str | None = Field(default=None, description='Id na plataforma; null nos resultados antigos')
    tipo: TipoDeMidia | None = Field(default=None, description='Tipo do item; null nos resultados antigos')


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


class ArquivoXml(BaseModel):
    """O XML exportado do MyAnimeList (também o do AniList e do Kitsu), `.xml` ou `.xml.gz`, até 5 MB."""

    arquivo: BaseFile


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


class NovoVinculo(BaseModel):
    """Vincular um Não encontrado (`origem_id` dos Não encontrados da plataforma) a uma Mídia do mesmo Tipo."""

    plataforma: NomePlataforma
    origem_id: str = Field(min_length=1, max_length=64)
    id_midia: str = Field(min_length=1, max_length=64)


class VinculoCriado(BaseModel):
    """O vínculo (vale para todos) e o que ele fez na Lista do Usuário."""

    id_vinculo: Id
    id_midia: Id
    novos: int
    atualizados: int


class VinculoAdmin(BaseModel):
    """Um vínculo feito por um Usuário, para o admin conferir e desfazer."""

    id_vinculo: Id
    plataforma: NomePlataforma
    origem_id: str
    tipo: TipoDeMidia
    link: str | None = Field(description='Página do item na plataforma')
    id_midia: Id
    titulo_original: str
    titulo_ingles: str | None
    titulo_romaji: str | None
    id_usuario: Id | None = Field(description='Autor; null se a conta foi apagada')
    nome_completo: str | None
    criado_em: Instante
