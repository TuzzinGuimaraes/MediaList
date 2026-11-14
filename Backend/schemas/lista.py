"""Modelos do contrato das rotas do blueprint `lista` (ADR 0011).

Os modelos de entrada só checam o formato de cada campo. As regras do Item de
lista (Rótulo por Tipo, casa decimal da Nota pessoal, teto do Progresso,
Concluído ⇔ total, dono) continuam em `dominio.lista_pessoal` (ADR 0009). A
exceção é a Nota pessoal, que é a `Nota` do contrato (0 a 10), a mesma da
Avaliação.

String vazia vale como ausente em todo campo opcional (`VazioComoAusente`),
como o domínio já fazia: `nota_usuario: ''` apaga a Nota pessoal, e num campo
que não pode ser esvaziado (`status_consumo`, contadores, marcas) é não dizer
nada sobre ele.
"""
from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field

from contrato import Data, Id, Instante, Nota, TextoOpcional, TipoDeMidia, VazioComoAusente
from schemas.estado_consumo import RotuloDeEstado
from schemas.midias import CamposDaMidia

# ============================================
# Entrada
# ============================================


class ConsultaLista(BaseModel):
    tipo: Annotated[TipoDeMidia | None, VazioComoAusente] = None
    status_consumo: Annotated[str | None, VazioComoAusente] = Field(default=None, description='Rótulo de estado')


class CamposDoItem(BaseModel):
    """Campos graváveis de um Item de lista; os que não vierem não mudam.

    Campo fora do modelo (o cliente reenvia o Item inteiro) é ignorado.
    """

    progresso_atual: Annotated[int | None, VazioComoAusente] = None
    nota_usuario: Annotated[Nota | None, VazioComoAusente] = Field(
        default=None, description='Nota pessoal, de 0 a 10 com no máximo uma casa; null apaga',
    )
    favorito: Annotated[bool | None, VazioComoAusente] = None
    privado: Annotated[bool | None, VazioComoAusente] = None
    comentario: TextoOpcional = None
    data_inicio: Annotated[Data | None, VazioComoAusente] = None
    data_conclusao: Annotated[Data | None, VazioComoAusente] = None
    total_rewatches: Annotated[int | None, VazioComoAusente] = Field(default=None, description='Recontagem')


class NovoItemLista(CamposDoItem):
    """Corpo de POST /lista e /lista/adicionar."""

    id_midia: Id
    status_consumo: str = Field(description='Rótulo de estado do Tipo da Mídia')


class EdicaoItemLista(CamposDoItem):
    """Corpo de PUT /lista/<id_lista>."""

    status_consumo: Annotated[str | None, VazioComoAusente] = Field(default=None, description='Rótulo de estado')


class ProgressoItemLista(BaseModel):
    """Corpo de PUT /lista/<id_lista>/progresso: o Progresso é o motivo da chamada."""

    progresso_atual: int


# ============================================
# Saída
# ============================================


class ItemLista(CamposDaMidia):
    """Um Item de GET /lista: a Mídia (os campos comuns de `Midia`) mais os campos do Item."""

    id_lista: Id
    status_consumo: RotuloDeEstado
    progresso_atual: int | None
    progresso_total: int | None = Field(description='Total copiado da Mídia na criação do Item')
    nota_usuario: Nota | None = Field(description='Nota pessoal')
    favorito: bool
    privado: bool
    data_inicio: Data | None
    data_conclusao: Data | None
    total_rewatches: int = Field(description='Recontagem')
    comentario: str | None
    data_adicao: Instante
    data_atualizacao: Instante


class RespostaLista(BaseModel):
    lista: list[ItemLista]


class ItemCriado(BaseModel):
    mensagem: str
    id_lista: Id
