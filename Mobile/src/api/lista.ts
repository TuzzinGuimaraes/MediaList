import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { RespostaLista } from './tipos';

/** O Item de lista do Usuário para esta Mídia, ou null se ela não está na Lista pessoal. */
export function useItemDaLista(id: string) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    queryKey: ['lista'],
    queryFn: () => cliente.requisitar<RespostaLista>('/lista'),
    enabled: sessao.estado === 'autenticada',
    select: (r) => r.lista.find((item) => item.id_midia === id) ?? null,
  });
}
