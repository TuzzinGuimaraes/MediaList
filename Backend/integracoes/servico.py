"""Casos de uso das Integrações, sem HTTP: listar, conectar, desconectar, prévia e confirmar.

A prévia lê a origem, localiza cada item no Catálogo e conta o que `aplicar` faria
(novos, atualizados, Não encontrados), sem gravar nada; guarda os itens que mudam por 1 h.
Confirmar importa as obras que faltam no Catálogo (commits próprios: o upsert da Importação
é idempotente) e, numa transação só, consome a prévia, recalcula `aplicar` com a Lista de
agora, grava pela `ListaPessoal` (a mesma validação da rota da Lista) e registra o resultado.
Falha no meio desfaz tudo e a prévia continua valendo; dois confirmar da mesma prévia
aplicam uma vez só (o DELETE da prévia trava a linha até o commit).

Cada Não encontrado guarda o item inteiro (sem a obra da fonte), para o Vincular aplicá-lo
depois; a resposta só mostra título, link, `origem_id` e Tipo. Vincular (`vincular`) grava o
vínculo global e aplica o Item como a sincronização. O vínculo é reserva: a fonte casa primeiro
(a Mídia já no Catálogo ou a obra que ela traz para importar) e o vínculo só vale para o item
que a fonte não casa (nem localiza, nem importa). Assim um vínculo errado nunca tira um item que
a fonte acerta.

Os erros sobem como `integracoes.plataforma.ErroDaIntegracao` (a rota traduz) ou
`SemConta`/`PlataformaDesconhecida` e os do Vincular (`MidiaInexistente`, `ForaDosNaoEncontrados`,
`TipoIncompativel`, `VinculoEmConflito`).
"""
from __future__ import annotations

from dataclasses import fields, replace
from datetime import date
from typing import Any

import banco
from dominio.lista_pessoal import ListaPessoal
from integracoes import catalogo, prazo, repositorio, vinculos
from integracoes.anilist import AniList
from integracoes.aplicar import NOVO, aplicar
from integracoes.mal import MAL
from integracoes.plataforma import (
    Conta,
    ErroDaIntegracao,
    ItemDeOrigem,
    Plataforma,
    PlataformaIndisponivel,
    RefCatalogo,
    conferir_tamanho,
    item_de_json,
    item_para_json,
    link_seguro,
)
from integracoes.steam import Steam
from repositories.itens_lista import ItensLista

#: As plataformas registradas, na ordem da tela. Os tickets do MAL e da Steam somam aqui.
PLATAFORMAS: dict[str, Plataforma] = {'anilist': AniList(), 'mal': MAL(), 'steam': Steam()}

#: Quantos Não encontrados saem na resposta (o total sai à parte).
AMOSTRA_NAO_ENCONTRADOS = 100

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
    """O item já está vinculado a outra Mídia."""


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


def plataforma_disponivel(nome: str) -> Plataforma:
    """A plataforma registrada, se tem a chave no ambiente; senão PlataformaIndisponivel."""
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
    escolhida = plataforma_disponivel(nome)
    conta = escolhida.conectar(identificador)
    return _visao(escolhida, repositorio.gravar_conta(id_usuario, nome, conta))


def desconectar(id_usuario: str, nome: str) -> None:
    plataforma(nome)
    repositorio.remover_conta(id_usuario, nome)


def nao_encontrado(item: ItemDeOrigem) -> dict[str, Any]:
    """O Não encontrado como fica guardado: o item inteiro, sem a obra da fonte (o Vincular o aplica)."""
    return item_para_json(replace(item, catalogo=None))


def _item_do_nao_encontrado(entrada: dict[str, Any], id_midia: str) -> ItemDeOrigem:
    campos = {f.name for f in fields(ItemDeOrigem)} - {'catalogo'}
    return replace(item_de_json({k: v for k, v in entrada.items() if k in campos}),
                   catalogo=RefCatalogo('midia', id_midia))


def _contagens(novos: int, atualizados: int, nao_encontrados: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        'novos': novos,
        'atualizados': atualizados,
        'nao_encontrados': nao_encontrados[:AMOSTRA_NAO_ENCONTRADOS],
        'total_nao_encontrados': len(nao_encontrados),
    }


