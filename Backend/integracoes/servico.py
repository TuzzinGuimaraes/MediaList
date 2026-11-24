"""Casos de uso das Integrações, sem HTTP: listar, conectar, desconectar, prévia e confirmar.

A prévia lê a origem, localiza cada item no Catálogo e conta o que `aplicar` faria
(novos, atualizados, Não encontrados), sem gravar nada; guarda os itens que mudam por 1 h.
Confirmar consome a prévia, importa as obras que faltam, recalcula `aplicar` com a Lista
de agora e grava pela `ListaPessoal` (a mesma validação da rota da Lista).

Os erros sobem como `integracoes.plataforma.ErroDaIntegracao` (a rota traduz) ou
`SemConta`/`PlataformaDesconhecida`.
"""
from __future__ import annotations

from dataclasses import replace
from datetime import date
from typing import Any

from dominio.lista_pessoal import ListaPessoal
from integracoes import catalogo, repositorio
from integracoes.anilist import AniList
from integracoes.aplicar import NOVO, aplicar
from integracoes.plataforma import (
    Conta,
    ItemDeOrigem,
    Plataforma,
    PlataformaIndisponivel,
    item_de_json,
    item_para_json,
)
from integracoes.steam import Steam
from repositories.itens_lista import ItensLista

#: As plataformas registradas, na ordem da tela. Os tickets do MAL e da Steam somam aqui.
PLATAFORMAS: dict[str, Plataforma] = {'anilist': AniList(), 'steam': Steam()}

#: Quantos Não encontrados saem na resposta (o total sai à parte).
AMOSTRA_NAO_ENCONTRADOS = 100


class PlataformaDesconhecida(LookupError):
    """Nome de plataforma fora de `PLATAFORMAS`."""


class SemConta(LookupError):
    """A plataforma não está conectada para o Usuário."""


class _CatalogoLocalizado:
    """O `catalogo.obter` que a `ListaPessoal` pede, servido do que `catalogo.localizar` já leu."""

    def __init__(self, localizadas: dict[tuple[str, str], catalogo.Localizada]):
        self._por_id = {m['id_midia']: m for m in localizadas.values()}

    def obter(self, id_midia: str) -> dict[str, Any] | None:
        midia = self._por_id.get(id_midia)
        return {'tipo': midia['tipo'], 'progresso_total_padrao': midia['total']} if midia else None


def plataforma(nome: str) -> Plataforma:
    if nome not in PLATAFORMAS:
        raise PlataformaDesconhecida(nome)
    return PLATAFORMAS[nome]


def _disponivel(nome: str) -> Plataforma:
    escolhida = plataforma(nome)
    if not escolhida.disponivel():
        raise PlataformaIndisponivel(f'{escolhida.rotulo} está indisponível no momento.')
    return escolhida


def _visao(escolhida: Plataforma, conta: dict[str, Any] | None) -> dict[str, Any]:
    return {
        'plataforma': escolhida.nome,
        'rotulo': escolhida.rotulo,
        'disponivel': escolhida.disponivel(),
        'conectada': conta is not None,
        'identificador': (conta or {}).get('identificador'),
        'nome_exibicao': (conta or {}).get('nome_exibicao'),
        'ultima_sincronizacao': (conta or {}).get('ultima_sincronizacao'),
        'ultimo_resultado': (conta or {}).get('ultimo_resultado'),
    }


def listar(id_usuario: str) -> list[dict[str, Any]]:
    """Todas as plataformas registradas, com a conta do Usuário quando conectada."""
    contas = repositorio.contas(id_usuario)
    return [_visao(p, contas.get(nome)) for nome, p in PLATAFORMAS.items()]


def conectar(id_usuario: str, nome: str, identificador: str) -> dict[str, Any]:
    """Valida o perfil público na plataforma e grava a conta."""
    escolhida = _disponivel(nome)
    conta = escolhida.conectar(identificador)
    return _visao(escolhida, repositorio.gravar_conta(id_usuario, nome, conta))


def desconectar(id_usuario: str, nome: str) -> None:
    plataforma(nome)
    repositorio.remover_conta(id_usuario, nome)


def _nao_encontrado(item: ItemDeOrigem) -> dict[str, Any]:
    return {'titulo': item.titulo, 'link': item.link}


def _contagens(novos: int, atualizados: int, nao_encontrados: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        'novos': novos,
        'atualizados': atualizados,
        'nao_encontrados': nao_encontrados[:AMOSTRA_NAO_ENCONTRADOS],
        'total_nao_encontrados': len(nao_encontrados),
    }


