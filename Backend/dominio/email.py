"""Email do Usuário: a forma única com que é gravado e procurado (ticket 36 da revisão).

O teclado do celular põe maiúscula, espaço no fim ou um caractere invisível, e o Usuário
não acha a própria conta. Todo email que entra (registro, login, esqueci-senha,
`redefinir_senha.py`) passa por `normalizar_email`, e o banco tem índice único em
`lower(email)` (migração 0007).
"""
from __future__ import annotations

import unicodedata

#: Zero-width space, non-joiner, joiner, word joiner e BOM.
_INVISIVEIS = dict.fromkeys(map(ord, '\u200b\u200c\u200d\u2060\ufeff'))


def normalizar_email(email: str) -> str:
    """Sem invisíveis, espaço não separável como espaço, NFKC, sem espaços nas pontas, minúsculo."""
    sem_invisiveis = email.translate(_INVISIVEIS).replace('\u00a0', ' ')
    return unicodedata.normalize('NFKC', sem_invisiveis).strip().lower()
