"""Modelos do contrato das rotas do blueprint `auth` (ADR 0011)."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from contrato import Data, Id, Preenchido, VazioComoAusente

#: Em ordem crescente (ADR 0012). Um Nível novo é mudança aditiva.
NivelAcesso = Literal['usuario', 'admin']


# ============================================
# Entrada
# ============================================

class CorpoRegistro(BaseModel):
    nome_completo: Preenchido
    email: Preenchido
    senha: Preenchido
    data_nascimento: Annotated[Data | None, VazioComoAusente] = None
    biografia: str | None = ''


class CorpoLogin(BaseModel):
    email: Preenchido
    senha: Preenchido


class CorpoRefresh(BaseModel):
    """Ausente ou vazio responde 401, como um token desconhecido."""

    refresh_token: str | None = None


class CorpoLogout(BaseModel):
    refresh_token: str | None = Field(default=None, description='Refresh do aparelho, para encerrar a sessão nele')


class CorpoEsqueciSenha(BaseModel):
    email: Preenchido


class CorpoRedefinirSenha(BaseModel):
    nova_senha: Annotated[str, Field(min_length=6)]


# ============================================
# Saída
# ============================================

class UsuarioCriado(BaseModel):
    mensagem: str
    id_usuario: Id


class Permissoes(BaseModel):
    """Nível de acesso do Usuário (ADR 0012). No login e em GET /usuario/permissoes."""

    nivel_acesso: NivelAcesso


class UsuarioDaSessao(BaseModel):
    """`id` e `nome` (e não `id_usuario`/`nome_completo`) são legado intencional: o app lê
    `usuario.id` e o web lê `usuario.nome` da sessão guardada."""

    id: Id
    nome: str
    email: str
    permissoes: Permissoes


class RespostaLogin(BaseModel):
    access_token: str
    refresh_token: str | None = Field(description='Nulo se o banco não gravou o refresh; o login vale mesmo assim')
    usuario: UsuarioDaSessao


class RespostaRefresh(BaseModel):
    access_token: str
    refresh_token: str


class UsuarioAtual(BaseModel):
    id_usuario: Id
    nome_completo: str
    email: str
    foto_perfil: str | None


class RespostaMe(BaseModel):
    usuario: UsuarioAtual
