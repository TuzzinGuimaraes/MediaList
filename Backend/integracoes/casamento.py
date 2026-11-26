"""Casamento (ADR-0015, Q133): a Mídia de cada item da origem, com o vínculo como reserva.

É o único dono da ordem: a fonte da plataforma casa primeiro, e o vínculo de um Usuário
(`integracoes.vinculos`) só vale para o item que ela não casa. Assim um vínculo errado nunca tira
um item que a fonte acerta. Também relocaliza no Catálogo o que o vínculo casou.

A fonte é o que varia por plataforma. Recebe os itens e devolve, para cada um, na mesma ordem:
- `(item, Mídia)`: casou (o item pode vir trocado, ex. na Mídia do casamento gravado);
- `(item, None)`: a Mídia falta no Catálogo, mas o item traz a obra para importar;
- `NAO_CASA`: a fonte não casa; vai para o vínculo e, sem vínculo, para Não encontrados;
- `IGNORADO`: não é obra do Catálogo (a loja da Steam diz que não é jogo); some;
- `PENDENTE`: ficou para a próxima (orçamento, a fonte fora do ar); só conta.

AniList e MAL usam o Catálogo (`pelo_catalogo` na prévia, `importando` no confirmar); a Steam
entrega a cadeia dela (`integracoes.sincronizacao_steam`), que continua dona do orçamento.
"""
from __future__ import annotations

import enum
from dataclasses import dataclass, replace
from typing import Callable, Iterable

from integracoes import catalogo, vinculos
from integracoes.plataforma import ItemDeOrigem


class Desfecho(enum.Enum):
    NAO_CASA = 'nao_casa'
    IGNORADO = 'ignorado'
    PENDENTE = 'pendente'


NAO_CASA = Desfecho.NAO_CASA
IGNORADO = Desfecho.IGNORADO
PENDENTE = Desfecho.PENDENTE

#: Um item casado e a Mídia dele (None: a obra que ele traz ainda vai ser importada).
Casado = tuple[ItemDeOrigem, catalogo.Localizada | None]
#: A fonte de uma plataforma: o desfecho de cada item, na ordem dos itens.
Fonte = Callable[[list[ItemDeOrigem]], Iterable[Casado | Desfecho]]


@dataclass(frozen=True)
class Casados:
    """O que o Casamento deu. Cada lista vem na ordem dos itens."""

    pela_fonte: tuple[Casado, ...]
    pelo_vinculo: tuple[Casado, ...]
    nao_encontrados: tuple[ItemDeOrigem, ...]
    pendentes: int
    #: Os casados (pela fonte e pelo vínculo) na ordem dos itens.
    em_ordem: tuple[Casado, ...]


def casar(plataforma: str, itens: list[ItemDeOrigem], fonte: Fonte) -> Casados:
    """A fonte primeiro; o vínculo da plataforma só nos itens que ela não casa."""
    desfechos = list(fonte(itens))
    # strict: a fonte devolve um desfecho por item.
    sem_fonte = [i for i, d in zip(itens, desfechos, strict=True) if d is NAO_CASA]
    pela_reserva = iter(_pelo_vinculo(plataforma, sem_fonte))

    pela_fonte, pelo_vinculo, nao_encontrados, em_ordem = [], [], [], []
    pendentes = 0
    for desfecho in desfechos:
        if desfecho is PENDENTE:
            pendentes += 1
        elif desfecho is NAO_CASA:
            original, casado = next(pela_reserva)
            if casado is None:
                nao_encontrados.append(original)
            else:
                pelo_vinculo.append(casado)
                em_ordem.append(casado)
        elif desfecho is not IGNORADO:
            pela_fonte.append(desfecho)
            em_ordem.append(desfecho)
    return Casados(tuple(pela_fonte), tuple(pelo_vinculo), tuple(nao_encontrados), pendentes, tuple(em_ordem))


def na_midia(itens: list[ItemDeOrigem]) -> Casados:
    """Itens já na Mídia (`RefCatalogo('midia', ...)`: casamento gravado, Vincular), relocalizados no
    Catálogo; o que não está mais nele vai para Não encontrados. Sem reserva."""
    localizadas = catalogo.localizar(itens)
    casados = tuple((i, localizadas[catalogo.chave(i)]) for i in itens if catalogo.chave(i) in localizadas)
    faltam = tuple(i for i in itens if catalogo.chave(i) not in localizadas)
    return Casados(casados, (), faltam, 0, casados)


def _pelo_vinculo(plataforma: str, itens: list[ItemDeOrigem]) -> list[tuple[ItemDeOrigem, Casado | None]]:
    """(original, casado pelo vínculo e relocalizado, ou None) de cada item, na ordem."""
    if not itens:
        return []
    vinculados = vinculos.aplicar(plataforma, [replace(i, catalogo=None) for i in itens])
    localizadas = catalogo.localizar([v for v in vinculados if v.catalogo])
    pares = []
    for original, vinculado in zip(itens, vinculados, strict=True):
        midia = localizadas.get(catalogo.chave(vinculado)) if vinculado.catalogo else None
        pares.append((original, (vinculado, midia) if midia else None))
    return pares


def pelo_catalogo(itens: list[ItemDeOrigem]) -> list[Casado | Desfecho]:
    """A fonte da prévia do AniList e do MAL, sem gravar: a Mídia já no Catálogo ou a obra que o
    item traz para importar."""
    localizadas = catalogo.localizar(itens)
    desfechos: list[Casado | Desfecho] = []
    for item in itens:
        midia = localizadas.get(catalogo.chave(item)) if item.catalogo else None
        if midia is not None:
            desfechos.append((item, midia))
        elif catalogo.importavel(item):
            desfechos.append((item, None))
        else:
            desfechos.append(NAO_CASA)
    return desfechos


def importando(antes_de_importar: Callable[[], None] = lambda: None) -> Fonte:
    """A fonte do confirmar: a Mídia já no Catálogo ou a obra importada agora (cada uma no seu
    commit; o upsert é idempotente). A importação que falha não casa (cai no vínculo).

    `antes_de_importar` roda antes de cada importação (o prazo da requisição).
    """
    def fonte(itens: list[ItemDeOrigem]) -> list[Casado | Desfecho]:
        localizadas = catalogo.localizar(itens)
        desfechos: list[Casado | Desfecho] = []
        for item in itens:
            chave = catalogo.chave(item)
            midia = localizadas.get(chave)
            if midia is None and chave is not None:
                antes_de_importar()
                midia = catalogo.importar(item)
                if midia:
                    localizadas[chave] = midia
            desfechos.append((item, midia) if midia else NAO_CASA)
        return desfechos

    return fonte
