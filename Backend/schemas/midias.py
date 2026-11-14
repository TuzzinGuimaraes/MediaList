"""Modelos do contrato das rotas do blueprint `midias` e de `/midias/populares` (ADR 0011).

A saída de uma Mídia é a mesma em `GET /midias`, no detalhe e em trending: os
campos comuns e os de todos os Tipos (nulos fora do Tipo da Mídia). Os apelidos
legados do SELECT do Catálogo (`id_anime`, `codigo_anime`, `anime_trailer_url`...)
ficam fora do modelo e não saem.

A entrada do PUT é parcial: só os campos enviados são gravados, e só os do Tipo
da Mídia (`CorpoAnime`, `CorpoManga`, `CorpoJogo`).
"""
from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, Field

from contrato import (
    ConsultaPaginada,
    Data,
    Id,
    Instante,
    Nota,
    PorPagina,
    Preenchido,
    TextoOpcional,
    TipoDeMidia,
    VazioComoAusente,
)
from schemas.estado_consumo import RotuloDeEstado

StatusAnime = Literal['em_exibicao', 'finalizado', 'aguardando', 'cancelado']
StatusManga = Literal['em_publicacao', 'finalizado', 'aguardando', 'cancelado', 'hiato']
StatusJogo = Literal['lancado', 'em_desenvolvimento', 'cancelado', 'remasterizado']
Demografia = Literal['shounen', 'shoujo', 'seinen', 'josei', 'kodomomuke']
ModoJogo = Literal['single', 'multi', 'ambos']
OrigemNota = Literal['AniList', 'RAWG']
#: Ordens de `GET /midias` (`ORDENS` em `repositories/catalogo.py`).
OrdemCatalogo = Literal[
    'nota_media', 'data_lancamento', 'titulo', 'mais_adicionados', 'popularidade', 'mais_concluidos',
]


# ============================================
# Entrada
# ============================================

class ConsultaMidias(ConsultaPaginada):
    """`GET /midias`: Tipo, filtros, ordem e página."""

    tipo: Annotated[TipoDeMidia | None, VazioComoAusente] = None
    busca: TextoOpcional = None
    genero: TextoOpcional = Field(default=None, description='`nome_genero`')
    status: TextoOpcional = Field(default=None, description='Status do Catálogo; sem Tipo, o de qualquer Tipo')
    autor: TextoOpcional = None
    estudio: TextoOpcional = None
    demografia: TextoOpcional = None
    plataforma: TextoOpcional = None
    desenvolvedor: TextoOpcional = None
    modo_jogo: TextoOpcional = None
    artista: TextoOpcional = None
    ordem: Annotated[OrdemCatalogo, BeforeValidator(lambda v: v or 'nota_media')] = 'nota_media'


class ConsultaTrending(BaseModel):
    tipo: Annotated[TipoDeMidia, BeforeValidator(lambda v: v or 'anime')] = 'anime'
    limite: PorPagina = 10


class ConsultaPopulares(BaseModel):
    tipo: Annotated[TipoDeMidia | None, VazioComoAusente] = None


class _CorpoMidiaBase(BaseModel):
    """Campos comuns do PUT. A Nota média e a Nota da fonte não são graváveis
    pela API (ticket 13): chegam e são ignoradas, como qualquer campo fora do modelo."""

    titulo_original: Preenchido | None = None
    titulo_ingles: TextoOpcional = None
    titulo_portugues: TextoOpcional = None
    sinopse: TextoOpcional = None
    data_lancamento: Annotated[Data | None, VazioComoAusente] = None
    poster_url: TextoOpcional = None
    banner_url: TextoOpcional = None
    generos: list[int] | None = Field(default=None, description='Ids dos gêneros; presente, substitui os da Mídia')


class CorpoAnime(_CorpoMidiaBase):
    status_anime: StatusAnime | None = None
    numero_episodios: Annotated[int | None, VazioComoAusente, Field(ge=0)] = None
    duracao_episodio: Annotated[int | None, VazioComoAusente, Field(ge=0)] = None
    classificacao_etaria: TextoOpcional = None
    trailer_url: TextoOpcional = None
    estudio: TextoOpcional = None
    fonte_original: TextoOpcional = None
    anilist_id: Annotated[int | None, VazioComoAusente] = None


class CorpoManga(_CorpoMidiaBase):
    status_manga: StatusManga | None = None
    numero_capitulos: Annotated[int | None, VazioComoAusente, Field(ge=0)] = None
    numero_volumes: Annotated[int | None, VazioComoAusente, Field(ge=0)] = None
    autor: TextoOpcional = None
    artista: TextoOpcional = None
    publicadora_original: TextoOpcional = None
    revista: TextoOpcional = None
    demografia: Annotated[Demografia | None, VazioComoAusente] = None
    anilist_id: Annotated[int | None, VazioComoAusente] = None


