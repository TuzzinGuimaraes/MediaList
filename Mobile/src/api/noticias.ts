import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { PaginaNoticias, RespostaNotificacoes } from './tipos';

const chaveNotificacoes = ['notificacoes'] as const;

/** As 20 Notícias mais recentes (a 1ª página; o app não pagina as Notícias). */
export function useNoticias() {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['noticias'],
    queryFn: () => cliente.requisitar<PaginaNoticias>('/noticias?por_pagina=20'),
    select: (r) => r.itens,
  });
}

/** As 50 Notificações mais recentes (limite da API). Badge e lista leem a mesma consulta. */
function useConsultaNotificacoes<T>(select: (r: RespostaNotificacoes) => T) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    queryKey: chaveNotificacoes,
    queryFn: () => cliente.requisitar<RespostaNotificacoes>('/notificacoes'),
    enabled: sessao.estado === 'autenticada',
    select,
  });
}

const todas = (r: RespostaNotificacoes) => r.notificacoes;
const contarNaoLidas = (r: RespostaNotificacoes) => r.notificacoes.filter((n) => !n.lida).length;

export function useNotificacoes() {
  return useConsultaNotificacoes(todas);
}

export function useNaoLidas(): number {
  return useConsultaNotificacoes(contarNaoLidas).data ?? 0;
}

export function useMarcarTodasLidas() {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cliente.requisitar('/notificacoes/marcar-todas-lidas', { metodo: 'PUT' }),
    onSuccess: async () => {
      // Zera o badge na hora; a releitura confirma com o servidor.
      queryClient.setQueryData<RespostaNotificacoes>(chaveNotificacoes, (atual) =>
        atual && { notificacoes: atual.notificacoes.map((n) => ({ ...n, lida: true })) },
      );
      await queryClient.invalidateQueries({ queryKey: chaveNotificacoes });
    },
  });
}
