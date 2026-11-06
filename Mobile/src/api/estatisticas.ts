import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { RespostaEstatisticas, RespostaLista } from './tipos';

/** Totais por Tipo de mídia (GET /usuario/estatisticas). */
export function useEstatisticasPorTipo() {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['usuario', 'estatisticas'],
    queryFn: () => cliente.requisitar<RespostaEstatisticas>('/usuario/estatisticas'),
    select: (r) => r.estatisticas,
  });
}

/**
 * Itens da Lista pessoal, base das contagens por Estado de consumo e da média das
 * Notas pessoais: /usuario/estatisticas não traz Planejado, Pausado, Abandonado nem
 * Platinado separados. Fica sob ['lista'] para ser invalidada junto com a Lista.
 */
export function useItensParaEstatisticas() {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['lista', 'estatisticas'],
    queryFn: () => cliente.requisitar<RespostaLista>('/lista'),
    select: (r) => r.lista,
  });
}
