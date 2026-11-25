// PROTÓTIPO: ações do Item (em memória) e a prévia de capa do formato 5, sem prop drilling.
import { createContext, useContext } from 'react';

import type { EstadoConsumo } from '@dominio/estadoConsumo';

import type { Item } from './dados';

export type Acoes = {
  mudarStatus(item: Item, estado: EstadoConsumo): void;
  passo(item: Item, delta: 1 | -1): void;
  previa(p: { url: string; x: number; y: number } | null): void;
};

export const AcoesCtx = createContext<Acoes | null>(null);

export function useAcoes(): Acoes {
  const a = useContext(AcoesCtx);
  if (!a) throw new Error('AcoesCtx ausente');
  return a;
}
