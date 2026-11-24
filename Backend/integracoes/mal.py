"""MyAnimeList: lista pública pela API v2 (com `MAL_CLIENT_ID`) ou pelo XML exportado.

API v2: `GET /v2/users/{nome}/animelist` e `/mangalist` com o cabeçalho `X-MAL-CLIENT-ID`
(dados públicos, sem OAuth), `fields=list_status`, `limit=1000`, `nsfw=true`; a próxima
página vem em `paging.next`. 404 é perfil inexistente; 403, lista privada; o resto, origem
indisponível. Sem a chave, a plataforma fica indisponível, mas o XML continua funcionando.

XML (o que o MAL, o AniList e o Kitsu exportam): `<myanimelist>` com `<anime>`
(`series_animedb_id`, `my_watched_episodes`) e `<manga>` (`manga_mangadb_id`,
`my_read_chapters`), `my_status`/`my_score`, datas `0000-00-00` = sem data. Lido com
`defusedxml` (sem entidades nem DTD externo), `.xml` ou `.xml.gz`, com limite de tamanho
antes e depois de descomprimir.

O Catálogo tem uma fonte só para anime e mangá (ADR 0015): cada item é casado pelo `idMal`
do AniList (`Page(media(idMal_in:))` em lotes de 50), que devolve a obra inteira para a
importação sob demanda. Sem par no AniList, o item vai para Não encontrados com o link do MAL.

A chave nunca vai para URL, log ou mensagem de erro (`_sem_chave`).
"""
from __future__ import annotations

import gzip
import io
import logging
import os
import re
import zlib
from dataclasses import replace
from typing import Any

from defusedxml import DefusedXmlException
from defusedxml.ElementTree import ParseError, fromstring

from importacao.anilist import CAMPOS_MEDIA
from importacao.config import ANILIST_URL
from importacao.utils import criar_sessao_http
from integracoes.mapeamento import estado_da_origem, nota_mal
from integracoes.plataforma import (
    Conta,
    ErroDaIntegracao,
    ItemDeOrigem,
    OrigemIndisponivel,
    PerfilNaoEncontrado,
    PerfilPrivado,
    PlataformaIndisponivel,
    RefCatalogo,
)
from schemas.estado_consumo import EM_PROGRESSO

logger = logging.getLogger(__name__)

API_URL = 'https://api.myanimelist.net/v2'
POR_PAGINA = 1000
LOTE_ANILIST = 50
#: Tamanho máximo do arquivo enviado e do XML depois de descomprimir o `.gz`.
LIMITE_XML = 5 * 1024 * 1024
LIMITE_XML_DESCOMPRIMIDO = 20 * 1024 * 1024

#: (lista na API, Tipo, campo do Progresso, campo de repetindo)
_LISTAS = (
    ('animelist', 'anime', 'num_episodes_watched', 'is_rewatching'),
    ('mangalist', 'manga', 'num_chapters_read', 'is_rereading'),
)
_TIPO_ANILIST = {'anime': 'ANIME', 'manga': 'MANGA'}

_NOME = re.compile(r'^[A-Za-z0-9_-]{2,16}$')
_URL_PERFIL = re.compile(r'myanimelist\.net/(?:profile|animelist|mangalist)/([^/?#\s]+)', re.IGNORECASE)
_DATA = re.compile(r'^(\d{4})-(\d{2})-(\d{2})$')

MENSAGEM_PRIVADO = (
    'A lista do MyAnimeList é privada. Nas configurações do MyAnimeList, deixe a lista pública '
    'e tente de novo.'
)
MENSAGEM_NAO_ENCONTRADO = 'Nenhum perfil do MyAnimeList com esse nome de usuário.'
MENSAGEM_INDISPONIVEL = 'O MyAnimeList não respondeu agora. Tente de novo em alguns minutos.'
MENSAGEM_SEM_CHAVE = 'O MyAnimeList está indisponível no momento. Envie o arquivo XML exportado.'
MENSAGEM_ANILIST = 'O AniList, usado para casar as obras do MyAnimeList, não respondeu. Tente de novo.'
MENSAGEM_ARQUIVO = 'Arquivo inválido: envie o XML exportado do MyAnimeList (.xml ou .xml.gz).'
MENSAGEM_GRANDE = 'O arquivo passa de 5 MB.'

_CONSULTA_IDMAL = """
query ($ids: [Int], $tipo: MediaType, $porPagina: Int) {
  Page(page: 1, perPage: $porPagina) {
    media(idMal_in: $ids, type: $tipo) {
      idMal
      siteUrl""" + CAMPOS_MEDIA + """    }
  }
}
"""


class ArquivoInvalido(ErroDaIntegracao):
    """O arquivo enviado não é um XML do MAL que dê para ler com segurança."""


class ArquivoGrandeDemais(ArquivoInvalido):
    """O arquivo (ou o XML descomprimido) passa do limite."""


def _chave() -> str:
    return (os.getenv('MAL_CLIENT_ID') or '').strip()


def _sem_chave(texto: str) -> str:
    chave = _chave()
    return texto.replace(chave, '***') if chave else texto


