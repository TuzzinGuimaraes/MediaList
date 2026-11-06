import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { RespostaNotificacoes } from './tipos';

const chaveNotificacoes = ['notificacoes'] as const;

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

export function useNaoLidas(): number {
  const { data } = useConsultaNotificacoes((r) => r.notificacoes.filter((n) => !n.lida).length);
  return data ?? 0;
}
