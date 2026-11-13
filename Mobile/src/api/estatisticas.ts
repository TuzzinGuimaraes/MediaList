import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import { useLista } from './lista';
import type { RespostaEstatisticas } from './tipos';

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
 * Platinado separados. É a própria consulta ['lista'], sem cópia em outra chave.
 */
export function useItensParaEstatisticas() {
  return useLista();
}