def _nome_de(identificador: str) -> str:
    texto = (identificador or '').strip()
    url = _URL_PERFIL.search(texto)
    if url:
        texto = url.group(1)
    if not _NOME.match(texto):
        raise PerfilNaoEncontrado(MENSAGEM_NAO_ENCONTRADO)
    return texto


def _data(texto: str | None) -> str | None:
    """Só data completa: `0000-00-00`, `2021-05-00` e `2020-05` ficam vazias."""
    casada = _DATA.match((texto or '').strip())
    if not casada or '00' in (casada.group(2), casada.group(3)) or casada.group(1) == '0000':
        return None
    return casada.group(0)


def _inteiro(valor: Any) -> int | None:
    try:
        return int(str(valor).strip())
    except (TypeError, ValueError):
        return None


def _item(id_mal: int, tipo: str, titulo: str | None, status: str | None, progresso: Any, nota: Any,
          inicio: str | None = None, conclusao: str | None = None, repetindo: bool = False) -> ItemDeOrigem:
    """Item do MAL ainda sem `catalogo` (o `casar` preenche)."""
    return ItemDeOrigem(
        origem_id=str(id_mal),
        tipo=tipo,
        titulo=titulo or f'MyAnimeList {id_mal}',
        link=f'https://myanimelist.net/{tipo}/{id_mal}',
        # REPEATING (Q114): Em progresso, sem mexer na Recontagem.
        status=EM_PROGRESSO if repetindo else estado_da_origem(status),
        progresso=_inteiro(progresso),
        nota=nota_mal(_inteiro(nota)),
        data_inicio=_data(inicio),
        data_conclusao=_data(conclusao),
    )


# ============================================
# Casamento pelo idMal do AniList
# ============================================

def _pedir_ao_anilist(sessao, ids: list[int], tipo: str) -> list[dict]:
    variaveis = {'ids': ids, 'tipo': _TIPO_ANILIST[tipo], 'porPagina': LOTE_ANILIST}
    try:
        resposta = sessao.post(ANILIST_URL, json={'query': _CONSULTA_IDMAL, 'variables': variaveis}, timeout=30)
        corpo = resposta.json()
    except Exception as exc:
        logger.warning('AniList sem resposta no casamento do MAL: %s', exc)
        raise OrigemIndisponivel(MENSAGEM_ANILIST) from exc
    pagina = ((corpo or {}).get('data') or {}).get('Page')
    if resposta.status_code != 200 or pagina is None:
        logger.warning('AniList respondeu %s no casamento do MAL', resposta.status_code)
        raise OrigemIndisponivel(MENSAGEM_ANILIST)
    return pagina.get('media') or []


def casar(itens: list[ItemDeOrigem], sessao=None) -> list[ItemDeOrigem]:
    """Os itens com `catalogo` apontando para a obra do AniList de mesmo `idMal` (quando há)."""
    propria = sessao is None
    sessao = sessao or criar_sessao_http(total_retries=1, backoff_factor=0.5)
    achadas: dict[tuple[str, int], dict] = {}
    try:
        for tipo in _TIPO_ANILIST:
            ids = list(dict.fromkeys(int(i.origem_id) for i in itens if i.tipo == tipo))
            for inicio in range(0, len(ids), LOTE_ANILIST):
                for media in _pedir_ao_anilist(sessao, ids[inicio:inicio + LOTE_ANILIST], tipo):
                    if media.get('idMal') is not None and media.get('id') is not None:
                        achadas.setdefault((tipo, int(media['idMal'])), media)
    finally:
        if propria:
            sessao.close()

    casados = []
    for item in itens:
        media = achadas.get((item.tipo, int(item.origem_id)))
        if media:
            item = replace(item, catalogo=RefCatalogo('anilist', str(media['id']), media))
        casados.append(item)
    return casados


# ============================================
# XML exportado
# ============================================

def _descomprimir(conteudo: bytes) -> bytes:
    if conteudo[:2] != b'\x1f\x8b':
        return conteudo
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(conteudo)) as arquivo:
            xml = arquivo.read(LIMITE_XML_DESCOMPRIMIDO + 1)
    except (OSError, EOFError, zlib.error) as exc:
        raise ArquivoInvalido(MENSAGEM_ARQUIVO) from exc
    if len(xml) > LIMITE_XML_DESCOMPRIMIDO:
        raise ArquivoGrandeDemais(MENSAGEM_GRANDE)
    return xml


def _texto(no, campo: str) -> str | None:
    filho = no.find(campo)
    return filho.text.strip() if filho is not None and filho.text else None


#: (elemento, Tipo, campo do id, do título, do Progresso, de repetindo)
_ELEMENTOS_XML = (
    ('anime', 'anime', 'series_animedb_id', 'series_title', 'my_watched_episodes', 'my_rewatching'),
    ('manga', 'manga', 'manga_mangadb_id', 'manga_title', 'my_read_chapters', 'my_rereading'),
)


