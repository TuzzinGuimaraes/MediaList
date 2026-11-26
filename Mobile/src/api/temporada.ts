import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import { animesDaTemporada, consultaDaTemporada, type OrdemTemporada, type Temporada } from '@dominio/temporada';
import type { PaginaMidias, RespostaFacetas } from './tipos';

/**
 * Todos os animes de uma Temporada do Catálogo, na ordem pedida. Vêm todas as páginas de uma vez
 * (`animesDaTemporada` do domínio): as seções só saem certas com a Temporada inteira.
 */
export function useAnimesDaTemporada(temporada: Temporada, ordem: OrdemTemporada) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['midias', 'temporada', temporada.estacao, temporada.ano, ordem],
    queryFn: () =>
      animesDaTemporada((numero) => {
        const consulta = consultaDaTemporada(temporada, ordem, numero);
        const params = new URLSearchParams(Object.entries(consulta).map(([k, v]) => [k, String(v)]));
        return cliente.requisitar<PaginaMidias>(`/midias?${params}`);
      }),
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
