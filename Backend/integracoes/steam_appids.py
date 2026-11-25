"""Persistência do casamento `appid` da Steam → Mídia (`steam_appids`, migrações 0008 e 0009).

Positivo tem `id_midia`; negativo (nem o RAWG nem a loja da Steam têm o jogo) fica com
`id_midia` nulo e só é buscado de novo depois de `RETENTAR_NEGATIVO_DIAS`. Ignorado (a loja diz
que não é jogo: software, DLC, trilha) não é buscado de novo nem aparece em "Não encontrados".
Mídia apagada vira negativo pelo `ON DELETE SET NULL`.
"""
from __future__ import annotations

from typing import Any

from banco import consultar, executar

#: Dias até um negativo ser buscado de novo (o RAWG e a loja ganham jogos com o tempo).
RETENTAR_NEGATIVO_DIAS = 30


def ler(appids: list[int]) -> dict[int, dict[str, Any]]:
    """Os casamentos já gravados, por appid: `id_midia` (None no negativo), `ignorado` e `vencido`."""
    if not appids:
        return {}
    linhas = consultar(
        f"""
        SELECT appid, id_midia::text AS id_midia, ignorado,
               tentado_em < now() - interval '{RETENTAR_NEGATIVO_DIAS} days' AS vencido
        FROM steam_appids WHERE appid = ANY(%s)
        """,
        (appids,),
    )
    return {linha['appid']: linha for linha in linhas}


def gravar(appid: int, id_midia: str | None, nome: str, *, ignorado: bool = False) -> None:
    executar(
        """
        INSERT INTO steam_appids (appid, id_midia, nome, ignorado) VALUES (%s, %s, %s, %s)
        ON CONFLICT (appid) DO UPDATE SET id_midia = EXCLUDED.id_midia, nome = EXCLUDED.nome,
            ignorado = EXCLUDED.ignorado, tentado_em = now()
        """,
        (appid, id_midia, nome, ignorado),
    )


def ignorar(appid: int, nome: str) -> None:
    """A appid não é jogo: fora de "Não encontrados" de vez."""
    gravar(appid, None, nome, ignorado=True)


def marcar_na_midia(appid: int, id_midia: str) -> None:
    """A Mídia que o RAWG casou guarda a appid (`jogos.steam_appid`), se ainda não tem e ela está livre."""
    executar(
        'UPDATE jogos SET steam_appid = %s WHERE id_midia = %s AND steam_appid IS NULL '
        'AND NOT EXISTS (SELECT 1 FROM jogos WHERE steam_appid = %s)',
        (appid, id_midia, appid),
    )
