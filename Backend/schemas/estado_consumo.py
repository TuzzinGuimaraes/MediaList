"""
Vocabulário de Estado de consumo e Rótulos de estado.

Ver CONTEXT.md: o Estado de consumo é abstrato e independe do Tipo de mídia; o
Rótulo de estado é o nome que esse estado recebe para um tipo específico. Um
rótulo só é válido para o tipo a que pertence — um anime nunca está `platinado`.
"""
from __future__ import annotations

PLANEJADO = 'planejado'
EM_PROGRESSO = 'em_progresso'
PAUSADO = 'pausado'
ABANDONADO = 'abandonado'
CONCLUIDO = 'concluido'
PLATINADO = 'platinado'

ESTADOS = (PLANEJADO, EM_PROGRESSO, PAUSADO, ABANDONADO, CONCLUIDO, PLATINADO)

#: Platinado é um refinamento de Concluído: todo item platinado está concluído.
ESTADOS_TERMINAIS = frozenset({CONCLUIDO, PLATINADO})

#: Rótulo de cada estado, por tipo de mídia. A ausência de uma chave significa
#: que o estado não se aplica àquele tipo (só jogo tem Platinado).
ROTULOS_POR_TIPO: dict[str, dict[str, str]] = {
    'anime': {
        PLANEJADO: 'planejado',
        EM_PROGRESSO: 'assistindo',
        PAUSADO: 'pausado',
        ABANDONADO: 'abandonado',
        CONCLUIDO: 'completo',
    },
    'manga': {
        PLANEJADO: 'planejado',
        EM_PROGRESSO: 'lendo',
        PAUSADO: 'pausado',
        ABANDONADO: 'abandonado',
        CONCLUIDO: 'lido',
    },
    'jogo': {
        PLANEJADO: 'na_fila',
        EM_PROGRESSO: 'jogando',
        PAUSADO: 'pausado',
        ABANDONADO: 'abandonado',
        CONCLUIDO: 'zerado',
        PLATINADO: 'platinado',
    },
}

TIPOS = tuple(ROTULOS_POR_TIPO)

_ROTULOS_DO_TIPO: dict[str, frozenset[str]] = {
    tipo: frozenset(rotulos.values()) for tipo, rotulos in ROTULOS_POR_TIPO.items()
}

_ESTADO_POR_ROTULO: dict[str, dict[str, str]] = {
    tipo: {rotulo: estado for estado, rotulo in rotulos.items()}
    for tipo, rotulos in ROTULOS_POR_TIPO.items()
}

#: União de todos os rótulos conhecidos. Usada quando o tipo da mídia não é
#: conhecido no ponto da validação; prefira sempre a checagem por tipo.
ROTULOS_VALIDOS: frozenset[str] = frozenset().union(*_ROTULOS_DO_TIPO.values())


def rotulos_do_tipo(tipo: str | None) -> frozenset[str]:
    """Rótulos aceitos para um tipo. Tipo desconhecido devolve a união."""
    if tipo is None:
        return ROTULOS_VALIDOS
    return _ROTULOS_DO_TIPO.get(tipo, ROTULOS_VALIDOS)


def rotulo_valido(rotulo: str | None, tipo: str | None) -> bool:
    """Diz se o rótulo se aplica a uma mídia daquele tipo."""
    if rotulo is None:
        return False
    return rotulo in rotulos_do_tipo(tipo)


def estado_de(rotulo: str | None, tipo: str | None = None) -> str | None:
    """Estado de consumo abstrato por trás de um rótulo, ou None se não houver."""
    if rotulo is None:
        return None

    if tipo is not None and tipo in _ESTADO_POR_ROTULO:
        return _ESTADO_POR_ROTULO[tipo].get(rotulo)

    for mapa in _ESTADO_POR_ROTULO.values():
        if rotulo in mapa:
            return mapa[rotulo]
    return None


def rotulo_para(estado: str, tipo: str) -> str | None:
    """Rótulo de um estado num tipo, ou None se o estado não se aplica ao tipo."""
    return ROTULOS_POR_TIPO.get(tipo, {}).get(estado)


def e_terminal(rotulo: str | None, tipo: str | None = None) -> bool:
    """Diz se o rótulo representa um estado terminal (Concluído ou Platinado)."""
    return estado_de(rotulo, tipo) in ESTADOS_TERMINAIS


def erro_de_rotulo(rotulo: str | None, tipo: str | None) -> str | None:
    """Mensagem de erro quando o rótulo não vale para o tipo, senão None."""
    if rotulo is None or rotulo_valido(rotulo, tipo):
        return None

    validos = ', '.join(sorted(rotulos_do_tipo(tipo)))
    return f"Status '{rotulo}' não se aplica a mídia do tipo '{tipo}'. Válidos: {validos}"