def ler_xml(conteudo: bytes) -> list[ItemDeOrigem]:
    """Os itens do XML exportado (sem `catalogo`). Levanta ArquivoInvalido."""
    if len(conteudo) > LIMITE_XML:
        raise ArquivoGrandeDemais(MENSAGEM_GRANDE)
    xml = _descomprimir(conteudo)
    try:
        raiz = fromstring(xml, forbid_dtd=True)
    except (ParseError, DefusedXmlException, ValueError) as exc:
        raise ArquivoInvalido(MENSAGEM_ARQUIVO) from exc
    if raiz.tag != 'myanimelist':
        raise ArquivoInvalido(MENSAGEM_ARQUIVO)

    itens = []
    for elemento, tipo, campo_id, campo_titulo, campo_progresso, campo_repetindo in _ELEMENTOS_XML:
        for no in raiz.iter(elemento):
            id_mal = _inteiro(_texto(no, campo_id))
            if not id_mal or id_mal < 0:
                continue
            itens.append(_item(
                id_mal, tipo, _texto(no, campo_titulo), _texto(no, 'my_status'), _texto(no, campo_progresso),
                _texto(no, 'my_score'), _texto(no, 'my_start_date'), _texto(no, 'my_finish_date'),
                repetindo=_texto(no, campo_repetindo) in ('1', 'YES', 'yes'),
            ))
    return itens


# ============================================
# Plataforma
# ============================================

class MAL:
    """Plataforma `mal` (ver `integracoes.plataforma.Plataforma`), mais `itens_do_xml`."""

    nome = 'mal'
    rotulo = 'MyAnimeList'

    def __init__(self, sessao=None, sessao_anilist=None):
        """Sessões HTTP do MAL e do AniList (os testes passam falsas); sem elas, cria por chamada."""
        self._sessao = sessao
        self._sessao_anilist = sessao_anilist

    def disponivel(self) -> bool:
        return bool(_chave())

    def _pedir(self, sessao, url: str, params: dict | None) -> dict:
        try:
            resposta = sessao.get(url, params=params, headers={'X-MAL-CLIENT-ID': _chave()}, timeout=30)
        except Exception as exc:
            logger.warning('MyAnimeList sem resposta: %s', _sem_chave(str(exc)))
            raise OrigemIndisponivel(MENSAGEM_INDISPONIVEL) from exc
        if resposta.status_code == 404:
            raise PerfilNaoEncontrado(MENSAGEM_NAO_ENCONTRADO)
        if resposta.status_code == 403:
            raise PerfilPrivado(MENSAGEM_PRIVADO)
        corpo = None
        if resposta.status_code == 200:
            try:
                corpo = resposta.json()
            except ValueError:
                corpo = None
        if not isinstance(corpo, dict):
            logger.warning('MyAnimeList respondeu %s', resposta.status_code)
            raise OrigemIndisponivel(MENSAGEM_INDISPONIVEL)
        return corpo

    def _paginas(self, nome: str, lista: str, limite: int):
        if not _chave():
            raise PlataformaIndisponivel(MENSAGEM_SEM_CHAVE)
        sessao = self._sessao or criar_sessao_http(total_retries=1, backoff_factor=0.5)
        try:
            url: str | None = f'{API_URL}/users/{nome}/{lista}'
            params: dict | None = {'fields': 'list_status', 'limit': limite, 'nsfw': 'true'}
            while url:
                corpo = self._pedir(sessao, url, params)
                yield corpo.get('data') or []
                proxima = (corpo.get('paging') or {}).get('next')
                # `next` já traz a query inteira; só segue dentro da API do MAL.
                url = proxima if isinstance(proxima, str) and proxima.startswith(f'{API_URL}/') else None
                params = None
        finally:
            if self._sessao is None:
                sessao.close()

    def conectar(self, identificador: str) -> Conta:
        if not _chave():
            raise PlataformaIndisponivel(MENSAGEM_SEM_CHAVE)
        nome = _nome_de(identificador)
        next(self._paginas(nome, 'animelist', 1), None)
        return Conta(nome, nome)

    def ler(self, conta: Conta) -> list[ItemDeOrigem]:
        itens = []
        for lista, tipo, campo_progresso, campo_repetindo in _LISTAS:
            vistos: set[int] = set()
            for pagina in self._paginas(conta.identificador, lista, POR_PAGINA):
                for entrada in pagina:
                    no, status = entrada.get('node') or {}, entrada.get('list_status') or {}
                    id_mal = _inteiro(no.get('id'))
                    if not id_mal or id_mal in vistos:
                        continue
                    vistos.add(id_mal)
                    itens.append(_item(
                        id_mal, tipo, no.get('title'), status.get('status'), status.get(campo_progresso),
                        status.get('score'), status.get('start_date'), status.get('finish_date'),
                        repetindo=bool(status.get(campo_repetindo)),
                    ))
        return casar(itens, self._sessao_anilist)

    def itens_do_xml(self, conteudo: bytes) -> list[ItemDeOrigem]:
        """Os itens do XML exportado, já casados. Não precisa da chave do MAL."""
        return casar(ler_xml(conteudo), self._sessao_anilist)
