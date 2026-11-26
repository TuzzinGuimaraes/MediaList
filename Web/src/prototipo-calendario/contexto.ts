// PROTÓTIPO (ticket 50): estado em memória compartilhado pelas variantes.
import { createContext, useContext } from 'react';

import type { Episodio, Lista } from './dados';

export type Acoes = {
  lista: Lista;
  planejar(id: string): void;
  abrir(e: Episodio): void;
  soOsMeus: boolean;
  mudarFiltro(v: boolean): void;
};

export const AcoesCtx = createContext<Acoes | null>(null);

export function useAcoes(): Acoes {
  const a = useContext(AcoesCtx);
  if (!a) throw new Error('fora do protótipo');
  return a;
}
