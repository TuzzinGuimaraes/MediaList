"""
Entrypoint dos importadores.
"""
from __future__ import annotations

import argparse
import sys

from importacao.importar_animes import importar_animes
from importacao.importar_jogos import importar_jogos
from importacao.importar_mangas import importar_mangas
from importacao.importar_musicas import importar_musicas_por_lista
from importacao.utils import ImportStats, logger, registrar_falha_importacao


def executar_importacao(tipo_midia: str, origem: str, funcao, *args, **kwargs) -> tuple[ImportStats, bool]:
    """Executa uma importação isolando falhas fatais por etapa."""
    try:
        resultado = funcao(*args, **kwargs)
        return resultado, False
    except Exception as exc:
        registrar_falha_importacao(
            tipo_midia=tipo_midia,
            origem=origem,
            exc=exc,
            identificador='execucao',
            titulo=f'importacao_{tipo_midia}',
            extra={'etapa': 'execucao'},
        )
        logger.exception('Falha fatal na importação de %s.', tipo_midia)
        stats = ImportStats(tipo_midia=tipo_midia, origem=origem)
        stats.registrar_falha()
        return stats, True


def main():
    parser = argparse.ArgumentParser(description='Importador de mídias para MediaList DB')
    parser.add_argument('--tipo', choices=['anime', 'manga', 'jogo', 'musica', 'todos'], default='todos')
    parser.add_argument('--paginas', type=int, default=20, help='Número de páginas a importar')
    parser.add_argument('--seed-file', default='artistas_seed.txt', help='Arquivo de artistas para músicas')
    parser.add_argument('--workers', type=int, default=4, help='Concorrência para etapas paralelizáveis')
    args = parser.parse_args()

    resumo = []
    houve_erro_fatal = False

    if args.tipo in ('anime', 'todos'):
        print('=== Importando Animes (AniList) ===')
        stats, erro_fatal = executar_importacao('anime', 'AniList', importar_animes, paginas=args.paginas)
        resumo.append(stats)
        houve_erro_fatal = houve_erro_fatal or erro_fatal

    if args.tipo in ('manga', 'todos'):
        print('=== Importando Mangás (AniList) ===')
        stats, erro_fatal = executar_importacao('manga', 'AniList', importar_mangas, paginas=args.paginas)
        resumo.append(stats)
        houve_erro_fatal = houve_erro_fatal or erro_fatal

    if args.tipo in ('jogo', 'todos'):
        print('=== Importando Jogos (RAWG) ===')
        stats, erro_fatal = executar_importacao('jogo', 'RAWG', importar_jogos, paginas=args.paginas, workers=args.workers)
        resumo.append(stats)
        houve_erro_fatal = houve_erro_fatal or erro_fatal

    if args.tipo in ('musica', 'todos'):
        print('=== Importando Músicas (MusicBrainz) ===')
        stats, erro_fatal = executar_importacao(
            'musica',
            'MusicBrainz',
            importar_musicas_por_lista,
            args.seed_file,
            workers=args.workers,
        )
        resumo.append(stats)
        houve_erro_fatal = houve_erro_fatal or erro_fatal

    print('=== Resumo da importação ===')
    for stats in resumo:
        print(
            f"{stats.tipo_midia}: processados={stats.processados} "
            f"sucessos={stats.sucessos} falhas={stats.falhas} ja_existia={stats.ja_existia}"
        )

    if houve_erro_fatal:
        sys.exit(1)


if __name__ == '__main__':
    main()
