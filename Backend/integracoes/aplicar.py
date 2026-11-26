"""Aplicar um item de origem num Item da Lista (Q110, Q111): função pura.

`aplicar(item, origem, total=, hoje=)` diz o que gravar, sem gravar: os campos vão para
`dominio.lista_pessoal` (`adicionar` ou `atualizar`), que segue sendo o autor do Estado de
consumo (Concluído segue o Progresso, ADR 0009, com a Recontagem dele).

Anime e mangá:
- Item novo: Status, Progresso, nota e datas da origem (sem Status, Planejado).
- Item existente: o maior Progresso; o Status da origem só se o Progresso subiu; a nota da
  origem só se não há Nota pessoal; datas da origem só preenchem as vazias (a de conclusão
  só com a origem em Concluído). Comentário, favorito, privado, Recontagem e Avaliações nunca.

Jogo (Q111; horas = `progresso_atual`):
- Só com horas > 0. Novo: `jogando` se jogado nos últimos 30 dias, senão `pausado`.
- Existente: só as horas, se maiores; `na_fila` vira `jogando` com horas novas.
- Zerado e Platinado nunca vêm da origem.

Progresso acima do total da Mídia vira o total (o Catálogo pode estar atrás da origem).

Data inválida da origem (no futuro, ou conclusão antes do início) sai e o resto do Item
entra (ADR 0015): as regras são as da `ListaPessoal`, que recusaria a escrita inteira. No par
inconsistente sai o início; se o início é o gravado no Item (do Usuário), sai a conclusão.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from dominio.lista_pessoal import erro_de_ordem, erros_de_cada_data
from integracoes.plataforma import ItemDeOrigem
from schemas.estado_consumo import CONCLUIDO, EM_PROGRESSO, PAUSADO, PLANEJADO, estado_de, rotulo_para

NOVO = 'novo'
ATUALIZADO = 'atualizado'

#: Jogo jogado há até tantos dias entra como `jogando`.
DIAS_JOGANDO = 30


@dataclass(frozen=True)
class Mudanca:
    """O que gravar: `tipo` é NOVO ou ATUALIZADO; `campos` no formato de `ListaPessoal`."""

    tipo: str
    campos: dict[str, Any]


def _limitado(progresso: int | None, total: int | None) -> int:
    progresso = max(progresso or 0, 0)
    return min(progresso, total) if total else progresso


def _jogado_recentemente(jogado_em: str | None, hoje: date) -> bool:
    if not jogado_em:
        return False
    return date.fromisoformat(jogado_em[:10]) >= hoje - timedelta(days=DIAS_JOGANDO)


def _nota_se_vazia(campos: dict[str, Any], item: dict[str, Any], origem: ItemDeOrigem) -> None:
    if item.get('nota_usuario') is None and origem.nota is not None:
        campos['nota_usuario'] = origem.nota


def _sem_datas_invalidas(campos: dict[str, Any], item: dict[str, Any], hoje: date) -> dict[str, Any]:
    """Tira de `campos` as datas que a `ListaPessoal` recusaria, em dois passos.

    1. Sai cada data que não vale sozinha (no futuro).
    2. Se o par fica fora de ordem, sai o início enviado; sem início enviado (o do Item é o
       gravado, do Usuário), sai a conclusão.
    """
    for nome in erros_de_cada_data(campos, item, hoje):
        campos.pop(nome)
    if erro_de_ordem(campos, item):
        campos.pop('data_inicio' if 'data_inicio' in campos else 'data_conclusao')
    return campos


def _resultado(tipo: str, campos: dict[str, Any]) -> Mudanca | None:
    return Mudanca(tipo, campos) if campos else None


def _jogo(item: dict[str, Any] | None, origem: ItemDeOrigem, hoje: date) -> Mudanca | None:
    horas = origem.horas or 0
    if horas <= 0:
        return None

    if item is None:
        estado = EM_PROGRESSO if _jogado_recentemente(origem.jogado_em, hoje) else PAUSADO
        campos = {'status_consumo': rotulo_para(estado, 'jogo'), 'progresso_atual': horas}
        if origem.nota is not None:
            campos['nota_usuario'] = origem.nota
        return Mudanca(NOVO, campos)

    campos: dict[str, Any] = {}
    if horas > (item.get('progresso_atual') or 0):
        campos['progresso_atual'] = horas
        if estado_de(item.get('status_consumo'), 'jogo') == PLANEJADO:
            campos['status_consumo'] = rotulo_para(EM_PROGRESSO, 'jogo')
    _nota_se_vazia(campos, item, origem)
    return _resultado(ATUALIZADO, campos)


def aplicar(
    item: dict[str, Any] | None, origem: ItemDeOrigem, *, total: int | None, hoje: date,
) -> Mudanca | None:
    """O que gravar para `origem` no Item atual (None: não está na Lista), ou None se nada muda.

    `item` traz `status_consumo`, `progresso_atual`, `nota_usuario`, `data_inicio` e
    `data_conclusao`; `total` é o da Mídia (episódios/capítulos; None no jogo).
    """
    if origem.tipo == 'jogo':
        return _jogo(item, origem, hoje)

    tipo = origem.tipo
    progresso = _limitado(origem.progresso, total)
    estado = origem.status or PLANEJADO

    if item is None:
        campos: dict[str, Any] = {'status_consumo': rotulo_para(estado, tipo), 'progresso_atual': progresso}
        if origem.nota is not None:
            campos['nota_usuario'] = origem.nota
        if origem.data_inicio:
            campos['data_inicio'] = origem.data_inicio
        if origem.data_conclusao and estado == CONCLUIDO:
            campos['data_conclusao'] = origem.data_conclusao
        return Mudanca(NOVO, _sem_datas_invalidas(campos, {}, hoje))

    campos = {}
    if progresso > (item.get('progresso_atual') or 0):
        campos['progresso_atual'] = progresso
        if origem.status:
            campos['status_consumo'] = rotulo_para(origem.status, tipo)
        if origem.data_inicio and not item.get('data_inicio'):
            campos['data_inicio'] = origem.data_inicio
        if origem.data_conclusao and origem.status == CONCLUIDO:
            campos['data_conclusao'] = origem.data_conclusao
    _nota_se_vazia(campos, item, origem)
    return _resultado(ATUALIZADO, _sem_datas_invalidas(campos, item, hoje))
