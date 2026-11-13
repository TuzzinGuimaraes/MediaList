"""
Escrita da Lista pessoal: tudo o que um Item de lista significa.

O módulo é o autor do Estado de consumo (ver docs/adr/0002): validação do
Rótulo de estado contra o Tipo de mídia, escala da Nota pessoal, limites de Progresso, Concluído ⇔ total
Concluído e dono do Item vivem aqui, não nas rotas nem no banco. Esta é a única
validação dessas regras: no PostgreSQL não há trigger de Progresso, só CHECKs
simples (Rótulo entre os conhecidos, sem olhar o Tipo; nota de 0 a 10; contadores
não negativos); ver docs/adr/0007 e 0009.

Leitura fica de fora: a rota consulta o repositório direto. Aqui só há escrita,
e **uma escrita por chamada** — é o que impede o estado recém-decidido de ser
atropelado por um segundo UPDATE na mesma requisição.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from dominio.nota import NotaInvalida, ler_nota
from schemas.estado_consumo import CONCLUIDO, EM_PROGRESSO, erro_de_rotulo, estado_de, rotulo_para

OK = 'ok'
INVALIDO = 'invalido'
NAO_ENCONTRADO = 'nao_encontrado'
NEGADO = 'negado'


@dataclass(frozen=True)
class Resultado:
    """Desfecho de uma operação de escrita, sem vocabulário de HTTP.

    `detalhes` mapeia campo -> mensagem e só é preenchido em `invalido`.
    `id_lista` só existe em `adicionar`.
    """

    codigo: str
    detalhes: dict[str, str] = field(default_factory=dict)
    id_lista: str | None = None

    @property
    def bem_sucedido(self) -> bool:
        return self.codigo == OK


def _invalido(campo: str, mensagem: str) -> Resultado:
    return Resultado(INVALIDO, {campo: mensagem})


def _como_booleano(valor: Any) -> bool:
    """Booleano tolerante ao que o cliente manda (0/1, 'true', 'sim').

    Mesma conversão que `schemas/base.py` já fazia nos payloads de lista: o
    módulo herda a tolerância em vez de estreitar o fio.
    """
    if isinstance(valor, bool):
        return valor
    if isinstance(valor, str):
        if valor.lower() in {'true', '1', 'sim', 'yes'}:
            return True
        if valor.lower() in {'false', '0', 'nao', 'não', 'no'}:
            return False
    return bool(valor)


#: Campos que o cliente pode gravar num Item, com o conversor de cada um. Um
#: nome por campo: aliases legados (`id_anime`, `episodios_assistidos`, ...) são
#: traduzidos pelo adaptador HTTP antes de chegar aqui.
#:
#: `progresso_total` não está na lista de propósito: o total pertence à Mídia.
CAMPOS_GRAVAVEIS = {
    'status_consumo': str,
    'progresso_atual': int,
    'nota_usuario': ler_nota,
    'favorito': _como_booleano,
    'privado': _como_booleano,
    'comentario': str,
    'data_inicio': str,
    'data_conclusao': str,
    'total_rewatches': int,
}

#: Campos que não podem ser esvaziados: o Estado de consumo é obrigatório, e os
#: contadores e marcas alimentam contagens que não sabem lidar com ausência.
#: Mandá-los vazios não é apagá-los, é não dizer nada sobre eles.
CAMPOS_NAO_ANULAVEIS = frozenset({
    'status_consumo', 'progresso_atual', 'total_rewatches', 'favorito', 'privado',
})

#: Tipos sem Progresso mensurável: não há total contra o qual medir, então
#: nenhum progresso deles conclui coisa alguma (ver CONTEXT.md, Progresso).
TIPOS_SEM_PROGRESSO = frozenset({'jogo'})


def _validar_campos(payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
    """Separa os campos graváveis do payload dos erros de conversão.

    O que não é gravável é descartado em silêncio, como as rotas sempre
    fizeram: o cliente manda o item inteiro de volta e não é erro dele.
    """
    campos: dict[str, Any] = {}
    erros: dict[str, str] = {}

    for nome, converter in CAMPOS_GRAVAVEIS.items():
        if nome not in payload:
            continue

        valor = payload[nome]
        if valor is None or valor == '':
            if nome not in CAMPOS_NAO_ANULAVEIS:
                campos[nome] = None
            continue

        try:
            campos[nome] = converter(valor)
        except NotaInvalida as erro:
            erros[nome] = str(erro)
        except (TypeError, ValueError):
            erros[nome] = 'Valor inválido'

    return campos, erros


def _erro_de_progresso(progresso: int | None, total: int | None) -> str | None:
    """Mensagem de erro se o progresso é negativo ou passa do total da Mídia."""
    if progresso is None:
        return None

    if progresso < 0:
        return 'Progresso não pode ser negativo'

    if total is not None and progresso > total:
        return f'Progresso não pode ser maior que o total da mídia ({total})'

    return None


def _decidido(campos: dict[str, Any], item: dict[str, Any], nome: str) -> bool:
    """Diz se o payload traz um valor novo para o campo.

    O editor reenvia o formulário inteiro: repetir o valor guardado é silêncio,
    não uma decisão do Usuário.
    """
    return campos.get(nome) is not None and campos.get(nome) != item.get(nome)


def _registrar_conclusao(campos: dict[str, Any], item: dict[str, Any]) -> None:
    """Entrada em Concluído: data de hoje e, se já houve passagem, +1 na Recontagem.

    As datas do Item descrevem a passagem mais recente (ADR 0003), então a nova
    conclusão sobrescreve a anterior, salvo data escolhida pelo Usuário.
    """
    hoje = date.today().isoformat()
    if not _decidido(campos, item, 'data_conclusao'):
        campos['data_conclusao'] = hoje

    # Concluir de novo no mesmo dia da conclusão anterior é desfazer um toque
    # errado (− e + no stepper), não uma nova passagem: não conta Recontagem.
    anterior = item.get('data_conclusao')
    mesmo_dia = anterior is not None and str(anterior)[:10] == hoje
    if anterior and not mesmo_dia and not _decidido(campos, item, 'total_rewatches'):
        campos['total_rewatches'] = (item.get('total_rewatches') or 0) + 1


def _concluido_segue_o_progresso(
    campos: dict[str, Any], tipo: str | None, total: int | None, item: dict[str, Any] | None = None,
) -> None:
    """Concluído ⇔ Progresso = total (ADR 0009), escrito direto em `campos`.

    - Escolher Concluído (vindo de outro Estado) leva o Progresso ao total.
    - Progresso enviado no total promove a Concluído; abaixo dele, um Item
      concluído volta ao Em progresso do Tipo, e a data de conclusão fica.
    - Sem total conhecido, ou jogo (horas não medem Progresso), nada muda.

    `item` é o Item antes da escrita; ausente em `adicionar`.
    """
    if tipo in TIPOS_SEM_PROGRESSO or total is None or total <= 0:
        return

    item = item or {}
    ja_concluido = estado_de(item.get('status_consumo'), tipo) == CONCLUIDO
    estado = estado_de(campos.get('status_consumo') or item.get('status_consumo'), tipo)
    progresso = campos.get('progresso_atual')

    if estado == CONCLUIDO and not ja_concluido:
        campos['progresso_atual'] = total
    elif progresso is not None and progresso >= total and estado != CONCLUIDO:
        campos['status_consumo'] = rotulo_para(CONCLUIDO, tipo)
    elif progresso is not None and progresso < total and estado == CONCLUIDO:
        campos['status_consumo'] = rotulo_para(EM_PROGRESSO, tipo)
        return
    else:
        return

    if not ja_concluido:
        _registrar_conclusao(campos, item)


class ListaPessoal:
    """Operações de escrita sobre os Itens da Lista pessoal de um Usuário."""

    def __init__(self, lista_repository, midia_repository):
        self._lista = lista_repository
        self._midias = midia_repository

    def adicionar(self, id_usuario: str, payload: dict[str, Any] | None) -> Resultado:
        """Põe uma Mídia na Lista do Usuário. Item já existente é conflito."""
        payload = payload or {}
        campos, erros = _validar_campos(payload)

        id_midia = payload.get('id_midia')
        if not isinstance(id_midia, str) or not id_midia.strip():
            erros['id_midia'] = 'Campo obrigatório'
        if 'status_consumo' not in campos:
            erros.setdefault('status_consumo', 'Campo obrigatório')
        if erros:
            return Resultado(INVALIDO, erros)

        midia = self._midias.buscar_por_id(id_midia)
        if not midia:
            return _invalido('id_midia', 'Mídia não encontrada')

        tipo = midia.get('tipo')
        erro = erro_de_rotulo(campos['status_consumo'], tipo)
        if erro:
            return _invalido('status_consumo', erro)

        total = midia.get('progresso_total_padrao')
        progresso = campos.get('progresso_atual')
        erro = _erro_de_progresso(progresso, total)
        if erro:
            return _invalido('progresso_atual', erro)

        _concluido_segue_o_progresso(campos, tipo, total)

        id_lista = self._lista.criar_item(id_usuario, id_midia, campos)
        if id_lista is None:
            return _invalido('id_midia', 'Mídia já está na lista do usuário')

        return Resultado(OK, id_lista=id_lista)

    def atualizar(self, id_usuario: str, id_lista: str, payload: dict[str, Any] | None) -> Resultado:
        """Grava os campos enviados num Item do Usuário, numa escrita só."""
        item = self._lista.obter_item_por_id(id_lista)
        if not item:
            return Resultado(NAO_ENCONTRADO)
        if item.get('id_usuario') != id_usuario:
            return Resultado(NEGADO)

        campos, erros = _validar_campos(payload or {})
        if erros:
            return Resultado(INVALIDO, erros)

        tipo = item.get('tipo')
        erro = erro_de_rotulo(campos.get('status_consumo'), tipo)
        if erro:
            return _invalido('status_consumo', erro)

        total = item.get('progresso_total_padrao')
        progresso = campos.get('progresso_atual')
        erro = _erro_de_progresso(progresso, total)
        if erro:
            return _invalido('progresso_atual', erro)

        # Sem status no payload, o estado atual do Item é o que vale: atualizar
        # o progresso não é uma decisão sobre o estado de consumo.
        _concluido_segue_o_progresso(campos, tipo, total, item)

        if campos:
            self._lista.atualizar_campos(id_lista, campos)

        return Resultado(OK)

    def remover(self, id_usuario: str, id_lista: str) -> Resultado:
        """Tira o Item da Lista. Item de terceiro ou inexistente não é apagado."""
        if not self._lista.remover_item(id_lista, id_usuario):
            return Resultado(NAO_ENCONTRADO)

        return Resultado(OK)
