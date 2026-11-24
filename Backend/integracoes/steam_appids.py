"""Persistência do casamento `appid` da Steam → Mídia (`steam_appids`, migração 0008).

Positivo tem `id_midia`; negativo (o RAWG não tinha o jogo com a loja da Steam) fica com
`id_midia` nulo e só é buscado de novo depois de `RETENTAR_NEGATIVO_DIAS`. Mídia apagada
vira negativo pelo `ON DELETE SET NULL`.
"""
from __future__ import annotations

from typing import Any

from banco import consultar, executar

#: Dias até um negativo ser buscado de novo no RAWG (o RAWG ganha jogos e lojas com o tempo).
RETENTAR_NEGATIVO_DIAS = 30


def ler(appids: list[int]) -> dict[int, dict[str, Any]]:
    """Os casamentos já gravados, por appid: `rawg_slug` (None no negativo) e `vencido`."""
    if not appids:
        return {}
    linhas = consultar(
        f"""
        SELECT s.appid, j.rawg_slug, s.tentado_em < now() - interval '{RETENTAR_NEGATIVO_DIAS} days' AS vencido
        FROM steam_appids s LEFT JOIN jogos j ON j.id_midia = s.id_midia
        WHERE s.appid = ANY(%s)
        """,
        (appids,),
    )
    return {linha['appid']: linha for linha in linhas}


def gravar(appid: int, id_midia: str | None, nome: str) -> None:
    executar(
        """
        INSERT INTO steam_appids (appid, id_midia, nome) VALUES (%s, %s, %s)
        ON CONFLICT (appid) DO UPDATE SET id_midia = EXCLUDED.id_midia, nome = EXCLUDED.nome, tentado_em = now()
        """,
        (appid, id_midia, nome),
    )