def _planejar(id_usuario: str, itens: list[ItemDeOrigem], localizadas, hoje: date):
    """(item, Mídia localizada ou None, Mudança) dos itens que mudam algo, e os Não encontrados.

    Item que não está no Catálogo e é importável conta como novo (a Mídia entra ao confirmar).
    """
    atuais = repositorio.itens_do_usuario(id_usuario, sorted({m['id_midia'] for m in localizadas.values()}))
    planos, nao_encontrados = [], []
    for item in itens:
        midia = localizadas.get(catalogo.chave(item)) if item.catalogo else None
        if midia is None and not catalogo.importavel(item):
            nao_encontrados.append(_nao_encontrado(item))
            continue
        atual = atuais.get(midia['id_midia']) if midia else None
        mudanca = aplicar(atual, item, total=midia['total'] if midia else None, hoje=hoje)
        if mudanca:
            planos.append((item, midia, atual, mudanca))
    return planos, nao_encontrados


def _sem_dados_se_localizado(item: ItemDeOrigem, midia) -> ItemDeOrigem:
    """A obra inteira só vai para a prévia quando ainda falta no Catálogo."""
    if midia is None or item.catalogo is None:
        return item
    return replace(item, catalogo=replace(item.catalogo, dados=None))


def previa_de_itens(id_usuario: str, nome: str, itens: list[ItemDeOrigem]) -> dict[str, Any]:
    """Conta e guarda a prévia de itens já lidos (a da plataforma ou a de um arquivo, como o XML do MAL)."""
    planos, nao_encontrados = _planejar(id_usuario, itens, catalogo.localizar(itens), date.today())
    novos = sum(1 for *_, m in planos if m.tipo == NOVO)
    conteudo = {
        'itens': [item_para_json(_sem_dados_se_localizado(item, midia)) for item, midia, *_ in planos],
        'nao_encontrados': nao_encontrados,
    }
    guardada = repositorio.criar_previa(id_usuario, nome, conteudo)
    return {
        'id_previa': guardada['id_previa'],
        'expira_em': guardada['expira_em'],
        **_contagens(novos, len(planos) - novos, nao_encontrados),
    }


def previa(id_usuario: str, nome: str) -> dict[str, Any]:
    """Lê a lista na plataforma conectada e monta a prévia."""
    escolhida = _disponivel(nome)
    conta = repositorio.conta(id_usuario, nome)
    if conta is None:
        raise SemConta(nome)
    itens = escolhida.ler(Conta(conta['identificador'], conta['nome_exibicao']))
    return previa_de_itens(id_usuario, nome, itens)


def aplicar_itens(id_usuario: str, itens: list[ItemDeOrigem], *, hoje: date | None = None) -> dict[str, Any]:
    """Importa as obras que faltam e grava na Lista o que `aplicar` decidir. Devolve as contagens.

    É o que o confirmar da prévia chama; a sincronização sem prévia (Steam) também pode chamar.
    """
    hoje = hoje or date.today()
    localizadas = catalogo.localizar(itens)
    nao_encontrados: list[dict[str, Any]] = []
    for item in itens:
        chave = catalogo.chave(item)
        if chave is not None and chave not in localizadas:
            importada = catalogo.importar(item)
            if importada:
                localizadas[chave] = importada

    lista = ListaPessoal(ItensLista(), _CatalogoLocalizado(localizadas))
    planos, faltando = _planejar(id_usuario, [i for i in itens if localizadas.get(catalogo.chave(i))],
                                 localizadas, hoje)
    nao_encontrados.extend(_nao_encontrado(i) for i in itens if not localizadas.get(catalogo.chave(i)))
    nao_encontrados.extend(faltando)

    novos = atualizados = 0
    for item, midia, atual, mudanca in planos:
        if mudanca.tipo == NOVO:
            resultado = lista.adicionar(id_usuario, {**mudanca.campos, 'id_midia': midia['id_midia']})
            novos += resultado.bem_sucedido
        else:
            resultado = lista.atualizar(id_usuario, atual['id_lista'], mudanca.campos)
            atualizados += resultado.bem_sucedido
        if not resultado.bem_sucedido:
            nao_encontrados.append(_nao_encontrado(item))
    return _contagens(novos, atualizados, nao_encontrados)


def confirmar(id_usuario: str, id_previa: str) -> dict[str, Any] | None:
    """Aplica a prévia (uma vez só) e registra o resultado na conta. None se ela não vale mais."""
    guardada = repositorio.consumir_previa(id_usuario, id_previa)
    if guardada is None:
        return None
    conteudo = guardada['conteudo']
    resultado = aplicar_itens(id_usuario, [item_de_json(d) for d in conteudo['itens']])
    anteriores = conteudo.get('nao_encontrados') or []
    nao_encontrados = anteriores + resultado['nao_encontrados']
    resultado = {
        **resultado,
        'nao_encontrados': nao_encontrados[:AMOSTRA_NAO_ENCONTRADOS],
        'total_nao_encontrados': len(anteriores) + resultado['total_nao_encontrados'],
    }
    repositorio.registrar_resultado(id_usuario, guardada['plataforma'], resultado)
    return resultado
