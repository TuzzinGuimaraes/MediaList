import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { RespostaAvaliacoes } from './tipos';

export function useAvaliacoes(id: string) {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['avaliacoes', id],
    queryFn: () => cliente.requisitar<RespostaAvaliacoes>(`/avaliacoes/${encodeURIComponent(id)}`),
    select: (r) => r.avaliacoes,
  });
}
