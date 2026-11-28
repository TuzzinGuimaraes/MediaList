"""Modelos do contrato das rotas do blueprint `usuario` (ADR 0011)."""
from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field

from contrato import (
    POR_PAGINA_MAX,
    ConsultaPaginada,
    Id,
    Instante,
    Nota,
    PorPagina,
    TextoOpcional,
    TipoDeMidia,
    VazioComoAusente,
)
from dominio.conquistas import OrdemDoSeletor
from schemas.auth import NivelAcesso, Permissoes
from schemas.lista import ConquistaDoItem


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
    nivel_acesso: NivelAcesso


class RespostaPerfil(BaseModel):
    perfil: Perfil


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



class ConquistaEmDestaque(BaseModel):
    """Uma conquista obtida no Perfil (`repositories.destaques`), com o jogo dela."""

    steam_appid: int
    codigo: str
    nome: str
    icone: str | None = Field(description='O ícone colorido')
    raridade: float | None = Field(description='% dos jogadores que a têm')
    obtida_em: Instante | None
    id_lista: Id
    id_midia: Id
    jogo: str = Field(description='Título exibido do jogo')


class ConsultaConquistas(ConsultaPaginada):
    """`GET /usuario/conquistas`: o seletor de destaques do Perfil."""

    por_pagina: PorPagina = POR_PAGINA_MAX
    busca: TextoOpcional = Field(default=None, description='No nome da conquista, sem caixa nem acento')
    steam_appid: Annotated[int | None, VazioComoAusente] = Field(default=None, description='Só as desse jogo')
    so_destacadas: bool = Field(default=False, description='Só as que estão nos destaques do Perfil')
    ordem: Annotated[OrdemDoSeletor, BeforeValidator(lambda v: v or 'raridade')] = Field(
        default='raridade',
        description='`raridade`: a mais rara primeiro, sem raridade no fim; `data`: a obtida mais recente primeiro',
    )


class ConquistaDoSeletor(ConquistaDoItem):
    """Uma conquista obtida do Usuário no seletor (sempre `obtida`), com o Item e o jogo dela."""

    id_lista: Id
    id_midia: Id
    jogo: str = Field(description='Título exibido do jogo')


class JogoComConquistas(BaseModel):
    steam_appid: int
    id_midia: Id
    jogo: str = Field(description='Título exibido do jogo')
    obtidas: int = Field(description='Conquistas obtidas no jogo')


class RespostaJogosComConquistas(BaseModel):
    """Os jogos com ao menos uma conquista obtida, pelo título, para o filtro do seletor."""

    jogos: list[JogoComConquistas]


class TotalDeConquistas(BaseModel):
    conquistas: int = Field(description='Conquistas obtidas em todos os jogos')
    jogos: int = Field(description='Jogos com ao menos uma conquista obtida')


class RespostaDestaques(BaseModel):
    """Os destaques do Perfil, da mais rara para a mais comum; sem nenhuma obtida, vazio e total zero."""

    destaques: list[ConquistaEmDestaque] = Field(description='Até 6')
    automaticos: bool = Field(description='O Usuário não escolheu: são as obtidas mais raras')
    total: TotalDeConquistas
