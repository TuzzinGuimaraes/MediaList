"""O que toda plataforma de Integração entrega: a interface e os tipos dela.

Ver o docstring do pacote (`integracoes/__init__.py`) para como somar uma plataforma.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal, Protocol
from urllib.parse import urlsplit

TipoDeMidia = Literal['anime', 'manga', 'jogo']

#: Teto de itens de origem por importação (anime + mangá, ou jogos): acima disso, `ListaGrandeDemais`
#: em vez de estourar o tempo da função.
MAXIMO_ITENS = 5000

#: Hosts aceitos no link de um item (e dos Não encontrados), sempre em `https://`; subdomínios valem.
HOSTS_DE_LINK = ('anilist.co', 'myanimelist.net', 'store.steampowered.com', 'rawg.io')


def link_seguro(link: str | None) -> str | None:
    """O link, se for `https://` de uma das plataformas (`HOSTS_DE_LINK`); senão None.

    O link vem da origem e vai para a tela como `href`: nada de `javascript:`, outro host ou
    credenciais na URL.
    """
    if not isinstance(link, str) or not link.startswith('https://'):
        return None
    try:
        partes = urlsplit(link)
        host = (partes.hostname or '').lower()
    except ValueError:
        return None
    if partes.username is not None or partes.password is not None or partes.netloc.lower() not in (
        host, f'{host}:443',
    ):
        return None
    return link if any(host == h or host.endswith(f'.{h}') for h in HOSTS_DE_LINK) else None


@dataclass(frozen=True)
class Conta:
    """A conta pública na plataforma: o identificador que a API dela aceita e o nome para a tela."""

    identificador: str
    nome_exibicao: str | None = None


@dataclass(frozen=True)
class RefCatalogo:
    """Como achar (ou importar) a Mídia de um item no Catálogo.

    `fonte` + `id_fonte` é a chave da Importação: `anilist` → `anilist_id` (anime/mangá),
    `rawg` → `rawg_slug` (jogo), `steam` → `steam_appid` (jogo criado pela loja da Steam).
    `midia` → o próprio `id_midia`: a Mídia já é conhecida (casamento gravado, vínculo).
    `dados` é a obra no formato da fonte, o que a Importação grava quando a Mídia ainda não
    está no Catálogo; None quando só dá para localizar.
    """

    fonte: Literal['anilist', 'rawg', 'steam', 'midia']
    id_fonte: str
    dados: dict[str, Any] | None = None


@dataclass(frozen=True)
class ItemDeOrigem:
    """Um item da lista do Usuário na plataforma, já normalizado.

    `status` é o Estado de consumo (`schemas.estado_consumo`, ex. `em_progresso`), não o
    Rótulo; `nota` já está na escala 0..10 (`integracoes.mapeamento`). Datas `YYYY-MM-DD`.
    Jogos: `horas` (inteiras) e `jogado_em` (última vez jogado), `progresso` fica None.
    `catalogo` None é item que não casa com segurança: vai para "Não encontrados".
    """

    origem_id: str
    tipo: TipoDeMidia
    titulo: str
    link: str | None
    status: str | None = None
    progresso: int | None = None
    nota: float | None = None
    data_inicio: str | None = None
    data_conclusao: str | None = None
    horas: int | None = None
    jogado_em: str | None = None
    catalogo: RefCatalogo | None = field(default=None, compare=False)

    def __post_init__(self):
        object.__setattr__(self, 'link', link_seguro(self.link))


class ErroDaIntegracao(Exception):
    """Base dos erros que a rota traduz. A mensagem é a que o Usuário vê."""


class PerfilPrivado(ErroDaIntegracao):
    """O perfil existe, mas a lista não é pública."""


class PerfilNaoEncontrado(ErroDaIntegracao):
    """Nenhum perfil com esse nome/URL."""


class PlataformaIndisponivel(ErroDaIntegracao):
    """Sem a chave da plataforma no ambiente (ex. `MAL_CLIENT_ID`)."""


class OrigemIndisponivel(ErroDaIntegracao):
    """A plataforma não respondeu (rede, 5xx, limite de requisições)."""


class ListaGrandeDemais(ErroDaIntegracao):
    """A lista da origem passa de `MAXIMO_ITENS`: não cabe numa requisição."""

    def __init__(self, mensagem: str | None = None):
        super().__init__(mensagem or (
            f'A lista passa de {MAXIMO_ITENS} itens, o máximo que dá para importar de uma vez.'
        ))


def conferir_tamanho(quantidade: int, maximo: int | None = None) -> None:
    """Levanta ListaGrandeDemais se `quantidade` passa do teto."""
    if quantidade > (MAXIMO_ITENS if maximo is None else maximo):
        raise ListaGrandeDemais()


class Plataforma(Protocol):
    """Uma plataforma de Integração. Implementações em `integracoes/<nome>.py`."""

    #: Valor de `integracoes.plataforma` no banco (`anilist`, `mal`, `steam`).
    nome: str
    #: Nome para a tela.
    rotulo: str

    def disponivel(self) -> bool:
        """False quando falta a chave no ambiente: a tela mostra a plataforma como indisponível."""
        ...

    def conectar(self, identificador: str) -> Conta:
        """Valida que o perfil existe e é público. Levanta PerfilPrivado/PerfilNaoEncontrado."""
        ...

    def ler(self, conta: Conta) -> list[ItemDeOrigem]:
        """A lista pública inteira, normalizada. Levanta os mesmos erros de `conectar`."""
        ...



def item_para_json(item: ItemDeOrigem) -> dict[str, Any]:
    """O item como JSON (para guardar na prévia)."""
    return asdict(item)


def item_de_json(dados: dict[str, Any]) -> ItemDeOrigem:
    """Inverso de `item_para_json`."""
    catalogo = dados.get('catalogo')
    return ItemDeOrigem(**{**dados, 'catalogo': RefCatalogo(**catalogo) if catalogo else None})