def _planejar(id_usuario: str, itens: list[ItemDeOrigem], localizadas, hoje: date, db=banco):
    """(item, Mídia localizada ou None, Mudança) dos itens que mudam algo, e os Não encontrados.

    Item que não está no Catálogo e é importável conta como novo (a Mídia entra ao confirmar).
    """
    atuais = repositorio.itens_do_usuario(id_usuario, sorted({m['id_midia'] for m in localizadas.values()}), db)
    planos, nao_encontrados = [], []
    for item in itens:
        midia = localizadas.get(catalogo.chave(item)) if item.catalogo else None
        if midia is None and not catalogo.importavel(item):
            nao_encontrados.append(nao_encontrado(item))
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


def _casar_com_reserva(nome: str, itens: list[ItemDeOrigem]):
    """(itens, Mídias localizadas): a fonte primeiro; o vínculo só no item que ela não casa."""
    localizadas = catalogo.localizar(itens)

    def casa(item: ItemDeOrigem) -> bool:
        return catalogo.chave(item) in localizadas or catalogo.importavel(item)

    pela_reserva = iter(vinculos.aplicar(nome, [i for i in itens if not casa(i)]))
    itens = [item if casa(item) else next(pela_reserva) for item in itens]
    localizadas.update(catalogo.localizar([i for i in itens if i.catalogo and i.catalogo.fonte == 'midia']))
    return itens, localizadas


def previa_de_itens(id_usuario: str, nome: str, itens: list[ItemDeOrigem]) -> dict[str, Any]:
    """Conta e guarda a prévia de itens já lidos (a da plataforma ou a de um arquivo, como o XML do MAL)."""
    conferir_tamanho(len(itens))
    itens, localizadas = _casar_com_reserva(nome, itens)
    planos, nao_encontrados = _planejar(id_usuario, itens, localizadas, date.today())
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
    if nome in SO_SINCRONIZAM:
        rotulo = plataforma(nome).rotulo
        raise SemPrevia(f'A {rotulo} não tem prévia: use "Sincronizar agora".')
    escolhida = plataforma_disponivel(nome)
    conta = repositorio.conta(id_usuario, nome)
    if conta is None:
        raise SemConta(nome)
    itens = escolhida.ler(Conta(conta['identificador'], conta['nome_exibicao']))
    return previa_de_itens(id_usuario, nome, itens)


def _importar_faltantes(itens: list[ItemDeOrigem], nome: str | None = None) -> dict[catalogo.Chave, Any]:
    """As Mídias dos itens, importando as que faltam (cada uma no seu commit; o upsert é idempotente).

    Com `nome`, a importação que falha cai no vínculo da plataforma (a reserva), na chave do item.
    """
    localizadas = catalogo.localizar(itens)
    falharam = []
    for item in itens:
        chave = catalogo.chave(item)
        if chave is not None and chave not in localizadas:
            prazo.conferir()
            importada = catalogo.importar(item)
            if importada:
                localizadas[chave] = importada
            else:
                falharam.append(item)
    if nome and falharam:
        pela_reserva = vinculos.aplicar(nome, [replace(i, catalogo=None) for i in falharam])
        achadas = catalogo.localizar([i for i in pela_reserva if i.catalogo])
        for original, vinculado in zip(falharam, pela_reserva, strict=True):
            midia = achadas.get(catalogo.chave(vinculado)) if vinculado.catalogo else None
            if midia:
                localizadas[catalogo.chave(original)] = midia
    return localizadas


