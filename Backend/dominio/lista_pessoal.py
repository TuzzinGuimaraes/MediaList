"""
Escrita da Lista pessoal: tudo o que um Item de lista significa.

O módulo é o autor do Estado de consumo (ver docs/adr/0002): validação do
Rótulo de estado contra o Tipo de mídia, escala da Nota pessoal, limites de Progresso, Concluído ⇔ total
Concluído, datas (nunca no futuro, conclusão não antes do início) e dono do Item
vivem aqui, não nas rotas nem no banco. Esta é a única
validação dessas regras: no PostgreSQL não há trigger de Progresso, só CHECKs
simples (Rótulo entre os conhecidos, sem olhar o Tipo; nota de 0 a 10; contadores
não negativos); ver docs/adr/0007 e 0009.

Leitura fica de fora: a rota lê de `repositories.itens_lista` direto. Aqui só há escrita,
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


#: Mensagens das regras de data, as mesmas do editor do Web.
DATA_NO_FUTURO = {
    'data_inicio': 'A data de início não pode ser no futuro.',
    'data_conclusao': 'A data de conclusão não pode ser no futuro.',
}
CONCLUSAO_ANTES_DO_INICIO = 'A conclusão não pode ser antes do início.'


def _como_data(valor: Any) -> date | None:
    """`date` de um valor do payload (texto ISO) ou do banco (`date`/`datetime`)."""
    if valor is None:
        return None
    if isinstance(valor, date):
        return valor if type(valor) is date else valor.date()
    return date.fromisoformat(str(valor)[:10])


def _datas_enviadas(campos: dict[str, Any], item: dict[str, Any]) -> tuple[dict[str, date], dict[str, str]]:
    """As datas que o payload muda no Item, e os erros das que não são data.

    Uma data igual à gravada no Item não conta como enviada: o editor reenvia o formulário
    inteiro, e repetir uma data antiga ruim não é decidir sobre ela (User Story 3).
    """
    enviadas: dict[str, date] = {}
    erros: dict[str, str] = {}
    for nome in DATA_NO_FUTURO:
        if campos.get(nome) is None:
            continue
        try:
            valor = _como_data(campos[nome])
        except ValueError:
            erros[nome] = 'Valor inválido'
            continue
        if valor != _como_data(item.get(nome)):
            enviadas[nome] = valor
    return enviadas, erros


def _data_efetiva(nome: str, enviadas: dict[str, date], campos: dict[str, Any], item: dict[str, Any]) -> date | None:
    """A data como fica no Item depois da escrita."""
    if nome in enviadas:
        return enviadas[nome]
    if nome in campos and campos[nome] is None:
        return None  # o payload apaga a data
    return _como_data(item.get(nome))  # não veio, ou veio igual à gravada


def erro_de_ordem(campos: dict[str, Any], item: dict[str, Any]) -> dict[str, str]:
    """Conclusão antes do início, com a outra data enviada ou, se ela não veio, a gravada.

    Só vale se alguma data foi enviada. O erro vai para a data enviada (a de conclusão, se
    foram as duas). Datas que não são data ficam de fora (ver `erros_de_cada_data`).
    """
    enviadas, _ = _datas_enviadas(campos, item)
    if not enviadas:
        return {}
    inicio = _data_efetiva('data_inicio', enviadas, campos, item)
    conclusao = _data_efetiva('data_conclusao', enviadas, campos, item)
    if inicio and conclusao and conclusao < inicio:
        campo = 'data_conclusao' if 'data_conclusao' in enviadas else 'data_inicio'
        return {campo: CONCLUSAO_ANTES_DO_INICIO}
    return {}


def erros_de_cada_data(campos: dict[str, Any], item: dict[str, Any], hoje: date) -> dict[str, str]:
    """Erros de cada data enviada, sozinha: não é data, ou é depois de hoje."""
    enviadas, erros = _datas_enviadas(campos, item)
    for nome, valor in enviadas.items():
        if valor > hoje:
            erros[nome] = DATA_NO_FUTURO[nome]
    return erros


def erros_de_data(campos: dict[str, Any], item: dict[str, Any], hoje: date) -> dict[str, str]:
    """Erros das datas enviadas: nenhuma depois de hoje, conclusão não antes do início.

    Só as datas que o payload muda são julgadas (ver `_datas_enviadas`), então editar um Item
    com uma data antiga ruim não falha. A ordem é a de `validarItem` (dominio/itemLista.ts),
    para o mesmo caso dar a mesma mensagem: data que não é data, depois conclusão antes do
    início, depois no futuro.
    """
    _, erros_de_formato = _datas_enviadas(campos, item)
    return erros_de_formato or erro_de_ordem(campos, item) or erros_de_cada_data(campos, item, hoje)


def _decidido(campos: dict[str, Any], item: dict[str, Any], nome: str) -> bool:
    """Diz se o payload traz um valor novo para o campo.

    O editor reenvia o formulário inteiro: repetir o valor guardado é silêncio,
    não uma decisão do Usuário.
    """
    return campos.get(nome) is not None and campos.get(nome) != item.get(nome)


def _registrar_conclusao(
    campos: dict[str, Any], item: dict[str, Any], hoje: date, contar_recontagem: bool = True,
) -> None:
    """Entrada em Concluído: data de hoje e, se já houve passagem, +1 na Recontagem.

    `contar_recontagem=False` (Integrações, Q114b) nunca mexe na Recontagem.

    As datas do Item descrevem a passagem mais recente (ADR 0003), então a nova
    conclusão sobrescreve a anterior, salvo data escolhida pelo Usuário.
    """
    hoje_iso = hoje.isoformat()
    if not _decidido(campos, item, 'data_conclusao'):
        campos['data_conclusao'] = hoje_iso

    # Concluir de novo no mesmo dia da conclusão anterior é desfazer um toque
    # errado (− e + no stepper), não uma nova passagem: não conta Recontagem.
    anterior = item.get('data_conclusao')
    mesmo_dia = anterior is not None and str(anterior)[:10] == hoje_iso
    if contar_recontagem and anterior and not mesmo_dia and not _decidido(campos, item, 'total_rewatches'):
        campos['total_rewatches'] = (item.get('total_rewatches') or 0) + 1


def _concluido_segue_o_progresso(
    campos: dict[str, Any], tipo: str | None, total: int | None, hoje: date, item: dict[str, Any] | None = None,
    contar_recontagem: bool = True,
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
        _registrar_conclusao(campos, item, hoje, contar_recontagem)


class ListaPessoal:
    """Operações de escrita sobre os Itens da Lista pessoal de um Usuário."""

    def __init__(self, itens, catalogo):
        """`itens` grava e lê os Itens (`ItensLista`); `catalogo.obter` dá o Tipo e o total da Mídia."""
        self._lista = itens
        self._catalogo = catalogo

    def adicionar(self, id_usuario: str, payload: dict[str, Any] | None, *, hoje: date | None = None) -> Resultado:
        """Põe uma Mídia na Lista do Usuário. Item já existente é conflito.

        `hoje` (padrão `date.today()`) é o limite das datas e o dia da conclusão automática.
        """
        hoje = hoje or date.today()
        payload = payload or {}
        campos, erros = _validar_campos(payload)

        id_midia = payload.get('id_midia')
        if not isinstance(id_midia, str) or not id_midia.strip():
            erros['id_midia'] = 'Campo obrigatório'
        if 'status_consumo' not in campos:
            erros.setdefault('status_consumo', 'Campo obrigatório')
        if not erros:
            erros = erros_de_data(campos, {}, hoje)
        if erros:
            return Resultado(INVALIDO, erros)

        midia = self._catalogo.obter(id_midia)
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

        _concluido_segue_o_progresso(campos, tipo, total, hoje)

        id_lista = self._lista.criar_item(id_usuario, id_midia, campos)
        if id_lista is None:
            return _invalido('id_midia', 'Mídia já está na lista do usuário')

        return Resultado(OK, id_lista=id_lista)

    def atualizar(
        self, id_usuario: str, id_lista: str, payload: dict[str, Any] | None, *, contar_recontagem: bool = True,
        hoje: date | None = None,
    ) -> Resultado:
        """Grava os campos enviados num Item do Usuário, numa escrita só.

        `contar_recontagem=False` é o das Integrações (Q114b): chegar ao total pela origem
        não soma Recontagem, nem num Item que já tinha `data_conclusao`. `hoje` como em `adicionar`.
        """
        hoje = hoje or date.today()
        item = self._lista.obter_item_por_id(id_lista)
        if not item:
            return Resultado(NAO_ENCONTRADO)
        if item.get('id_usuario') != id_usuario:
            return Resultado(NEGADO)

        campos, erros = _validar_campos(payload or {})
        if not erros:
            erros = erros_de_data(campos, item, hoje)
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
        _concluido_segue_o_progresso(campos, tipo, total, hoje, item, contar_recontagem)

        if campos:
            self._lista.atualizar_campos(id_lista, campos)

        return Resultado(OK)

    def remover(self, id_usuario: str, id_lista: str) -> Resultado:
        """Tira o Item da Lista. Item de terceiro ou inexistente não é apagado."""
        if not self._lista.remover_item(id_lista, id_usuario):
            return Resultado(NAO_ENCONTRADO)

        return Resultado(OK)
