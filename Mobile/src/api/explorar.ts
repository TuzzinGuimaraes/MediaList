import { useInfiniteQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { PaginaMidias, TipoMidia } from './tipos';

export const POR_PAGINA = 24;

export type FiltrosBusca = {
  tipo: TipoMidia;
  ordem: string;
};

/** GET /midias página a página; a próxima só existe se a última veio cheia. */
export function useBuscaMidias(filtros: FiltrosBusca) {
  const { cliente } = useSessao();
  return useInfiniteQuery({
    queryKey: ['midias', 'busca', filtros],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        tipo: filtros.tipo,
        ordem: filtros.ordem,
        pagina: String(pageParam),
        por_pagina: String(POR_PAGINA),
      });
      return cliente.requisitar<PaginaMidias>(`/midias?${params}`);
    },
    getNextPageParam: (ultima, _todas, numero) =>
      ultima.midias.length < POR_PAGINA ? undefined : numero + 1,
    select: (dados) => dados.pages.flatMap((p) => p.midias),
  });
}
