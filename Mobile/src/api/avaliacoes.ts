import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { AvaliacaoCompleta, DadosAvaliacao } from './tipos';

export function useAvaliacoes(id: string) {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['avaliacoes', id],
    queryFn: () =>
      cliente.requisitar<{ avaliacoes: AvaliacaoCompleta[] }>(`/avaliacoes/${encodeURIComponent(id)}`),
    select: (r) => r.avaliacoes,
  });
}

/** Nota média e Total de avaliações vêm do detalhe: os dois são refeitos após qualquer mudança. */
function useInvalidarDetalhe(idMidia: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['midias', idMidia] }),
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
