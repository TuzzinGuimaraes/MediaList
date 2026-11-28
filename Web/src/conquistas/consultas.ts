// As consultas e a escrita das conquistas da Steam (spec `conquistas-steam`), que o Detalhe do jogo e
// o Perfil usam: a lista do Item (GET /lista/<id_lista>/conquistas), os destaques do Perfil
// (GET /usuario/conquistas/destaques), o seletor de destaques (GET /usuario/conquistas e
// /usuario/conquistas/jogos) e o PUT/DELETE de um destaque, tudo sob o prefixo que a escrita invalida.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { consultaDoSeletor, type FiltrosDoSeletor, proximaPaginaDoSeletor } from '@dominio/conquistas';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import type { Esquemas } from '../api/tipos';
import { useApi } from '../sessao/SessaoContext';

/** As conquistas da Steam do jogo de um Item, na ordem da API (oculta não obtida sem nome). */
export function useConquistasDoItem(idLista: string) {
  const api = useApi();
  return useQuery({
    queryKey: chaves.conquistas.doItem(idLista),
    queryFn: () =>
      exigir(api.GET('/api/lista/{lista_id}/conquistas', { params: { path: { lista_id: idLista } } })),
    select: (r) => r.conquistas,
  });
}

/**
 * Põe (`destacar`) ou tira a conquista obtida dos destaques do Perfil, pela appid e pelo código; depois
 * relê tudo de conquistas (a lista do Item, os destaques e o seletor). O sétimo destaque falha com 409
 * (`eLimiteDeDestaques`). O Detalhe e o seletor do Perfil usam esta mesma escrita.
 */
export function useMudarDestaque() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conquista, destacar }: { conquista: Esquemas['ConquistaDoItem']; destacar: boolean }) => {
      const caminho = { params: { path: { steam_appid: conquista.steam_appid, codigo: conquista.codigo } } };
      return destacar
        ? exigir(api.PUT('/api/usuario/conquistas/destaques/{steam_appid}/{codigo}', caminho))
        : exigir(api.DELETE('/api/usuario/conquistas/destaques/{steam_appid}/{codigo}', caminho));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaves.conquistas.todas }),
  });
}

export function useDestaques() {
  const api = useApi();
  return useQuery({
    queryKey: chaves.conquistas.destaques,
    queryFn: () => exigir(api.GET('/api/usuario/conquistas/destaques')),
  });
}

/** As conquistas obtidas do Usuário, página a página (50), com os filtros do seletor. */
export function useConquistasDoSeletor(filtros: FiltrosDoSeletor) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: chaves.conquistas.seletor(filtros),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      exigir(api.GET('/api/usuario/conquistas', { params: { query: consultaDoSeletor(filtros, pageParam) } })),
    getNextPageParam: proximaPaginaDoSeletor,
    select: (dados) => dados.pages.flatMap((p) => p.itens),
  });
}

/** Os jogos com alguma conquista obtida, para o filtro do seletor. */
export function useJogosComConquistas() {
  const api = useApi();
  return useQuery({
    queryKey: chaves.conquistas.jogos,
    queryFn: () => exigir(api.GET('/api/usuario/conquistas/jogos')),
    select: (r) => r.jogos,
  });
}
