"""AniList: lista pública pelo nome de usuário, via `MediaListCollection` (GraphQL, sem OAuth).

Uma chamada por Tipo (ANIME, MANGA) em chunks de 500, já trazendo a obra inteira nos campos
que a Importação grava (`importacao.anilist.CAMPOS_MEDIA`), para importar sob demanda sem
outra ida ao AniList. Nota em `score(format: POINT_10_DECIMAL)`; listas personalizadas
ficam de fora (repetem entradas das listas de status).

Erros do AniList (vêm em `errors`, com `status`): "User not found" (404) é perfil
inexistente; "Private User" é perfil privado; o resto, origem indisponível.
"""
from __future__ import annotations

import logging
import re

from importacao.anilist import CAMPOS_MEDIA
from importacao.config import ANILIST_URL
from integracoes import prazo
from integracoes.mapeamento import estado_da_origem, nota_anilist
from integracoes.plataforma import (
    MAXIMO_ITENS,
    Conta,
    ItemDeOrigem,
    ListaGrandeDemais,
    OrigemIndisponivel,
    PerfilNaoEncontrado,
    PerfilPrivado,
    RefCatalogo,
)

logger = logging.getLogger(__name__)

POR_CHUNK = 500
#: Chunks lidos por Tipo, no máximo (o teto de itens, `MAXIMO_ITENS`, vale para os dois Tipos juntos).
MAXIMO_CHUNKS = -(-MAXIMO_ITENS // POR_CHUNK)
TIPOS = (('ANIME', 'anime'), ('MANGA', 'manga'))

_NOME = re.compile(r'^[A-Za-z0-9_-]{2,40}$')
_URL_PERFIL = re.compile(r'anilist\.co/user/([^/?#\s]+)', re.IGNORECASE)

MENSAGEM_PRIVADO = (
    'O perfil do AniList é privado. Nas configurações do AniList, deixe o perfil público '
    'e tente de novo.'
)
MENSAGEM_NAO_ENCONTRADO = 'Nenhum perfil do AniList com esse nome de usuário.'
MENSAGEM_INDISPONIVEL = 'O AniList não respondeu agora. Tente de novo em alguns minutos.'

_CONSULTA_CONTA = """
query ($usuario: String, $tipo: MediaType, $chunk: Int, $porChunk: Int) {
  MediaListCollection(userName: $usuario, type: $tipo, chunk: $chunk, perChunk: $porChunk) {
    user { id name }
    hasNextChunk
  }
}
"""

_CONSULTA_LISTA = """
query ($usuario: String, $tipo: MediaType, $chunk: Int, $porChunk: Int) {
  MediaListCollection(userName: $usuario, type: $tipo, chunk: $chunk, perChunk: $porChunk) {
    user { id name }
    hasNextChunk
    lists {
      isCustomList
      entries {
        status
        score(format: POINT_10_DECIMAL)
        progress
        startedAt { year month day }
        completedAt { year month day }
        media {
          idMal
          siteUrl""" + CAMPOS_MEDIA + """        }
      }
    }
  }
}
"""


def _nome_de(identificador: str) -> str:
    texto = (identificador or '').strip()
    url = _URL_PERFIL.search(texto)
    if url:
        texto = url.group(1)
    if not _NOME.match(texto):
        raise PerfilNaoEncontrado(MENSAGEM_NAO_ENCONTRADO)
    return texto


def _data(parcial: dict | None) -> str | None:
    """`YYYY-MM-DD` só com a data completa: data parcial não vira um dia inventado."""
    if not parcial or not all(parcial.get(c) for c in ('year', 'month', 'day')):
        return None
    return f"{parcial['year']:04d}-{parcial['month']:02d}-{parcial['day']:02d}"


def _titulo(media: dict) -> str:
    titulo = media.get('title') or {}
    return titulo.get('english') or titulo.get('romaji') or titulo.get('native') or f"AniList {media.get('id')}"


def item_de_entrada(entrada: dict, tipo: str) -> ItemDeOrigem:
    """Uma entrada de `MediaListCollection` como ItemDeOrigem."""
    media = entrada['media']
    id_anilist = str(media['id'])
    return ItemDeOrigem(
        origem_id=id_anilist,
        tipo=tipo,
        titulo=_titulo(media),
        link=media.get('siteUrl') or f'https://anilist.co/{tipo}/{id_anilist}',
        status=estado_da_origem(entrada.get('status')),
        progresso=entrada.get('progress'),
        nota=nota_anilist(entrada.get('score')),
        data_inicio=_data(entrada.get('startedAt')),
        data_conclusao=_data(entrada.get('completedAt')),
        catalogo=RefCatalogo('anilist', id_anilist, media),
    )


class AniList:
    """Plataforma `anilist` (ver `integracoes.plataforma.Plataforma`)."""

    nome = 'anilist'
    rotulo = 'AniList'

    def __init__(self, sessao=None):
        """`sessao` é um `requests.Session` (os testes passam uma falsa); sem ela, cria uma por chamada."""
        self._sessao = sessao

    def disponivel(self) -> bool:
        return True

    def _consultar(self, consulta: str, variaveis: dict) -> dict:
        prazo.conferir()
        sessao = self._sessao or prazo.sessao_http(1, 0.5)
        try:
            resposta = sessao.post(
                ANILIST_URL, json={'query': consulta, 'variables': variaveis}, timeout=prazo.timeout(30),
            )
            corpo = resposta.json()
        except Exception as exc:
            logger.warning('AniList sem resposta: %s', exc)
            raise OrigemIndisponivel(MENSAGEM_INDISPONIVEL) from exc
        finally:
            if self._sessao is None:
                sessao.close()

        for erro in (corpo or {}).get('errors') or []:
            mensagem = str(erro.get('message') or '')
            if 'private' in mensagem.lower():
                raise PerfilPrivado(MENSAGEM_PRIVADO)
            if erro.get('status') == 404 or resposta.status_code == 404:
                raise PerfilNaoEncontrado(MENSAGEM_NAO_ENCONTRADO)
        colecao = ((corpo or {}).get('data') or {}).get('MediaListCollection')
        if resposta.status_code != 200 or colecao is None:
            logger.warning('AniList respondeu %s: %s', resposta.status_code, (corpo or {}).get('errors'))
            raise OrigemIndisponivel(MENSAGEM_INDISPONIVEL)
        return colecao

    def conectar(self, identificador: str) -> Conta:
        nome = _nome_de(identificador)
        colecao = self._consultar(_CONSULTA_CONTA, {'usuario': nome, 'tipo': 'ANIME', 'chunk': 1, 'porChunk': 1})
        nome_real = (colecao.get('user') or {}).get('name') or nome
        return Conta(nome_real, nome_real)

    def ler(self, conta: Conta) -> list[ItemDeOrigem]:
        itens: list[ItemDeOrigem] = []
        for tipo_anilist, tipo in TIPOS:
            vistos: set[str] = set()
            chunk = 1
            while True:
                colecao = self._consultar(_CONSULTA_LISTA, {
                    'usuario': conta.identificador, 'tipo': tipo_anilist, 'chunk': chunk, 'porChunk': POR_CHUNK,
                })
                for lista in colecao.get('lists') or []:
                    if lista.get('isCustomList'):
                        continue
                    for entrada in lista.get('entries') or []:
                        item = item_de_entrada(entrada, tipo)
                        if item.origem_id not in vistos:
                            vistos.add(item.origem_id)
                            itens.append(item)
                if len(itens) > MAXIMO_ITENS:
                    raise ListaGrandeDemais()
                if not colecao.get('hasNextChunk'):
                    break
                if chunk >= MAXIMO_CHUNKS:
                    raise ListaGrandeDemais()
                chunk += 1
        return itens
