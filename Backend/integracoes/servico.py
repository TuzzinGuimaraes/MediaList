"""Casos de uso das Integrações, sem HTTP: listar, conectar, desconectar, prévia e confirmar.

A prévia lê a origem, casa cada item e conta o que `aplicar` faria (novos, atualizados, Não
encontrados), sem gravar nada na Lista; guarda por 1 h os itens que mudam e os Não encontrados.
Confirmar importa as obras que faltam no Catálogo (commits próprios: o upsert da Importação
é idempotente) e, numa transação só, consome a prévia, recalcula `aplicar` com a Lista de
agora, grava pela `ListaPessoal` (a mesma validação da rota da Lista) e registra o resultado.
Falha no meio desfaz tudo e a prévia continua valendo; dois confirmar da mesma prévia
aplicam uma vez só (o DELETE da prévia trava a linha até o commit).

Vincular (`vincular`) grava o vínculo global, tira o item dos Não encontrados do Usuário e aplica
o Item como a sincronização. Qual Mídia cada item casa (a busca da plataforma primeiro, o vínculo
como reserva) é do `integracoes.casamento`; o formato do resultado e da prévia guardados, do
`integracoes.resultado`.

Os erros sobem como `integracoes.plataforma.ErroDaIntegracao` (a rota traduz) ou
`SemConta`/`PlataformaDesconhecida` e os do Vincular (`MidiaInexistente`, `ForaDosNaoEncontrados`,
`TipoIncompativel`, `VinculoEmConflito`).
"""
from __future__ import annotations

from dataclasses import replace
from datetime import date
from typing import Any, Iterable

import banco
from dominio.lista_pessoal import ListaPessoal
from integracoes import casamento, prazo, repositorio, resultado, vinculos
from integracoes.anilist import AniList
from integracoes.aplicar import NOVO, aplicar
from integracoes.mal import MAL
from integracoes.plataforma import (
    Conta,
    ErroDaIntegracao,
    ItemDeOrigem,
    Plataforma,
    PlataformaIndisponivel,
    conferir_tamanho,
    link_seguro,
)
from integracoes.resultado import Resultado, nao_encontrado
from integracoes.steam import Steam
from repositories.itens_lista import ItensLista

#: As plataformas registradas, na ordem da tela. Os tickets do MAL e da Steam somam aqui.
PLATAFORMAS: dict[str, Plataforma] = {'anilist': AniList(), 'mal': MAL(), 'steam': Steam()}

#: Plataformas sem prévia: só sincronizam (`integracoes.sincronizacao_steam`).
SO_SINCRONIZAM = frozenset({'steam'})


class PlataformaDesconhecida(LookupError):
    """Nome de plataforma fora de `PLATAFORMAS`."""


class SemConta(LookupError):
    """A plataforma não está conectada para o Usuário."""


class SemPrevia(ErroDaIntegracao):
    """A plataforma não tem prévia (a Steam só sincroniza)."""


class MidiaInexistente(LookupError):
    """Vincular a uma Mídia que não está no Catálogo."""


class ForaDosNaoEncontrados(LookupError):
    """O item não aparece nos Não encontrados do Usuário (último resultado ou prévia válida)."""


class TipoIncompativel(ValueError):
    """A Mídia não é do Tipo do item (Steam só jogo; AniList e MAL, o anime ou o mangá do item)."""


class VinculoEmConflito(Exception):
    """O item já está vinculado a outra Mídia (`id_midia`); `no_catalogo`: a busca da Steam já casou o jogo."""

    def __init__(self, id_midia: str, *, no_catalogo: bool = False):
        super().__init__(id_midia)
        self.id_midia = id_midia
        self.no_catalogo = no_catalogo


