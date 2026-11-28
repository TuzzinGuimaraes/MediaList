// Os destaques do Perfil (GET /usuario/conquistas/destaques) e o seletor de destaques
// (GET /usuario/conquistas e /usuario/conquistas/jogos), sob o prefixo que a escrita do destaque invalida.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { consultaDoSeletor, type FiltrosDoSeletor, proximaPaginaDoSeletor } from '@dominio/conquistas';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { useApi } from '../sessao/SessaoContext';

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
