import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { Cliente } from './cliente';
import type { Avaliacao, DadosAvaliacao, PaginaAvaliacoes } from './tipos';

/** O teto de `por_pagina` da API: menos idas ao servidor por Mídia. */
const POR_PAGINA = 50;

/**
 * Todas as Avaliações da Mídia, página a página até somar o `total`. O detalhe precisa de
 * todas: a distribuição das notas conta cada uma, e a do Usuário pode estar em qualquer
 * página. A API não tem a distribuição pronta nem um "minha Avaliação" (ver o ticket 06).
 */
async function todasAsAvaliacoes(cliente: Cliente, id: string): Promise<Avaliacao[]> {
  const itens: Avaliacao[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await cliente.requisitar<PaginaAvaliacoes>(
      `/avaliacoes/${encodeURIComponent(id)}?pagina=${pagina}&por_pagina=${POR_PAGINA}`,
    );
    itens.push(...r.itens);
    if (r.pagina * r.por_pagina >= r.total || r.itens.length === 0) return itens;
  }
}

export function useAvaliacoes(id: string) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['avaliacoes', id],
    queryFn: () => todasAsAvaliacoes(cliente, id),
  });
}

/**
 * Uma Avaliação muda a Nota média e o Total de avaliações da Mídia, que aparecem (ou
 * ordenam) no detalhe, em Início e Explorar (todas sob ['midias']) e nos Itens da Lista.
 */
function useInvalidarDetalhe(idMidia: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['midias'] }),
      queryClient.invalidateQueries({ queryKey: ['lista'] }),
      queryClient.invalidateQueries({ queryKey: ['avaliacoes', idMidia] }),
    ]);
}

/** Cria a Avaliação do Usuário, ou edita a existente quando `idAvaliacao` é dado. */
export function useSalvarAvaliacao(idMidia: string) {
  const { cliente } = useSessao();
  const invalidar = useInvalidarDetalhe(idMidia);
  return useMutation({
    mutationFn: ({ idAvaliacao, dados }: { idAvaliacao?: string; dados: DadosAvaliacao }) =>
      idAvaliacao
        ? cliente.requisitar(`/avaliacoes/${encodeURIComponent(idAvaliacao)}`, { metodo: 'PUT', corpo: dados })
        : cliente.requisitar('/avaliacoes', { metodo: 'POST', corpo: { id_midia: idMidia, ...dados } }),
    onSuccess: invalidar,
  });
}

export function useApagarAvaliacao(idMidia: string) {
  const { cliente } = useSessao();
  const invalidar = useInvalidarDetalhe(idMidia);
  return useMutation({
    mutationFn: (idAvaliacao: string) =>
      cliente.requisitar(`/avaliacoes/${encodeURIComponent(idAvaliacao)}`, { metodo: 'DELETE' }),
    onSuccess: invalidar,
  });
}
