"""
Título de uma Mídia em SQL (CONTEXT.md: Título): a regra num lugar só para o backend.

O título exibido é o inglês, senão o romanizado, senão o original; título vazio conta como
ausente. É a mesma ordem do `tituloDaMidia` do `dominio/` (web e app). Push, Notificações,
moderação, Vínculos, Relações e as ordens alfabéticas usam `titulo_exibido`; a busca do
Catálogo procura nos três (`COLUNAS_TITULO`) com `sem_caixa_nem_acento`.
"""
from __future__ import annotations

import unicodedata

#: Os títulos de uma Mídia em `midias`, na ordem em que um vira o exibido.
COLUNAS_TITULO = ('titulo_ingles', 'titulo_romaji', 'titulo_original')

# Letras com acento ou mácron (o romaji usa ō, ū) e a letra sem eles, maiúsculas e minúsculas:
# o `lower` do banco pode só baixar ASCII, conforme o locale.
_COM_ACENTO = 'ÁÀÂÃÄÅĀÉÈÊËĒÍÌÎÏĪÓÒÔÕÖŌÚÙÛÜŪÇÑÝáàâãäåāéèêëēíìîïīóòôõöōúùûüūçñýÿ'
_SEM_ACENTO = ''.join(unicodedata.normalize('NFD', c)[0].lower() for c in _COM_ACENTO)


def titulo_exibido(midia: str = 'm') -> str:
    """SQL do título exibido da Mídia de apelido `midia`; NULL só se ela não existe (LEFT JOIN)."""
    *preferidos, original = COLUNAS_TITULO
    return 'COALESCE(' + ', '.join(f"NULLIF({midia}.{c}, '')" for c in preferidos) + f', {midia}.{original})'


def sem_caixa_nem_acento(expressao: str) -> str:
    """SQL de `expressao` em minúsculas e sem acento, para comparar textos na busca."""
    return f"translate(lower({expressao}), '{_COM_ACENTO}', '{_SEM_ACENTO}')"
