"""Casamento (ADR-0015, Q133): a Mídia de cada item da origem, com o vínculo como reserva.

É o único dono da ordem: a busca da plataforma casa primeiro, e o vínculo de um Usuário
(`integracoes.vinculos`) só vale para o item que ela não casa. Assim um vínculo errado nunca tira
um item que a busca acerta. Também relocaliza no Catálogo o que o vínculo casou.

A busca é o que varia por plataforma. Recebe os itens e devolve, para cada um, na mesma ordem:
- `(item, Mídia)`: casou (o item pode vir trocado, ex. na Mídia do casamento gravado);
- `(item, None)`: a Mídia falta no Catálogo, mas o item traz a obra (da fonte) para importar;
- `Desfecho.NAO_CASA`: a busca não casa; vai para o vínculo e, sem vínculo, para Não encontrados;
- `Desfecho.IGNORADO`: não é obra do Catálogo (a loja da Steam diz que não é jogo); some;
- `Desfecho.PENDENTE`: ficou para a próxima (orçamento, a busca fora do ar); só conta.

AniList e MAL buscam no Catálogo e na obra da fonte (`pelo_catalogo` na prévia, `importando` no
confirmar); a Steam entrega a cadeia dela (`integracoes.sincronizacao_steam.pela_cadeia`), que
continua dona do orçamento.
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


#: Um item casado e a Mídia dele (None: a obra que ele traz ainda vai ser importada).
Casado = tuple[ItemDeOrigem, catalogo.Localizada | None]
#: A busca de uma plataforma: o desfecho de cada item, na ordem dos itens.
Busca = Callable[[list[ItemDeOrigem]], Iterable[Casado | Desfecho]]


@dataclass(frozen=True)
class Casados:
    """O que o Casamento deu. Cada lista vem na ordem dos itens."""

    pela_busca: tuple[Casado, ...]
    pelo_vinculo: tuple[Casado, ...]
    nao_encontrados: tuple[ItemDeOrigem, ...]
    pendentes: int

    @property
    def todos(self) -> tuple[Casado, ...]:
        """Os casados na ordem de aplicar: os da busca antes dos do vínculo (com dois itens na mesma
        Mídia, o da busca entra e o do vínculo vira Não encontrado)."""
        return self.pela_busca + self.pelo_vinculo


def casar(plataforma: str, itens: list[ItemDeOrigem], busca: Busca) -> Casados:
    """A busca primeiro; o vínculo da plataforma só nos itens que ela não casa."""
    desfechos = list(busca(itens))
    # strict: a busca devolve um desfecho por item.
    sem_busca = [i for i, d in zip(itens, desfechos, strict=True) if d is Desfecho.NAO_CASA]
    pela_reserva = iter(_pelo_vinculo(plataforma, sem_busca))

    pela_busca, pelo_vinculo, nao_encontrados = [], [], []
    pendentes = 0
    for desfecho in desfechos:
        if desfecho is Desfecho.PENDENTE:
            pendentes += 1
        elif desfecho is Desfecho.NAO_CASA:
            original, casado = next(pela_reserva)
            if casado is None:
                nao_encontrados.append(original)
            else:
                pelo_vinculo.append(casado)
        elif desfecho is not Desfecho.IGNORADO:
            pela_busca.append(desfecho)
    return Casados(tuple(pela_busca), tuple(pelo_vinculo), tuple(nao_encontrados), pendentes)


def na_midia(itens: list[ItemDeOrigem]) -> Casados:
    """Itens já na Mídia (`RefCatalogo('midia', ...)`: casamento gravado, Vincular), relocalizados no
    Catálogo; o que não está mais nele vai para Não encontrados. Sem reserva."""
    localizadas = catalogo.localizar(itens)
    casados = tuple((i, localizadas[catalogo.chave(i)]) for i in itens if catalogo.chave(i) in localizadas)
    faltam = tuple(i for i in itens if catalogo.chave(i) not in localizadas)
    return Casados(casados, (), faltam, 0)


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
    """A busca da prévia do AniList e do MAL, sem gravar: a Mídia já no Catálogo ou a obra que o
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
            desfechos.append(Desfecho.NAO_CASA)
    return desfechos


def importando(antes_de_importar: Callable[[], None] = lambda: None) -> Busca:
    """A busca do confirmar: a Mídia já no Catálogo ou a obra importada agora (cada uma no seu
    commit; o upsert é idempotente). A importação que falha não casa (cai no vínculo).

    `antes_de_importar` roda antes de cada importação (o prazo da requisição).
    """
    def busca(itens: list[ItemDeOrigem]) -> list[Casado | Desfecho]:
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
            desfechos.append((item, midia) if midia else Desfecho.NAO_CASA)
        return desfechos

    return busca
