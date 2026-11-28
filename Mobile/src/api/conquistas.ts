import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { RespostaConquistasDoItem } from './tipos';

/** Prefixo das conquistas da Steam; só a sincronização as escreve. */
export const CHAVE_CONQUISTAS = ['conquistas'] as const;

export const chaveDasConquistasDoItem = (idLista: string) => [...CHAVE_CONQUISTAS, 'item', idLista] as const;

/** As conquistas do jogo de um Item (GET /lista/<id_lista>/conquistas), na ordem da API; sem Item, não busca. */
export function useConquistasDoItem(idLista: string | undefined) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada' && !!idLista,
    queryKey: chaveDasConquistasDoItem(idLista ?? ''),
    queryFn: () =>
      cliente.requisitar<RespostaConquistasDoItem>(`/lista/${encodeURIComponent(idLista ?? '')}/conquistas`),
    select: (r) => r.conquistas,
  });
}
