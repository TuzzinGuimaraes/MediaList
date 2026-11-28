"""Modelos do contrato das rotas do blueprint `usuario` (ADR 0011)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from contrato import Id, Instante, Nota, TipoDeMidia
from schemas.auth import NivelAcesso, Permissoes


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


class TotalDeConquistas(BaseModel):
    conquistas: int = Field(description='Conquistas obtidas em todos os jogos')
    jogos: int = Field(description='Jogos com ao menos uma conquista obtida')


class RespostaDestaques(BaseModel):
    """Os destaques do Perfil, da mais rara para a mais comum; sem nenhuma obtida, vazio e total zero."""

    destaques: list[ConquistaEmDestaque] = Field(description='Até 6')
    automaticos: bool = Field(description='O Usuário não escolheu: são as obtidas mais raras')
    total: TotalDeConquistas
