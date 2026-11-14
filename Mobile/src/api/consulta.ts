import { QueryClient, type QueryKey, focusManager, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { useCores } from '../tema/TemaContext';

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

/**
 * Lê o cache sem criar observador e sem buscar: os selos e o fio de progresso só aparecem
 * quando a consulta já foi carregada por outra tela. Um observador (mesmo desligado)
 * passaria a dona da queryFn e as invalidações chamariam a dele.
 */
export function useCache<T>(chave: QueryKey): T | undefined {
  const cliente = useQueryClient();
  const hash = JSON.stringify(chave);
  const assinar = useCallback((avisar: () => void) => cliente.getQueryCache().subscribe(avisar), [cliente]);
  // A chave entra pelo hash: um array novo a cada render não troca a função.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ler = useCallback(() => cliente.getQueryData<T>(chave), [cliente, hash]);
  return useSyncExternalStore(assinar, ler, ler);
}

type Consulta = { refetch: () => Promise<unknown> };

/**
 * Props do RefreshControl (puxar para atualizar) para uma ou mais consultas, na cor da marca.
 * O indicador só aparece durante o refetch pedido pelo gesto: refetches de mutação ou de
 * foco não mostram o spinner.
 */
export function useAtualizar(consulta: Consulta | Consulta[]) {
  const cores = useCores();
  const [atualizando, setAtualizando] = useState(false);
  const consultas = Array.isArray(consulta) ? consulta : [consulta];
  return {
    refreshing: atualizando,
    onRefresh: () => {
      setAtualizando(true);
      Promise.all(consultas.map((c) => c.refetch())).finally(() => setAtualizando(false));
    },
    tintColor: cores['marca-texto'],
    colors: [cores.marca],
    progressBackgroundColor: cores.superficie,
  };
}