class _CatalogoLocalizado:
    """O `catalogo.obter` que a `ListaPessoal` pede, servido do que o Casamento já localizou."""

    def __init__(self, casados: Iterable[casamento.Casado]):
        self._por_id = {m['id_midia']: m for _, m in casados if m}

    def obter(self, id_midia: str) -> dict[str, Any] | None:
        midia = self._por_id.get(id_midia)
        return {'tipo': midia['tipo'], 'progresso_total_padrao': midia['total']} if midia else None


def plataforma(nome: str) -> Plataforma:
    if nome not in PLATAFORMAS:
        raise PlataformaDesconhecida(nome)
    return PLATAFORMAS[nome]


def plataforma_disponivel(nome: str) -> Plataforma:
    """A plataforma registrada, se tem a chave no ambiente; senão PlataformaIndisponivel."""
    escolhida = plataforma(nome)
    if not escolhida.disponivel():
        raise PlataformaIndisponivel(f'{escolhida.rotulo} está indisponível no momento.')
    return escolhida


def _visao(escolhida: Plataforma, conta: dict[str, Any] | None) -> dict[str, Any]:
    guardado = (conta or {}).get('ultimo_resultado')
    return {
        'plataforma': escolhida.nome,
        'rotulo': escolhida.rotulo,
        'disponivel': escolhida.disponivel(),
        'conectada': conta is not None,
        'identificador': (conta or {}).get('identificador'),
        'nome_exibicao': (conta or {}).get('nome_exibicao'),
        'ultima_sincronizacao': (conta or {}).get('ultima_sincronizacao'),
        'ultimo_resultado': resultado.de_guardado(guardado).resposta() if guardado else None,
    }


def listar(id_usuario: str) -> list[dict[str, Any]]:
    """Todas as plataformas registradas, com a conta do Usuário quando conectada."""
    contas = repositorio.contas(id_usuario)
    return [_visao(p, contas.get(nome)) for nome, p in PLATAFORMAS.items()]


def conectar(id_usuario: str, nome: str, identificador: str) -> dict[str, Any]:
    """Valida o perfil público na plataforma e grava a conta."""
    escolhida = plataforma_disponivel(nome)
    conta = escolhida.conectar(identificador)
    return _visao(escolhida, repositorio.gravar_conta(id_usuario, nome, conta))


def desconectar(id_usuario: str, nome: str) -> None:
    plataforma(nome)
    repositorio.remover_conta(id_usuario, nome)


def _planejar(id_usuario: str, casados: Iterable[casamento.Casado], hoje: date, db=banco):
    """(item, Mídia localizada ou None, Item atual, Mudança) dos itens casados que mudam algo.

    Item casado com a obra a importar (Mídia None) conta como novo (a Mídia entra ao confirmar).
    """
    casados = list(casados)
    atuais = repositorio.itens_do_usuario(id_usuario, sorted({m['id_midia'] for _, m in casados if m}), db)
    planos = []
    for item, midia in casados:
        atual = atuais.get(midia['id_midia']) if midia else None
        mudanca = aplicar(atual, item, total=midia['total'] if midia else None, hoje=hoje)
        if mudanca:
            planos.append((item, midia, atual, mudanca))
    return planos


def _sem_dados_se_localizado(item: ItemDeOrigem, midia) -> ItemDeOrigem:
    """A obra inteira só vai para a prévia quando ainda falta no Catálogo."""
    if midia is None or item.catalogo is None:
        return item
    return replace(item, catalogo=replace(item.catalogo, dados=None))


def previa_de_itens(id_usuario: str, nome: str, itens: list[ItemDeOrigem]) -> dict[str, Any]:
    """Conta e guarda a prévia de itens já lidos (a da plataforma ou a de um arquivo, como o XML do MAL)."""
    conferir_tamanho(len(itens))
    casados = casamento.casar(nome, itens, casamento.pelo_catalogo)
    planos = _planejar(id_usuario, casados.todos, date.today())
    nova = resultado.previa(itens=[_sem_dados_se_localizado(item, midia) for item, midia, *_ in planos],
                            nao_encontrados=casados.nao_encontrados)
    guardada = repositorio.criar_previa(id_usuario, nome, nova)
    novos = sum(1 for *_, m in planos if m.tipo == NOVO)
    contagens = resultado.criar(novos=novos, atualizados=len(planos) - novos, nao_encontrados=nova.nao_encontrados)
    return {'id_previa': guardada['id_previa'], 'expira_em': guardada['expira_em'], **contagens.resposta()}


