import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { DadosAvaliacao, PaginaAvaliacoes, RespostaNotas } from './tipos';

/** Avaliações que o detalhe mostra: só a 1ª página. */
export const AVALIACOES_POR_PAGINA = 20;

/** A 1ª página das Avaliações da Mídia; `total` conta todas. */
export function useAvaliacoes(id: string) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['avaliacoes', id],
    queryFn: () =>
      cliente.requisitar<PaginaAvaliacoes>(`/avaliacoes/${encodeURIComponent(id)}?por_pagina=${AVALIACOES_POR_PAGINA}`),
  });
}

/**
 * GET /midias/<id>/notas: a distribuição das notas de todas as Avaliações e a do Usuário
 * logado (que pode não estar na 1ª página). Sob ['avaliacoes', id]: uma Avaliação gravada
 * invalida as duas consultas.
 */
export function useNotas(id: string) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['avaliacoes', id, 'notas'],
    queryFn: () => cliente.requisitar<RespostaNotas>(`/midias/${encodeURIComponent(id)}/notas`),
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
