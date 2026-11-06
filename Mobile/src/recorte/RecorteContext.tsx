import { createContext, useContext, useMemo, useState } from 'react';

import type { TipoMidia } from '../api/tipos';

/** Recorte de catálogo: estado de interface em memória, não persistido (CONTEXT.md). */
export type Recorte = 'animanga' | 'jogos';

export const TIPOS_DO_RECORTE: Record<Recorte, TipoMidia[]> = {
  animanga: ['anime', 'manga'],
  jogos: ['jogo'],
};

type ValorRecorte = { recorte: Recorte; escolher(recorte: Recorte): void };

const RecorteContext = createContext<ValorRecorte | null>(null);

export function RecorteProvider({ children }: { children: React.ReactNode }) {
  const [recorte, escolher] = useState<Recorte>('animanga');
  const valor = useMemo(() => ({ recorte, escolher }), [recorte]);
  return <RecorteContext.Provider value={valor}>{children}</RecorteContext.Provider>;
}

export function useRecorte(): ValorRecorte {
  const valor = useContext(RecorteContext);
  if (!valor) throw new Error('useRecorte fora do RecorteProvider');
  return valor;
}