def _gravar(db, id_usuario: str, itens: list[ItemDeOrigem], localizadas, hoje: date) -> dict[str, Any]:
    """Grava na Lista o que `aplicar` decidir, pelo executor `db` (a transação do chamador)."""
    lista = ListaPessoal(ItensLista(db), _CatalogoLocalizado(localizadas))
    planos, faltando = _planejar(id_usuario, [i for i in itens if localizadas.get(catalogo.chave(i))],
                                 localizadas, hoje, db)
    nao_encontrados = [nao_encontrado(i) for i in itens if not localizadas.get(catalogo.chave(i))]
    nao_encontrados.extend(faltando)

    novos = atualizados = 0
    for item, midia, atual, mudanca in planos:
        if mudanca.tipo == NOVO:
            resultado = lista.adicionar(id_usuario, {**mudanca.campos, 'id_midia': midia['id_midia']})
            novos += resultado.bem_sucedido
        else:
            # Q114b: a origem chegar ao total nunca soma Recontagem.
            resultado = lista.atualizar(id_usuario, atual['id_lista'], mudanca.campos, contar_recontagem=False)
            atualizados += resultado.bem_sucedido
        if not resultado.bem_sucedido:
            nao_encontrados.append(nao_encontrado(item))
    return _contagens(novos, atualizados, nao_encontrados)


def aplicar_itens(id_usuario: str, itens: list[ItemDeOrigem], *, hoje: date | None = None) -> dict[str, Any]:
    """Importa as obras que faltam e grava na Lista (numa transação) o que `aplicar` decidir.

    É o que a sincronização sem prévia (Steam) chama. Devolve as contagens.
    """
    localizadas = _importar_faltantes(itens)
    with banco.transacao() as t:
        return _gravar(t, id_usuario, itens, localizadas, hoje or date.today())


def confirmar(id_usuario: str, id_previa: str, *, hoje: date | None = None) -> dict[str, Any] | None:
    """Aplica a prévia (uma vez só) e registra o resultado na conta. None se ela não vale mais."""
    guardada = repositorio.ler_previa(id_usuario, id_previa)
    if guardada is None:
        return None
    itens = [item_de_json(d) for d in guardada['conteudo']['itens']]
    localizadas = _importar_faltantes(itens, guardada['plataforma'])

    with banco.transacao() as t:
        consumida = repositorio.consumir_previa(id_usuario, id_previa, t)
        if consumida is None:
            return None  # outro confirmar levou a prévia enquanto as obras eram importadas
        resultado = _gravar(t, id_usuario, itens, localizadas, hoje or date.today())
        anteriores = [{**n, 'link': link_seguro(n.get('link'))}
                      for n in consumida['conteudo'].get('nao_encontrados') or []]
        nao_encontrados = anteriores + resultado['nao_encontrados']
        resultado = {
            **resultado,
            'nao_encontrados': nao_encontrados[:AMOSTRA_NAO_ENCONTRADOS],
            'total_nao_encontrados': len(anteriores) + resultado['total_nao_encontrados'],
        }
        repositorio.registrar_resultado(id_usuario, consumida['plataforma'], resultado, t)
    return resultado


_ARTIGO_DO_TIPO = {'anime': 'um anime', 'manga': 'um mangá', 'jogo': 'um jogo'}


def vincular(id_usuario: str, nome: str, origem_id: str, id_midia: str, *, hoje: date | None = None) -> dict[str, Any]:
    """Vincula um Não encontrado do Usuário a uma Mídia (vale para todos) e aplica o Item na Lista.

    Só aceita o que apareceu como Não encontrado para ele (no último resultado ou numa prévia
    válida), na Mídia do mesmo Tipo. O item sai dos Não encontrados dele. Vínculo já existente
    na mesma Mídia só aplica o Item; em outra, VinculoEmConflito.
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

    with banco.transacao() as t:
        vinculo = vinculos.gravar(t, nome, origem_id, destino['tipo'], destino['id_midia'], id_usuario,
                                  entrada.get('titulo') or origem_id)
        if vinculo['id_midia'] != destino['id_midia']:
            raise VinculoEmConflito(origem_id)
        vinculos.tirar_dos_nao_encontrados(t, id_usuario, nome, origem_id, destino['tipo'])

    resultado = aplicar_itens(id_usuario, [_item_do_nao_encontrado(entrada, destino['id_midia'])], hoje=hoje)
    return {'id_vinculo': vinculo['id'], 'id_midia': destino['id_midia'],
            'novos': resultado['novos'], 'atualizados': resultado['atualizados']}
