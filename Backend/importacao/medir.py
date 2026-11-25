"""
Medição da Importação: tempo e consultas ao banco por item, por Tipo de mídia.

Roda os importadores de verdade (`importar_animes`, `importar_mangas`, `importar_jogos`, com
os rate limiters), mas com as fontes gravadas: respostas reais do AniList e do RAWG em
`tests/fixtures/importacao/`, servidas por uma sessão HTTP falsa (nada de rede). O banco é o de
`DATABASE_URL` (ou das `DB_*`); para imitar a Neon, aponte para um proxy com latência, como um
toxiproxy com um toxic `latency` em cada sentido.

Cada rodada parte do mesmo estado: apaga antes as Mídias das fixtures (pela chave da fonte) e
recomeça o cursor do início (`do_inicio`). Por isso recusa URL da Neon.

    DATABASE_URL=postgresql://...@127.0.0.1:5662/medialist_db python -m importacao.medir --paginas 2

Página além das gravadas repete as gravadas em ciclo (a segunda volta é reimportação).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures' / 'importacao'


class Resposta:
    def __init__(self, corpo, status_code: int = 200):
        self._corpo = corpo
        self.status_code = status_code

    def json(self):
        return self._corpo

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f'HTTP {self.status_code}')


class FontesGravadas:
    """Sessão HTTP falsa: `post` do AniList e `get` do RAWG pelas respostas gravadas."""

    def __init__(self, pasta: Path = FIXTURES):
        def ler(nome):
            return json.loads((pasta / nome).read_text(encoding='utf-8'))

        def paginas(prefixo):
            arquivos = sorted(pasta.glob(f'{prefixo}_*.json'), key=lambda p: int(p.stem.split('_')[-1]))
            return [ler(p.name) for p in arquivos]

        self.anilist = {'ANIME': paginas('anilist_anime'), 'MANGA': paginas('anilist_manga')}
        self.rawg = paginas('rawg_games')
        self.detalhes = ler('rawg_detalhes.json')

    @staticmethod
    def _ciclo(lista, pagina: int):
        return lista[(pagina - 1) % len(lista)]

    def post(self, url, json=None, timeout=None):
        variaveis = json['variables']
        return Resposta(self._ciclo(self.anilist[variaveis['tipo']], variaveis['page']))

    def get(self, url, params=None, timeout=None):
        detalhe = re.search(r'/games/([^/?]+)$', url)
        if detalhe:
            achado = self.detalhes.get(detalhe.group(1))
            return Resposta(achado, 200 if achado else 404)
        return Resposta(self._ciclo(self.rawg, int((params or {}).get('page', 1))))

    def close(self):
        pass

    def chaves(self) -> dict[str, list]:
        """Chaves da fonte de todas as Mídias gravadas, por Tipo."""
        return {
            'anime': sorted({m['id'] for p in self.anilist['ANIME'] for m in p['data']['Page']['media']}),
            'manga': sorted({m['id'] for p in self.anilist['MANGA'] for m in p['data']['Page']['media']}),
            'jogo': sorted({j['slug'] for p in self.rawg for j in p['results']}),
        }


@contextmanager
def fontes_falsas(fontes: FontesGravadas):
    """Troca as sessões HTTP dos importadores pela `fontes` (e dá uma RAWG_API_KEY falsa)."""
    from importacao import importar_animes, importar_jogos, importar_mangas

    trocas = [
        (importar_animes, 'criar_sessao_http', lambda **_: fontes),
        (importar_mangas, 'criar_sessao_http', lambda **_: fontes),
        (importar_jogos, 'criar_sessao_http', lambda **_: fontes),
        (importar_jogos, '_obter_sessao_rawg_worker', lambda: fontes),
        (importar_jogos, 'RAWG_API_KEY', 'chave-falsa-da-medicao'),
    ]
    antes = [(modulo, nome, getattr(modulo, nome)) for modulo, nome, _ in trocas]
    try:
        for modulo, nome, valor in trocas:
            setattr(modulo, nome, valor)
        yield fontes
    finally:
        for modulo, nome, valor in antes:
            setattr(modulo, nome, valor)


class ContadorDeConsultas:
    """Conta os comandos mandados ao banco: os do cursor e os de transação (BEGIN, COMMIT...)."""

    def __init__(self):
        self.total = 0

    @contextmanager
    def ligado(self):
        import psycopg
        from psycopg import _connection_base

        execute, exec_command = psycopg.Cursor.execute, _connection_base.BaseConnection._exec_command
        contador = self

        def execute_contado(cur, *args, **kwargs):
            contador.total += 1
            return execute(cur, *args, **kwargs)

        def exec_command_contado(conn, *args, **kwargs):
            contador.total += 1
            return (yield from exec_command(conn, *args, **kwargs))

        psycopg.Cursor.execute = execute_contado
        _connection_base.BaseConnection._exec_command = exec_command_contado
        try:
            yield self
        finally:
            psycopg.Cursor.execute = execute
            _connection_base.BaseConnection._exec_command = exec_command


def apagar_midias(chaves: dict[str, list]) -> None:
    """Apaga as Mídias das chaves (cascata nas tabelas do Tipo, gêneros ligados e Itens)."""
    from banco import executar

    for tipo, coluna in (('anime', 'anilist_id'), ('manga', 'anilist_id'), ('jogo', 'rawg_slug')):
        tabela = {'anime': 'animes', 'manga': 'mangas', 'jogo': 'jogos'}[tipo]
        executar(
            f'DELETE FROM midias WHERE id_midia IN (SELECT id_midia FROM {tabela} WHERE {coluna} = ANY(%s))',
            (chaves[tipo],),
        )


def importadores(paginas: int, workers: int) -> dict:
    from importacao.importar_animes import importar_animes
    from importacao.importar_jogos import importar_jogos
    from importacao.importar_mangas import importar_mangas

    return {
        # Só o crescimento, do topo: as páginas gravadas, sem a atualização das populares.
        'anime': lambda: importar_animes(paginas=paginas, paginas_atualizacao=0, do_inicio=True),
        'manga': lambda: importar_mangas(paginas=paginas, paginas_atualizacao=0, do_inicio=True),
        'jogo': lambda: importar_jogos(paginas=paginas, workers=workers, do_inicio=True),
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description='Mede a Importação com as fontes gravadas')
    parser.add_argument('--tipo', choices=['anime', 'manga', 'jogo', 'todos'], default='todos')
    parser.add_argument('--paginas', type=int, default=2)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--fixtures', type=Path, default=FIXTURES)
    args = parser.parse_args(argv)

    from config import database_url
    from importacao import utils

    if 'neon.tech' in database_url():
        print('Recusado: a medição apaga Mídias e reinicia o cursor; não rode na Neon.', file=sys.stderr)
        return 2

    fontes = FontesGravadas(args.fixtures)
    utils.ERROR_LOG_PATH = Path(tempfile.gettempdir()) / f'medir-importacao-{os.getpid()}.jsonl'
    apagar_midias(fontes.chaves())
    contador = ContadorDeConsultas()
    tipos = ['anime', 'manga', 'jogo'] if args.tipo == 'todos' else [args.tipo]

    linhas = []
    with fontes_falsas(fontes):
        funcoes = importadores(args.paginas, args.workers)
        for tipo in tipos:
            contador.total = 0
            inicio = time.perf_counter()
            with contador.ligado():
                stats = funcoes[tipo]()
            segundos = time.perf_counter() - inicio
            itens = stats.processados or 1
            linhas.append((tipo, stats.processados, stats.falhas, segundos, segundos / itens, contador.total / itens))

    print(f'{"tipo":<6} {"itens":>5} {"falhas":>6} {"total_s":>8} {"s/item":>7} {"consultas/item":>14}')
    for tipo, n, falhas, total, por_item, consultas in linhas:
        print(f'{tipo:<6} {n:>5} {falhas:>6} {total:>8.1f} {por_item:>7.3f} {consultas:>14.1f}')
    return 1 if any(linha[2] for linha in linhas) else 0


if __name__ == '__main__':
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    raise SystemExit(main())
