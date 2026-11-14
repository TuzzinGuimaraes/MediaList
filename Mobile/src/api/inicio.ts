import { useQueries, useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import { notaDeRanking } from '../dominio/midia';
import { decrescente } from '../dominio/ordenacao';
import { type Recorte, TIPOS_DO_RECORTE } from '../recorte/RecorteContext';
import type { Cliente } from './cliente';
import type { Midia, OrdemCatalogo, PaginaMidias } from './tipos';

/** Quantas Mídias cada Tipo manda para um carrossel do Início. */
export const POR_CARROSSEL = 20;

/** As ordens do catálogo que viram carrossel no Início (a alfabética não). */
export type OrdemCarrossel = Exclude<OrdemCatalogo, 'titulo'>;

/**
 * Como juntar as respostas dos Tipos de um Recorte na mesma ordem que o backend usou em cada
 * uma: a chave decrescente da ordem, com null no fim.
 */
const CHAVE_DA_ORDEM: Record<OrdemCarrossel, (m: Midia) => number | string | null> = {
  nota_media: notaDeRanking,
  data_lancamento: (m) => m.data_lancamento,
  mais_adicionados: (m) => m.total_usuarios,
  mais_concluidos: (m) => m.total_concluidos,
};

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
      return respostas
        .flatMap((r) => r.itens)
        .sort(decrescente(CHAVE_DA_ORDEM[ordem]))
        .slice(0, POR_CARROSSEL);
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
