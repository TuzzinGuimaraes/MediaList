import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { Temporada } from '@dominio/temporada';
import type { Midia, OrdemCatalogo, PaginaMidias, RespostaFacetas } from './tipos';

/** O máximo por página de GET /midias. */
export const POR_PAGINA_TEMPORADA = 50;
/** Teto de páginas por Temporada (as maiores têm ~150 animes): protege de um `total` errado. */
const MAX_PAGINAS = 10;

export type OrdemTemporada = Extract<OrdemCatalogo, 'popularidade_fonte' | 'estreia' | 'nota_media'>;

/**
 * Todos os animes de uma Temporada do Catálogo, na ordem pedida. Vêm todas as páginas de uma vez:
 * as seções (séries e "Filmes e especiais") só saem certas com a Temporada inteira.
 */
export function useAnimesDaTemporada(temporada: Temporada, ordem: OrdemTemporada) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['midias', 'temporada', temporada.estacao, temporada.ano, ordem],
    queryFn: async () => {
      const animes: Midia[] = [];
      for (let numero = 1; numero <= MAX_PAGINAS; numero++) {
        const params = new URLSearchParams({
          tipo: 'anime',
          temporada_estacao: temporada.estacao,
          temporada_ano: String(temporada.ano),
          ordem,
          pagina: String(numero),
          por_pagina: String(POR_PAGINA_TEMPORADA),
        });
        const pagina = await cliente.requisitar<PaginaMidias>(`/midias?${params}`);
        animes.push(...pagina.itens);
        if (!pagina.itens.length || pagina.pagina * pagina.por_pagina >= pagina.total) break;
      }
      return animes;
    },
  });
}

/** A Temporada mais antiga dos animes do Catálogo (o começo do seletor), ou null sem nenhuma. */
export function useTemporadaMaisAntiga() {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['midias', 'facetas', 'anime'],
    queryFn: () => cliente.requisitar<RespostaFacetas>('/midias/facetas?tipo=anime'),
    select: (r) => r.temporada_mais_antiga,
    staleTime: Infinity,
  });
}
