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

from pydantic import BaseModel, BeforeValidator, Field, model_validator

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
from schemas.avaliacoes import AvaliacaoDaMidia
from schemas.estado_consumo import RotuloDeEstado

StatusAnime = Literal['em_exibicao', 'finalizado', 'aguardando', 'cancelado']
StatusManga = Literal['em_publicacao', 'finalizado', 'aguardando', 'cancelado', 'hiato']
StatusJogo = Literal['lancado', 'em_desenvolvimento', 'cancelado', 'remasterizado']
Demografia = Literal['shounen', 'shoujo', 'seinen', 'josei', 'kodomomuke']
ModoJogo = Literal['single', 'multi', 'ambos']
OrigemNota = Literal['AniList', 'RAWG']
#: Estação da Temporada de um anime (a divisão do AniList: inverno é janeiro–março).
Estacao = Literal['inverno', 'primavera', 'verao', 'outono']
#: O `format` do AniList; nulo é desconhecido.
FormatoAnime = Literal['TV', 'TV_SHORT', 'ONA', 'MOVIE', 'SPECIAL', 'OVA', 'MUSIC']
#: Ano de lançamento nos filtros de `GET /midias`: o intervalo de uma data.
Ano = Annotated[int, Field(ge=1, le=9999)]
#: Ordens de `GET /midias` (`ORDENS` em `repositories/catalogo.py`).
OrdemCatalogo = Literal[
    'nota_media', 'data_lancamento', 'titulo', 'mais_adicionados', 'popularidade', 'mais_concluidos',
    'popularidade_fonte',
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
    ano_min: Annotated[Ano | None, VazioComoAusente] = Field(
        default=None, description='Ano de lançamento mínimo, inclusive; sem data de lançamento, a Mídia fica fora',
    )
    ano_max: Annotated[Ano | None, VazioComoAusente] = Field(
        default=None, description='Ano de lançamento máximo, inclusive; sem data de lançamento, a Mídia fica fora',
    )
    temporada_estacao: Annotated[Estacao | None, VazioComoAusente] = Field(
        default=None, description='Com `temporada_ano`, só os animes da Temporada',
    )
    temporada_ano: Annotated[Ano | None, VazioComoAusente] = Field(
        default=None, description='Com `temporada_estacao`, só os animes da Temporada',
    )
    ordem: Annotated[OrdemCatalogo, BeforeValidator(lambda v: v or 'nota_media')] = Field(
        default='nota_media', description='`popularidade_fonte`: os mais esperados (Popularidade da fonte)',
    )

    @model_validator(mode='after')
    def _temporada_inteira(self):
        if (self.temporada_estacao is None) != (self.temporada_ano is None):
            raise ValueError('temporada_estacao e temporada_ano vão juntos')
        return self


class ConsultaTrending(BaseModel):
    tipo: Annotated[TipoDeMidia, BeforeValidator(lambda v: v or 'anime')] = 'anime'
    limite: PorPagina = 10


class ConsultaPopulares(BaseModel):
    tipo: Annotated[TipoDeMidia | None, VazioComoAusente] = None


class ConsultaFacetas(BaseModel):
    tipo: Annotated[TipoDeMidia | None, VazioComoAusente] = Field(
        default=None, description='Sem Tipo, as facetas de todos',
    )


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
    episodios_lancados: int | None = Field(
        description='Episódios já lançados, gravados pelo job de episódios; nulo até a primeira passada dele',
    )
    proximo_episodio_em: Instante | None = Field(description='Quando sai o próximo episódio; nulo se não se sabe')
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
    temporada_estacao: Estacao | None = Field(description='Temporada do anime, com `temporada_ano`; nula sem ela')
    temporada_ano: int | None
    temporada_estimada: bool | None = Field(
        description='A Temporada veio da data de estreia, não do AniList, e pode estar errada; nula fora dos animes',
    )
    formato: FormatoAnime | None = Field(description='O formato do AniList; nulo é desconhecido')
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


class Temporada(BaseModel):
    estacao: Estacao
    ano: int


class RespostaFacetas(BaseModel):
    """Valores distintos e ordenados dos filtros de `GET /midias`. Vazio (ou nulo) quando o
    filtro não se aplica ao Tipo (plataformas só nos jogos; estúdios e Temporada só nos animes)."""

    plataformas: list[str]
    estudios: list[str]
    temporada_mais_antiga: Temporada | None = Field(
        description='A Temporada mais antiga dos animes do Catálogo (a primeira do seletor); nula sem nenhuma',
    )


class ContagemPorRotulo(BaseModel):
    status_consumo: RotuloDeEstado
    total: int


class RespostaDistribuicao(BaseModel):
    distribuicao: list[ContagemPorRotulo]


class ContagemPorNota(BaseModel):
    nota: int = Field(ge=1, le=10, description='A faixa: a nota arredondada, meio para cima (7,5 cai no 8)')
    total: int


class RespostaNotas(BaseModel):
    distribuicao: list[ContagemPorNota] = Field(description='As 10 faixas, de 1 a 10, inclusive as vazias')
    minha_avaliacao: AvaliacaoDaMidia | None = Field(description='A do Usuário logado; null sem login ou sem Avaliação')


class AtividadeDoDia(BaseModel):
    data: Data
    total: int = Field(ge=1, description='Adições à Lista, Avaliações e conclusões da Mídia no dia')


class RespostaAtividade(BaseModel):
    dias: list[AtividadeDoDia] = Field(description='Só os dias com atividade, do mais antigo ao mais recente')
    inicio: Data = Field(description='1º dia da janela: 52 semanas (364 dias) terminando em `fim`')
    fim: Data = Field(description='Hoje')


class AtualizacaoPublicada(BaseModel):
    mensagem: str
    notificacoes_enviadas: int
