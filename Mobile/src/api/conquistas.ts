import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import { consultaDoSeletor, type FiltrosDoSeletor, proximaPaginaDoSeletor } from '@dominio/conquistas';
import type {
  ConquistaDoItem,
  PaginaConquistasDoSeletor,
  RespostaConquistasDoItem,
  RespostaDestaques,
  RespostaJogosComConquistas,
} from './tipos';

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
 * relê tudo de conquistas (a lista do Item, os destaques e o seletor). O sétimo destaque falha com 409
 * (`eLimiteDeDestaques`). A tela de conquistas do jogo e o seletor usam esta mesma escrita.
 */
export function useMudarDestaque() {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conquista, destacar }: { conquista: ConquistaDoItem; destacar: boolean }) =>
      cliente.requisitar(
        `/usuario/conquistas/destaques/${conquista.steam_appid}/${encodeURIComponent(conquista.codigo)}`,
        { metodo: destacar ? 'PUT' : 'DELETE' },
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE_CONQUISTAS }),
  });
}

/** As conquistas obtidas do Usuário (GET /usuario/conquistas), página a página (50), com os filtros do seletor. */
export function useConquistasDoSeletor(filtros: FiltrosDoSeletor) {
  const { cliente } = useSessao();
  return useInfiniteQuery({
    queryKey: [...CHAVE_CONQUISTAS, 'seletor', filtros],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const consulta = Object.entries(consultaDoSeletor(filtros, pageParam)).map(([k, v]) => [k, String(v)]);
      return cliente.requisitar<PaginaConquistasDoSeletor>(`/usuario/conquistas?${new URLSearchParams(consulta)}`);
    },
    getNextPageParam: proximaPaginaDoSeletor,
    select: (dados) => dados.pages.flatMap((p) => p.itens),
  });
}

/** Os jogos com alguma conquista obtida (GET /usuario/conquistas/jogos), para o filtro do seletor. */
export function useJogosComConquistas() {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: [...CHAVE_CONQUISTAS, 'jogos'],
    queryFn: () => cliente.requisitar<RespostaJogosComConquistas>('/usuario/conquistas/jogos'),
    select: (r) => r.jogos,
  });
}
