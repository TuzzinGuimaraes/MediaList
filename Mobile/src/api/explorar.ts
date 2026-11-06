import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { PaginaMidias, RespostaGeneros, TipoMidia } from './tipos';

export const POR_PAGINA = 24;

/** Valores de `ordem` aceitos por GET /midias (Backend/repositories/midia_repository.py). */
export type Ordem = 'nota_media' | 'titulo' | 'data_lancamento' | 'mais_adicionados';

export type FiltrosBusca = {
  tipo: TipoMidia;
  ordem: Ordem;
  /** `nome_genero`; null para todos. */
  genero: string | null;
  /** Termo já aparado; vazio para não buscar. */
  busca: string;
};

/** GET /midias página a página; a próxima só existe se a última veio cheia. */
export function useBuscaMidias(filtros: FiltrosBusca) {
  const { cliente } = useSessao();
  return useInfiniteQuery({
    queryKey: ['midias', 'busca', filtros],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ tipo: filtros.tipo, ordem: filtros.ordem });
      if (filtros.genero) params.set('genero', filtros.genero);
      if (filtros.busca) params.set('busca', filtros.busca);
      params.set('pagina', String(pageParam));
      params.set('por_pagina', String(POR_PAGINA));
      return cliente.requisitar<PaginaMidias>(`/midias?${params}`);
    },
    getNextPageParam: (ultima, _todas, numero) =>
      ultima.midias.length < POR_PAGINA ? undefined : numero + 1,
    select: (dados) => dados.pages.flatMap((p) => p.midias),
  });
}

/** Gêneros aplicáveis ao Tipo de mídia. */
export function useGeneros(tipo: TipoMidia) {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['generos', tipo],
    queryFn: () => cliente.requisitar<RespostaGeneros>(`/generos?tipo=${tipo}`),
    select: (r) => r.generos.map((g) => g.nome_genero),
    staleTime: Infinity,
  });
}