def previa(id_usuario: str, nome: str) -> dict[str, Any]:
    """Lê a lista na plataforma conectada e monta a prévia."""
    if nome in SO_SINCRONIZAM:
        rotulo = plataforma(nome).rotulo
        raise SemPrevia(f'A {rotulo} não tem prévia: use "Sincronizar agora".')
    escolhida = plataforma_disponivel(nome)
    conta = repositorio.conta(id_usuario, nome)
    if conta is None:
        raise SemConta(nome)
    itens = escolhida.ler(Conta(conta['identificador'], conta['nome_exibicao']))
    return previa_de_itens(id_usuario, nome, itens)


def _gravar(db, id_usuario: str, casados: Iterable[casamento.Casado],
            nao_encontrados: Iterable[ItemDeOrigem], hoje: date) -> Resultado:
    """Grava na Lista o que `aplicar` decidir, pelo executor `db` (a transação do chamador).

    `casados` já com a Mídia; `nao_encontrados` (os do Casamento) entram no resultado.
    """
    casados = list(casados)
    lista = ListaPessoal(ItensLista(db), _CatalogoLocalizado(casados))
    planos = _planejar(id_usuario, casados, hoje, db)
    nao_encontrados = [nao_encontrado(i) for i in nao_encontrados]

    novos = atualizados = 0
    for item, midia, atual, mudanca in planos:
        if mudanca.tipo == NOVO:
            gravado = lista.adicionar(id_usuario, {**mudanca.campos, 'id_midia': midia['id_midia']})
            novos += gravado.bem_sucedido
        else:
            # Q114b: a origem chegar ao total nunca soma Recontagem.
            gravado = lista.atualizar(id_usuario, atual['id_lista'], mudanca.campos, contar_recontagem=False)
            atualizados += gravado.bem_sucedido
        if not gravado.bem_sucedido:
            nao_encontrados.append(nao_encontrado(item))
    return resultado.criar(novos=novos, atualizados=atualizados, nao_encontrados=nao_encontrados)


def aplicar_casados(id_usuario: str, casados: Iterable[casamento.Casado],
                    nao_encontrados: Iterable[ItemDeOrigem] = (), *, hoje: date | None = None) -> Resultado:
    """Grava na Lista (numa transação) o que `aplicar` decidir para os casados (já com a Mídia),
    na ordem dada; os `nao_encontrados` do Casamento entram no resultado.

    É o que a sincronização sem prévia (Steam) e o Vincular chamam.
    """
    with banco.transacao() as t:
        return _gravar(t, id_usuario, casados, nao_encontrados, hoje or date.today())


def confirmar(id_usuario: str, id_previa: str, *, hoje: date | None = None) -> dict[str, Any] | None:
    """Aplica a prévia (uma vez só) e registra o resultado na conta. None se ela não vale mais."""
    lida = repositorio.ler_previa(id_usuario, id_previa)
    if lida is None:
        return None
    plataforma_da_previa, guardada = lida
    # Importa as obras que faltam antes da transação; a que falha cai no vínculo da plataforma.
    casados = casamento.casar(plataforma_da_previa, guardada.itens_de_origem(),
                              casamento.importando(prazo.conferir))

    with banco.transacao() as t:
        consumida = repositorio.consumir_previa(id_usuario, id_previa, t)
        if consumida is None:
            return None  # outro confirmar levou a prévia enquanto as obras eram importadas
        plataforma_da_previa, guardada = consumida
        anteriores = resultado.criar(nao_encontrados=[
            {**n, 'link': link_seguro(n.get('link'))} for n in guardada.nao_encontrados
        ])
        final = resultado.somar(anteriores, _gravar(t, id_usuario, casados.todos, casados.nao_encontrados,
                                                    hoje or date.today()))
        repositorio.registrar_resultado(id_usuario, plataforma_da_previa, final, t)
    return final.resposta()


