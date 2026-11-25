// Contexto do cartão de destaque (Destaque.tsx): o que as linhas chamam para abri-lo e fechá-lo.
import { createContext, type FocusEvent, type KeyboardEvent, type MouseEvent, useContext } from 'react';

import type { ItemLista } from './api';

type Origem = 'mouse' | 'foco';
/** Onde o cartão se apoia: o retângulo da linha e, no hover, o x do cursor. */
export type Ancora = { item: ItemLista; linha: DOMRect; x: number | null; origem: Origem; titulo: HTMLElement | null };

export type Destaque = {
  /** O Item com o cartão aberto. */
  aberto: string | null;
  idCartao: string;
  destacar(a: Ancora): void;
  soltar(imediato?: boolean): void;
  /** Tab no título com o cartão aberto: entra nele. */
  entrar(): boolean;
};

export const DestaqueCtx = createContext<Destaque | null>(null);

function useDestaqueCtx(): Destaque {
  const d = useContext(DestaqueCtx);
  if (!d) throw new Error('ProvedorDestaque ausente');
  return d;
}

/**
 * Os eventos de uma linha: `linha` vai no role="row" (hover parado) e `titulo` no link do
 * título (foco de teclado, aria-describedby e o Tab que entra no cartão).
 */
export function useDestaque(item: ItemLista) {
  const { aberto, idCartao, destacar, soltar, entrar } = useDestaqueCtx();
  const doMouse = (e: MouseEvent<HTMLElement>) =>
    destacar({ item, linha: e.currentTarget.getBoundingClientRect(), x: e.clientX, origem: 'mouse', titulo: e.currentTarget.querySelector('a') });
  const meu = aberto === item.id_lista;
  return {
    linha: { onMouseEnter: doMouse, onMouseMove: doMouse, onMouseLeave: () => soltar() },
    titulo: {
      'aria-describedby': meu ? idCartao : undefined,
      onFocus: (e: FocusEvent<HTMLElement>) => {
        const linha = e.currentTarget.closest('[role="row"]') ?? e.currentTarget;
        destacar({ item, linha: linha.getBoundingClientRect(), x: null, origem: 'foco', titulo: e.currentTarget });
      },
      onBlur: () => soltar(),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (meu && e.key === 'Tab' && !e.shiftKey && entrar()) e.preventDefault();
      },
    },
  };
}

