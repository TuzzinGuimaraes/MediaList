// PROTÓTIPO: ações do Item (em memória) e o cartão de destaque das linhas, sem prop drilling.
import { createContext, useContext } from 'react';

import type { EstadoConsumo } from '@dominio/estadoConsumo';

import type { Item } from './dados';

/** Âncora do cartão: o retângulo da linha e, no hover, o x do cursor. */
export type Ancora = { item: Item; linha: DOMRect; x: number | null; origem: 'mouse' | 'foco' };

export type Acoes = {
  mudarStatus(item: Item, estado: EstadoConsumo): void;
  /** Hover: abre depois de ~300 ms parado; foco: abre na hora. */
  destacar(a: Ancora): void;
  /** Sair da linha: fecha com uma pequena tolerância (o mouse pode estar indo ao cartão). */
  soltar(imediato?: boolean): void;
};

export const AcoesCtx = createContext<Acoes | null>(null);

export function useAcoes(): Acoes {
  const a = useContext(AcoesCtx);
  if (!a) throw new Error('AcoesCtx ausente');
  return a;
}
