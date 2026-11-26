import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import { consultaDoCalendario } from '@dominio/calendario';
import type { RespostaCalendario } from './tipos';

/** Os episódios dos 7 dias de Hoje em diante no fuso (GET /midias/calendario), pelo instante. */
export function useCalendario(agora: Date, fuso: string) {
  const { cliente, sessao } = useSessao();
  const { de, ate } = consultaDoCalendario(agora, fuso);
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['midias', 'calendario', de, ate],
    queryFn: () => cliente.requisitar<RespostaCalendario>(`/midias/calendario?${new URLSearchParams({ de, ate })}`),
    select: (r) => r.episodios,
  });
}
