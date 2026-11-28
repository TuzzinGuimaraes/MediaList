import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { ConquistaDoItem, RespostaConquistasDoItem, RespostaDestaques } from './tipos';

/** Prefixo das conquistas da Steam (só a sincronização as escreve) e dos destaques do Perfil. */
export const CHAVE_CONQUISTAS = ['conquistas'] as const;

export const chaveDasConquistasDoItem = (idLista: string) => [...CHAVE_CONQUISTAS, 'item', idLista] as const;

export const CHAVE_DESTAQUES = [...CHAVE_CONQUISTAS, 'destaques'] as const;

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

/** Os destaques do Perfil (GET /usuario/conquistas/destaques): os escolhidos ou os automáticos, e o total. */
export function useDestaques() {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: CHAVE_DESTAQUES,
    queryFn: () => cliente.requisitar<RespostaDestaques>('/usuario/conquistas/destaques'),
  });
}

/**
 * Põe (`destacar`) ou tira a conquista obtida dos destaques do Perfil, pela appid e pelo código; depois
 * relê a lista do Item e os destaques. O sétimo destaque falha com 409 (`eLimiteDeDestaques`).
 */
export function useMudarDestaque(idLista: string) {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conquista, destacar }: { conquista: ConquistaDoItem; destacar: boolean }) =>
      cliente.requisitar(
        `/usuario/conquistas/destaques/${conquista.steam_appid}/${encodeURIComponent(conquista.codigo)}`,
        { metodo: destacar ? 'PUT' : 'DELETE' },
      ),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chaveDasConquistasDoItem(idLista) }),
        queryClient.invalidateQueries({ queryKey: CHAVE_DESTAQUES }),
      ]),
  });
}
