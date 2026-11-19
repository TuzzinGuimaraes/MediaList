// Consultas e escritas do detalhe da Mídia. Chaves: ['midias', id] (e o que vive sob
// ['midias'], que Início e Explorar também usam), ['lista'] (a Lista pessoal inteira, como
// a recebe GET /lista) e ['avaliacoes', id] (a 1ª página e, sob ela, as notas).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { exigir } from '../../api/cliente';
import type { Esquemas } from '../../api/tipos';
import { useApi } from '../../sessao/SessaoContext';
import type { DadosAvaliacao } from '@dominio/tipos';

/** O detalhe mostra só a 1ª página das Avaliações. */
export const AVALIACOES_POR_PAGINA = 20;

const caminho = (id: string) => ({ params: { path: { id_midia: id } } });

export function useMidia(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['midias', id],
    queryFn: () => exigir(api.GET('/api/midias/{id_midia}', caminho(id))),
  });
}

export function useAtividade(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['midias', id, 'atividade'],
    queryFn: () => exigir(api.GET('/api/midias/{id_midia}/atividade', caminho(id))),
  });
}

/** O Item da Lista pessoal para esta Mídia; null se ela não está na Lista. */
export function useItemDaLista(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['lista'],
    queryFn: () => exigir(api.GET('/api/lista')),
    select: (r: Esquemas['RespostaLista']) => r.lista.find((item) => item.id_midia === id) ?? null,
  });
}

/** A distribuição das notas de todas as Avaliações e a do Usuário logado. */
export function useNotas(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['avaliacoes', id, 'notas'],
    queryFn: () => exigir(api.GET('/api/midias/{id_midia}/notas', caminho(id))),
  });
}

export function useAvaliacoes(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['avaliacoes', id],
    queryFn: () =>
      exigir(
        api.GET('/api/avaliacoes/{id_midia}', {
          params: { path: { id_midia: id }, query: { por_pagina: AVALIACOES_POR_PAGINA } },
        }),
      ),
  });
}

/** Uma Avaliação muda a Nota média e o Total de avaliações da Mídia, que também ordenam Início, Explorar e a Lista. */
function useInvalidarAvaliacoes(idMidia: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['midias'] }),
      queryClient.invalidateQueries({ queryKey: ['lista'] }),
      queryClient.invalidateQueries({ queryKey: ['avaliacoes', idMidia] }),
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
