"""Push das Notícias pelo Expo Push Service (spec `noticias-avisos`, Q129).

Publicar uma Notícia avisa, por push, os aparelhos (`push_tokens`) dos Usuários ativos com
`avisar_noticias`, menos o autor. O envio é **síncrono, antes da resposta**: na Vercel o que
roda depois da resposta pode ser congelado e nunca terminar (ADR-0013). Para não atrasar a
publicação, o envio tem prazo total curto (`PRAZO_SEGUNDOS`) e timeout curto por requisição,
sem retries; o que não couber no prazo fica sem aviso (a Notificação já está gravada).

- Lotes de até 100 mensagens por requisição (limite do Expo).
- Ticket `DeviceNotRegistered` apaga o token: o app foi desinstalado ou o token trocou.
- `EXPO_ACCESS_TOKEN` (opcional) vai como Bearer, se o projeto exigir push seguro.
- Qualquer falha vai só para o log, com contagens e códigos, nunca os tokens; nada levanta.

O cliente HTTP vem de `criar_cliente` (os testes trocam): qualquer objeto com
`post(url, json=, headers=, timeout=)`.
"""
from __future__ import annotations

import logging
import os
import re
import time
from collections import Counter

import requests

from banco import consultar, executar

logger = logging.getLogger(__name__)

URL_EXPO = 'https://exp.host/--/api/v2/push/send'
#: Mensagens por requisição (o máximo do Expo).
LOTE = 100
#: Prazo total do envio de uma Notícia, em segundos.
PRAZO_SEGUNDOS = 8.0
#: Timeout de cada requisição ao Expo, em segundos.
TIMEOUT_SEGUNDOS = 3.0
#: Tamanho máximo do corpo do push.
CORPO_MAX = 120
CORPO_PADRAO = 'Nova Notícia no MediaList'
#: Token Expo de um aparelho (`getExpoPushTokenAsync`).
FORMATO_TOKEN = re.compile(r'(?:ExponentPushToken|ExpoPushToken)\[[^\[\]\s]+\]')

#: Relógio do prazo (os testes trocam).
relogio = time.monotonic

TOKENS_A_AVISAR = """
    SELECT pt.token
    FROM push_tokens pt
    JOIN usuarios u ON u.id_usuario = pt.id_usuario
    WHERE u.ativo AND u.avisar_noticias AND u.id_usuario <> %s
"""


def criar_cliente():
    """Sessão HTTP sem retries: o prazo é curto e cada retry gastaria o que sobra."""
    return requests.Session()


def cabecalhos() -> dict[str, str]:
    cabecalho = {'Accept': 'application/json', 'Content-Type': 'application/json'}
    access_token = os.getenv('EXPO_ACCESS_TOKEN')
    if access_token:
        cabecalho['Authorization'] = f'Bearer {access_token}'
    return cabecalho


def _corpo(conteudo: str) -> str:
    texto = ' '.join((conteudo or '').split())
    if not texto:
        return CORPO_PADRAO
    if len(texto) <= CORPO_MAX:
        return texto
    return texto[:CORPO_MAX - 1].rstrip() + '…'


def mensagens_da_noticia(tokens, id_noticia, titulo, conteudo) -> list[dict]:
    """Uma mensagem por token; tocar no push abre a Notícia (`data`)."""
    corpo = _corpo(conteudo)
    return [
        {
            'to': token,
            'title': titulo,
            'body': corpo,
            'data': {'tipo': 'noticia', 'id_noticia': str(id_noticia)},
            'sound': 'default',
            'channelId': 'default',
        }
        for token in tokens
    ]


def _tickets(resposta, tamanho) -> list | None:
    """Os tickets do lote, na ordem das mensagens; None (e log) se a resposta não os traz."""
    try:
        corpo = resposta.json()
    except ValueError:
        corpo = None
    if resposta.status_code != 200:
        erros = corpo.get('errors') if isinstance(corpo, dict) else None
        codigos = [e.get('code') for e in erros if isinstance(e, dict)] if isinstance(erros, list) else []
        logger.warning('Push: Expo respondeu %s (%s)', resposta.status_code, ', '.join(map(str, codigos)) or '-')
        return None
    tickets = corpo.get('data') if isinstance(corpo, dict) else None
    if not isinstance(tickets, list) or len(tickets) != tamanho:
        logger.warning('Push: resposta do Expo sem os tickets do lote')
        return None
    return tickets


def enviar(mensagens: list[dict], cliente, *, prazo: float = PRAZO_SEGUNDOS) -> list[str]:
    """Envia em lotes dentro do prazo; devolve os tokens com `DeviceNotRegistered`."""
    fim = relogio() + prazo
    invalidos: list[str] = []
    erros: Counter[str] = Counter()
    for inicio in range(0, len(mensagens), LOTE):
        sobra = fim - relogio()
        if sobra <= 0:
            logger.warning('Push: prazo de %ss acabou; %d mensagens sem envio', prazo, len(mensagens) - inicio)
            break
        lote = mensagens[inicio:inicio + LOTE]
        try:
            resposta = cliente.post(URL_EXPO, json=lote, headers=cabecalhos(), timeout=min(TIMEOUT_SEGUNDOS, sobra))
        except requests.RequestException as erro:
            logger.warning('Push: lote de %d mensagens falhou (%s)', len(lote), type(erro).__name__)
            continue
        tickets = _tickets(resposta, len(lote))
        if tickets is None:
            continue
        for mensagem, ticket in zip(lote, tickets, strict=True):
            if not isinstance(ticket, dict) or ticket.get('status') == 'ok':
                continue
            detalhes = ticket.get('details')
            codigo = (detalhes.get('error') if isinstance(detalhes, dict) else None) or 'desconhecido'
            if codigo == 'DeviceNotRegistered':
                invalidos.append(mensagem['to'])
            else:
                erros[codigo] += 1
    if erros:
        logger.warning('Push: tickets com erro: %s', dict(erros))
    return invalidos


def avisar_noticia(id_noticia, titulo: str, conteudo: str, id_autor) -> None:
    """Avisa por push quem quer ser avisado da Notícia. Nunca levanta: falha vai para o log."""
    try:
        tokens = [linha['token'] for linha in consultar(TOKENS_A_AVISAR, (id_autor,))]
        if not tokens:
            return
        cliente = criar_cliente()
        try:
            invalidos = enviar(mensagens_da_noticia(tokens, id_noticia, titulo, conteudo), cliente)
        finally:
            fechar = getattr(cliente, 'close', None)
            if fechar:
                fechar()
        if invalidos:
            executar('DELETE FROM push_tokens WHERE token = ANY(%s)', (invalidos,))
            logger.info('Push: %d tokens não registrados apagados', len(invalidos))
    except Exception:
        logger.warning('Push da Notícia %s falhou', id_noticia, exc_info=True)
