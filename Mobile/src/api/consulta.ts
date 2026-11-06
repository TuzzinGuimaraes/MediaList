import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ErroApi } from './erros';

/** Cache só em memória (spec). Erro 4xx não se repete sozinho; rede e 5xx tentam mais uma vez. */
export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (falhas, erro) => !(erro instanceof ErroApi && erro.status < 500) && falhas < 1,
      },
      mutations: { retry: false },
    },
  });
}

/** Refaz as consultas quando o app volta para o primeiro plano. */
export function ligarFocoAoAppState(): () => void {
  if (Platform.OS === 'web') return () => {};
  const assinatura = AppState.addEventListener('change', (estado) => {
    focusManager.setFocused(estado === 'active');
  });
  return () => assinatura.remove();
}
