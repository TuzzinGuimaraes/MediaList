// Consultas e escritas do detalhe da Mídia (chaves em api/chaves.ts): o detalhe e a
// atividade sob ['midias', id], e a 1ª página das Avaliações e as notas sob ['avaliacoes', id]. O Item da Lista vem de `useItemDaMidia` (paginas/lista/api.ts, chave ['lista']).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DadosAvaliacao } from '@dominio/tipos';

import { chaves } from '../../api/chaves';
import { exigir } from '../../api/cliente';
import { useApi } from '../../sessao/SessaoContext';

/** O detalhe mostra só a 1ª página das Avaliações. */
export const AVALIACOES_POR_PAGINA = 20;

const caminho = (id: string) => ({ params: { path: { id_midia: id } } });

export function useMidia(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: chaves.midias.detalhe(id),
    queryFn: () => exigir(api.GET('/api/midias/{id_midia}', caminho(id))),
  });
}

export function useAtividade(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: chaves.midias.atividade(id),
    queryFn: () => exigir(api.GET('/api/midias/{id_midia}/atividade', caminho(id))),
  });
}

/** A distribuição das notas de todas as Avaliações e a do Usuário logado. */
export function useNotas(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: chaves.avaliacoes.notas(id),
    queryFn: () => exigir(api.GET('/api/midias/{id_midia}/notas', caminho(id))),
  });
}

export function useAvaliacoes(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: chaves.avaliacoes.daMidia(id),
    queryFn: () =>
      exigir(
        api.GET('/api/avaliacoes/{id_midia}', {
          params: { path: { id_midia: id }, query: { por_pagina: AVALIACOES_POR_PAGINA } },
        }),
      ),
  });
}

/**
 * Uma Avaliação muda a Nota média e o Total de avaliações da Mídia: refaz tudo que os mostra
 * (Início, Explorar, detalhe e Sugestões, sob ['midias']), a Lista e as Avaliações dela.
 */
function useInvalidarAvaliacoes(idMidia: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chaves.midias.todas }),
      queryClient.invalidateQueries({ queryKey: chaves.lista.toda }),
      queryClient.invalidateQueries({ queryKey: chaves.avaliacoes.daMidia(idMidia) }),
    ]);
}

/** Cria a Avaliação do Usuário, ou edita a dele quando `idAvaliacao` vem. */
export function useSalvarAvaliacao(idMidia: string) {
  const api = useApi();
  const invalidar = useInvalidarAvaliacoes(idMidia);
  return useMutation({
    mutationFn: ({ idAvaliacao, dados }: { idAvaliacao?: string; dados: DadosAvaliacao }) =>
      idAvaliacao
        ? exigir(api.PUT('/api/avaliacoes/{avaliacao_id}', { params: { path: { avaliacao_id: idAvaliacao } }, body: dados }))
        : exigir(api.POST('/api/avaliacoes', { body: { id_midia: idMidia, ...dados } })),
    onSuccess: invalidar,
  });
}

export function useExcluirAvaliacao(idMidia: string) {
  const api = useApi();
  const invalidar = useInvalidarAvaliacoes(idMidia);
  return useMutation({
    mutationFn: (idAvaliacao: string) =>
      exigir(api.DELETE('/api/avaliacoes/{avaliacao_id}', { params: { path: { avaliacao_id: idAvaliacao } } })),
    onSuccess: invalidar,
  });
}
