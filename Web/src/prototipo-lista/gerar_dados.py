#!/usr/bin/env python3
# PROTÓTIPO (ticket 39): gera dados.json com Mídias reais do Catálogo de produção (só
# leitura, 6 requisições com pausa) e Itens de Lista sintéticos com semente fixa.
# Uso: python3 Web/src/prototipo-lista/gerar_dados.py
import json
import math
import random
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = "https://medialist-five.vercel.app/api/midias"
QUANTOS = {"jogo": 120, "anime": 80, "manga": 30}
DESTINO = Path(__file__).with_name("dados.json")
CAMPOS = [
    "id_midia", "tipo", "titulo_original", "titulo_ingles", "titulo_portugues", "poster_url",
    "banner_url", "generos_lista", "status_anime", "status_manga", "status_jogo",
    "numero_episodios", "numero_capitulos", "data_lancamento", "nota_fonte",
    "estudio", "autor", "desenvolvedor",
]
ROTULOS = {
    "anime": {"planejado": "planejado", "em_progresso": "assistindo", "pausado": "pausado", "abandonado": "abandonado", "concluido": "completo"},
    "manga": {"planejado": "planejado", "em_progresso": "lendo", "pausado": "pausado", "abandonado": "abandonado", "concluido": "lido"},
    "jogo": {"planejado": "na_fila", "em_progresso": "jogando", "pausado": "pausado", "abandonado": "abandonado", "concluido": "zerado", "platinado": "platinado"},
}
# Distribuição de Status: uma Lista de anos, com muito Concluído e um backlog grande.
PESOS = {
    "anime": {"concluido": 46, "planejado": 24, "em_progresso": 10, "pausado": 8, "abandonado": 12},
    "manga": {"concluido": 30, "planejado": 20, "em_progresso": 30, "pausado": 10, "abandonado": 10},
    "jogo": {"concluido": 34, "platinado": 8, "planejado": 26, "em_progresso": 10, "pausado": 10, "abandonado": 12},
}


def baixar(tipo: str) -> list[dict]:
    midias: list[dict] = []
    pagina = 1
    while len(midias) < QUANTOS[tipo]:
        url = f"{API}?tipo={tipo}&por_pagina=50&pagina={pagina}"
        with urllib.request.urlopen(url, timeout=30) as resposta:
            itens = json.load(resposta)["itens"]
        time.sleep(1.5)
        if not itens:
            break
        midias += [m for m in itens if m.get("poster_url")]
        pagina += 1
    return [{c: m.get(c) for c in CAMPOS} for m in midias[: QUANTOS[tipo]]]


def escolher(rng: random.Random, pesos: dict[str, int]) -> str:
    return rng.choices(list(pesos), weights=list(pesos.values()))[0]


def nota(rng: random.Random, estado: str) -> float | None:
    if estado == "planejado" or rng.random() < 0.12:
        return None
    base = {"abandonado": 4.8, "pausado": 6.8, "em_progresso": 7.4}.get(estado, 7.8)
    valor = max(1.0, min(10.0, rng.gauss(base, 1.4)))
    # Metade das pessoas dá nota inteira; o resto usa meio ponto.
    return float(round(valor)) if rng.random() < 0.5 else round(valor * 2) / 2


def horas(rng: random.Random, estado: str) -> float | None:
    if estado == "planejado":
        rng.random()  # mantém a sequência da semente
        return None
    # Log-uniforme de 0,5 h a 900 h, puxado para cima em Concluído e Platinado.
    minimo, maximo = {"platinado": (40, 900), "concluido": (6, 320), "abandonado": (0.5, 30)}.get(estado, (1, 160))
    valor = math.exp(rng.uniform(math.log(minimo), math.log(maximo)))
    return round(valor * 2) / 2 if valor < 10 else float(round(valor))


def progresso(rng: random.Random, estado: str, total: int | None) -> int:
    if estado == "planejado":
        return 0
    if estado == "concluido" and total:
        return total
    teto = total - 1 if total else rng.choice([40, 120, 300])
    return rng.randint(1, max(1, teto))


def main() -> None:
    rng = random.Random(39)
    agora = datetime(2026, 11, 24, 20, 0, tzinfo=timezone.utc)
    itens = []
    for tipo in QUANTOS:
        for i, m in enumerate(baixar(tipo)):
            estado = escolher(rng, PESOS[tipo])
            total = m["numero_episodios"] if tipo == "anime" else m["numero_capitulos"] if tipo == "manga" else None
            adicao = agora - timedelta(days=rng.uniform(3, 2400), minutes=rng.randint(0, 1440))
            atualizacao = adicao + (agora - adicao) * rng.random() ** 2.5
            itens.append({
                **m,
                "id_lista": f"{tipo[0]}{i:03d}",
                "status_consumo": ROTULOS[tipo][estado],
                "progresso_atual": horas(rng, estado) if tipo == "jogo" else progresso(rng, estado, total),
                "nota_usuario": nota(rng, estado),
                "favorito": rng.random() < 0.08,
                "recontagem": rng.choice([1, 1, 2, 3]) if estado == "concluido" and rng.random() < 0.08 else 0,
                "data_adicao": adicao.isoformat(timespec="seconds"),
                "data_atualizacao": atualizacao.isoformat(timespec="seconds"),
            })
    DESTINO.write_text(json.dumps(itens, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(itens)} Itens em {DESTINO}")


if __name__ == "__main__":
    main()
