"""Rótulos de estado como lista SQL, para as consultas que contam por Estado de consumo.

O vocabulário (quais Rótulos cada estado tem em cada Tipo) mora em `schemas/estado_consumo.py`;
aqui ele só vira texto de query. Usado pelas estatísticas do perfil e pelo Catálogo.
"""
from __future__ import annotations

import re

from schemas.estado_consumo import rotulos_dos_estados


def sql_rotulos(*estados: str) -> str:
    """Rótulos desses estados em todos os Tipos, como lista SQL (`'completo', 'lido', ...`).

    Constante do código, nunca entrada do cliente: entra no texto da query como literal. O
    ValueError barra um rótulo fora de `[a-z_]`, que quebraria o literal.
    """
    rotulos = rotulos_dos_estados(*estados)
    if not all(re.fullmatch(r'[a-z_]+', rotulo) for rotulo in rotulos):
        raise ValueError(f'Rótulo de estado fora de [a-z_]: {rotulos}')
    return ', '.join(f"'{rotulo}'" for rotulo in rotulos)