class CorpoJogo(_CorpoMidiaBase):
    desenvolvedor: TextoOpcional = None
    publicadora: TextoOpcional = None
    plataformas: TextoOpcional = Field(default=None, description="Separadas por vírgula: 'PC, Switch'")
    status_jogo: StatusJogo | None = None
    modo_jogo: ModoJogo | None = None
    classificacao: TextoOpcional = None
    trailer_url: TextoOpcional = None
    rawg_slug: TextoOpcional = None


CORPO_POR_TIPO: dict[str, type[_CorpoMidiaBase]] = {'anime': CorpoAnime, 'manga': CorpoManga, 'jogo': CorpoJogo}


class CorpoMidia(CorpoAnime, CorpoManga, CorpoJogo):
    """Corpo do PUT: os campos de todos os Tipos, todos opcionais. Só os do Tipo
    da Mídia são gravados (`campos_do_tipo`); os de outro Tipo são ignorados."""

    def campos_do_tipo(self, tipo: str) -> dict[str, Any]:
        """Os campos enviados que o Tipo grava."""
        return self.model_dump(exclude_unset=True, include=set(CORPO_POR_TIPO[tipo].model_fields))


class CorpoAtualizacao(BaseModel):
    tipo: Preenchido = Field(description='Tipo da Atualização: episodio, capitulo...')
    titulo: Preenchido
    descricao: str | None = None
    dados_adicionais: Annotated[dict[str, Any], BeforeValidator(lambda v: {} if v is None else v)] = Field(
        default_factory=dict,
    )


# ============================================
# Saída
# ============================================

class CamposDaMidia(BaseModel):
    """Os campos da Mídia que saem em toda parte: em `Midia` e na parte da Mídia de cada Item
    de lista (`ItemLista`). Os de outro Tipo vêm nulos."""

    id_midia: Id
    tipo: TipoDeMidia
    titulo_original: str
    titulo_ingles: str | None
    titulo_portugues: str | None
    sinopse: str | None
    data_lancamento: Data | None
    nota_media: Nota | None = Field(description='Média das Avaliações; nula sem elas')
    total_avaliacoes: int | None = Field(description='Nulo quando a Mídia não tem Avaliações')
    nota_fonte: Nota | None = Field(description='Nota do AniList/RAWG, gravada pela Importação')
    origem_nota: OrigemNota | None
    poster_url: str | None
    banner_url: str | None
    status_catalogo: StatusAnime | StatusManga | StatusJogo | None = Field(description='O status do Tipo da Mídia')
    generos: str | None = Field(description="'Ação, Drama'; `generos_lista` é o mesmo já separado")
    generos_lista: list[str]
    total_usuarios: int = Field(description='Usuários com a Mídia na Lista pessoal (Popularidade)')
    total_concluidos: int = Field(description='Itens de lista em Concluído ou Platinado')
    # anime
    status_anime: StatusAnime | None
    numero_episodios: int | None
    estudio: str | None
    fonte_original: str | None
    # mangá
    status_manga: StatusManga | None
    numero_capitulos: int | None
    numero_volumes: int | None
    autor: str | None
    demografia: Demografia | None
    # jogo
    desenvolvedor: str | None
    publicadora: str | None
    plataformas: str | None = Field(description="'PC, Switch'")
    status_jogo: StatusJogo | None
    modo_jogo: ModoJogo | None


class Midia(CamposDaMidia):
    """A Mídia com os campos de todos os Tipos; os de outro Tipo vêm nulos."""

    trailer_url: str | None
    # anime
    duracao_episodio: int | None = Field(description='Minutos')
    classificacao_etaria: str | None
    # mangá
    artista: str | None = Field(validation_alias='manga_artista')
    publicadora_original: str | None
    revista: str | None
    # jogo
    classificacao: str | None


class AtualizacaoDeMidia(BaseModel):
    id_midia: Id
    tipo_midia: TipoDeMidia
    tipo_atualizacao: str
    titulo: str
    descricao: str | None
    dados_adicionais: dict[str, Any]
    data_atualizacao: Instante


class MidiaDetalhe(Midia):
    atualizacoes: list[AtualizacaoDeMidia] = Field(description='As 10 Atualizações de mídia mais recentes')


class RespostaTrending(BaseModel):
    midias: list[Midia]


class MidiaPopular(BaseModel):
    """Linha de `vw_midias_populares`."""

    id_midia: Id
    tipo: TipoDeMidia
    titulo_original: str
    titulo_portugues: str | None
    poster_url: str | None
    nota_media: Nota | None
    nota_fonte: Nota | None
    origem_nota: OrigemNota | None
    total_usuarios: int
    generos: str | None = Field(description="'Ação, Drama'")


class RespostaPopulares(BaseModel):
    midias: list[MidiaPopular]


class ContagemPorRotulo(BaseModel):
    status_consumo: RotuloDeEstado
    total: int


class RespostaDistribuicao(BaseModel):
    distribuicao: list[ContagemPorRotulo]


class AtualizacaoPublicada(BaseModel):
    mensagem: str
    notificacoes_enviadas: int
