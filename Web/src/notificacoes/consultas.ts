// Notificações do Usuário (Atualizações das Mídias da Lista e Notícias): o sino da nav e o Perfil leem
// a mesma consulta, as 50 mais recentes da API.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import type { Esquemas } from '../api/tipos';
import { useApi } from '../sessao/SessaoContext';

export function useNotificacoes() {
  const api = useApi();
  return useQuery({
    queryKey: chaves.notificacoes,
    queryFn: () => exigir(api.GET('/api/notificacoes')),
    select: (r) => r.notificacoes,
  });
}

export function useMarcarTodasLidas() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => exigir(api.PUT('/api/notificacoes/marcar-todas-lidas')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.notificacoes }),
  });
}

/** A chave de uma Notificação na lista: a API não manda id. */
export const chaveDaNotificacao = (n: Esquemas['Notificacao'], i: number) => `${n.id_noticia ?? n.id_midia}-${n.data_criacao}-${i}`;