_ARTIGO_DO_TIPO = {'anime': 'um anime', 'manga': 'um mangá', 'jogo': 'um jogo'}


def vincular(id_usuario: str, nome: str, origem_id: str, id_midia: str, *, hoje: date | None = None) -> dict[str, Any]:
    """Vincula um Não encontrado do Usuário a uma Mídia (vale para todos) e aplica o Item na Lista.

    Só aceita o que apareceu como Não encontrado para ele (no último resultado ou numa prévia
    válida), na Mídia do mesmo Tipo. O item sai dos Não encontrados dele. Vínculo já existente
    na mesma Mídia só aplica o Item; em outra, VinculoEmConflito. Na Steam, se a busca já casou a
    appid com outra Mídia desde o Não encontrado (checado e gravado na mesma transação), também
    VinculoEmConflito, com `no_catalogo`: o jogo entra na próxima sincronização.
    """
    plataforma(nome)
    destino = vinculos.midia(id_midia)
    if destino is None:
        raise MidiaInexistente(id_midia)
    entradas = vinculos.nao_encontrados(id_usuario, nome, origem_id)
    if not entradas:
        raise ForaDosNaoEncontrados(origem_id)
    entrada = next((e for e in entradas if e.get('tipo') == destino['tipo']), None)
    if entrada is None or destino['tipo'] not in vinculos.TIPOS_DA_PLATAFORMA[nome]:
        esperado = ' ou '.join(_ARTIGO_DO_TIPO[t] for t in dict.fromkeys(e.get('tipo') for e in entradas)
                               if t in _ARTIGO_DO_TIPO)
        raise TipoIncompativel(f'Escolha {esperado or "uma Mídia do mesmo Tipo"}.')

    try:
        with banco.transacao() as t:
            vinculo = vinculos.gravar(t, nome, origem_id, destino['tipo'], destino['id_midia'], id_usuario,
                                      entrada.get('titulo') or origem_id)
            if vinculo['id_midia'] != destino['id_midia']:
                raise VinculoEmConflito(vinculo['id_midia'])
            _tirar_dos_nao_encontrados(t, id_usuario, nome, origem_id, destino['tipo'])
    except vinculos.JaNoCatalogo as erro:
        raise VinculoEmConflito(erro.id_midia, no_catalogo=True) from None

    vinculado = casamento.na_midia([resultado.item_do_nao_encontrado(entrada, destino['id_midia'])])
    aplicado = aplicar_casados(id_usuario, vinculado.todos, vinculado.nao_encontrados, hoje=hoje)
    return {'id_vinculo': vinculo['id'], 'id_midia': destino['id_midia'],
            'novos': aplicado.novos, 'atualizados': aplicado.atualizados}


def _tirar_dos_nao_encontrados(db, id_usuario: str, nome: str, origem_id: str, tipo: str) -> None:
    """O item sai do último resultado e das prévias do Usuário (o confirmar não o repete)."""
    antes = repositorio.ultimo_resultado_travado(db, id_usuario, nome)
    if antes is not None:
        depois = antes.sem_o_item(origem_id, tipo)
        if depois is not antes:
            repositorio.trocar_ultimo_resultado(db, id_usuario, nome, depois)
    for id_previa, previa_antes in repositorio.previas_travadas(db, id_usuario, nome):
        previa_depois = previa_antes.sem_o_item(origem_id, tipo)
        if previa_depois is not previa_antes:
            repositorio.trocar_previa(db, id_previa, previa_depois)
