"""
Avaliação: a resenha pública de um Usuário sobre uma Mídia (CONTEXT.md).

Regras que vivem aqui, e não na rota:
- a nota segue a escala do domínio (`dominio.nota`): fora dela nada é gravado;
- cada Usuário avalia uma Mídia no máximo uma vez: a UNIQUE do banco decide
  (`banco.Conflito`), sem checagem antes, então a corrida entre dois pedidos
  também vira conflito;
- só o autor edita; apaga o autor ou quem pode moderar. Na edição, Avaliação
  de outro e Avaliação inexistente dão a mesma resposta.

O módulo devolve um `Resultado` sem vocabulário de HTTP; a rota traduz.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from banco import Conflito
from dominio.lista_pessoal import INVALIDO, NAO_ENCONTRADO, NEGADO, OK
from dominio.nota import NotaInvalida, ler_nota

CONFLITO = 'conflito'

#: Campos que o autor pode editar.
CAMPOS_EDITAVEIS = ('nota', 'titulo_avaliacao', 'texto_avaliacao')


@dataclass(frozen=True)
class Resultado:
    """Desfecho de uma operação. `erro` é a mensagem para o cliente; `dados`, o que deu certo."""

    codigo: str
    erro: str | None = None
    detalhes: dict[str, str] = field(default_factory=dict)
    dados: dict[str, Any] = field(default_factory=dict)

    @property
    def bem_sucedido(self) -> bool:
        return self.codigo == OK


def _nota_invalida(erro: NotaInvalida) -> Resultado:
    return Resultado(INVALIDO, str(erro), {'nota': str(erro)})


class Avaliacoes:
    """As Avaliações das Mídias. `repositorio` grava e lê; `catalogo.obter` diz se a Mídia existe."""

    def __init__(self, repositorio, catalogo):
        self._avaliacoes = repositorio
        self._catalogo = catalogo

    def listar(self, id_midia: str) -> Resultado:
        if not self._catalogo.obter(id_midia):
            return Resultado(NAO_ENCONTRADO, 'Mídia não encontrada')
        return Resultado(OK, dados={'avaliacoes': self._avaliacoes.listar(id_midia)})

    def criar(self, id_usuario: str, payload: dict[str, Any] | None) -> Resultado:
        """Grava a Avaliação. `dados`: id_avaliacao, nota_media e total_avaliacoes da Mídia."""
        payload = payload if isinstance(payload, dict) else {}
        id_midia = payload.get('id_midia') or payload.get('id_anime')

        # Nota 0 é nota: só a ausência é recusada aqui.
        if not id_midia or payload.get('nota') is None:
            return Resultado(INVALIDO, 'ID da mídia e nota são obrigatórios')

        try:
            nota = ler_nota(payload['nota'])
        except NotaInvalida as erro:
            return _nota_invalida(erro)

        if not self._catalogo.obter(id_midia):
            return Resultado(NAO_ENCONTRADO, 'Mídia não encontrada')

        try:
            criada = self._avaliacoes.criar(
                id_usuario, id_midia, nota, payload.get('titulo_avaliacao'), payload.get('texto_avaliacao'),
            )
        except Conflito:
            return Resultado(CONFLITO, 'Você já avaliou esta mídia')

        return Resultado(OK, dados=criada)

    def editar(self, id_usuario: str, id_avaliacao: str, payload: dict[str, Any] | None) -> Resultado:
        """Grava os campos editáveis enviados pelo autor. `dados`: nota_media e total_avaliacoes."""
        payload = payload if isinstance(payload, dict) else {}
        if not payload:
            return Resultado(INVALIDO, 'Dados não fornecidos')

        atual = self._avaliacoes.obter(id_avaliacao)
        if not atual or atual['id_usuario'] != id_usuario:
            return Resultado(NEGADO, 'Avaliação não encontrada ou sem permissão')

        campos = {campo: payload[campo] for campo in CAMPOS_EDITAVEIS if campo in payload}
        if 'nota' in campos:
            try:
                campos['nota'] = ler_nota(campos['nota'])
            except NotaInvalida as erro:
                return _nota_invalida(erro)

        if not campos:
            return Resultado(INVALIDO, 'Nenhum campo para atualizar')

        return Resultado(OK, dados=self._avaliacoes.atualizar(id_avaliacao, atual['id_midia'], campos))

    def apagar(self, id_usuario: str, id_avaliacao: str, pode_moderar: bool) -> Resultado:
        """Apaga a Avaliação do autor, ou de qualquer um para quem pode moderar."""
        atual = self._avaliacoes.obter(id_avaliacao)
        if not atual:
            return Resultado(NAO_ENCONTRADO, 'Avaliação não encontrada')

        if atual['id_usuario'] != id_usuario and not pode_moderar:
            return Resultado(NEGADO, 'Sem permissão para deletar esta avaliação')

        self._avaliacoes.apagar(id_avaliacao)
        return Resultado(OK)
