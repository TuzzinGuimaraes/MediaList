import { useQueries, useQuery } from '@tanstack/react-query';

import { juntarCarrossel, type OrdemCarrossel } from '@dominio/carrossel';
import { useSessao } from '../auth/SessaoContext';
import { type Recorte, TIPOS_DO_RECORTE } from '../recorte/RecorteContext';
import type { Cliente } from './cliente';
import type { PaginaMidias } from './tipos';

/** Quantas Mídias cada Tipo manda para um carrossel do Início. */
export const POR_CARROSSEL = 20;

/** As ordens do catálogo que viram carrossel no Início (a alfabética não). */
export type { OrdemCarrossel };

function consultaCarrossel(
  cliente: Cliente,
  autenticada: boolean,
  recorte: Recorte,
  ordem: OrdemCarrossel,
  genero: string | null = null,
) {
  return {
    enabled: autenticada,
    queryKey: ['midias', 'carrossel', recorte, ordem, genero],
    queryFn: async () => {
      const respostas = await Promise.all(
        TIPOS_DO_RECORTE[recorte].map((tipo) => {
          const params = new URLSearchParams({ tipo, ordem, por_pagina: String(POR_CARROSSEL) });
          if (genero) params.set('genero', genero);
          return cliente.requisitar<PaginaMidias>(`/midias?${params}`);
        }),
      );
      return juntarCarrossel(
        respostas.map((r) => r.itens),
        ordem,
        POR_CARROSSEL,
      );
    },
  };
}

/** Um carrossel de catálogo do Início: GET /midias numa ordem, com os Tipos do Recorte juntos. */
export function useCarrossel(recorte: Recorte, ordem: OrdemCarrossel) {
  const { cliente, sessao } = useSessao();
  return useQuery(consultaCarrossel(cliente, sessao.estado === 'autenticada', recorte, ordem));
}

/** Um carrossel por gênero ("Porque você curte <gênero>"), pelas maiores notas. */
export function useCarrosseisPorGenero(recorte: Recorte, generos: string[]) {
  const { cliente, sessao } = useSessao();
  return useQueries({
    queries: generos.map((genero) =>
      consultaCarrossel(cliente, sessao.estado === 'autenticada', recorte, 'nota_media', genero),
    ),
  });
}
