import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { CorpoPreferencias, RespostaPreferencias } from './tipos';

const chavePreferencias = ['preferencias'] as const;

export function usePreferencias() {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: chavePreferencias,
    queryFn: () => cliente.requisitar<RespostaPreferencias>('/preferencias'),
    select: (r) => r.preferencias,
  });
}

/** Grava só os campos enviados; a tela já mostra o valor novo e volta ao anterior se falhar. */
export function useSalvarPreferencias() {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mudancas: CorpoPreferencias) =>
      cliente.requisitar('/preferencias', { metodo: 'PUT', corpo: mudancas }),
    onMutate: async (mudancas) => {
      await queryClient.cancelQueries({ queryKey: chavePreferencias });
      const anterior = queryClient.getQueryData<RespostaPreferencias>(chavePreferencias);
      if (anterior) {
        const semNulos = Object.fromEntries(Object.entries(mudancas).filter(([, v]) => v != null));
        queryClient.setQueryData<RespostaPreferencias>(chavePreferencias, {
          preferencias: { ...anterior.preferencias, ...semNulos },
        });
      }
      return { anterior };
    },
    onError: (_erro, _mudancas, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(chavePreferencias, contexto.anterior);
    },
  });
}
