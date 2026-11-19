// Recorte de catálogo (CONTEXT.md): estado de interface, não de domínio. Na tela aparece só
// o valor ("Anime & Mangá", "Jogos") e o leitor de tela diz "Catálogo"; nunca "sessão".
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import type { Esquemas } from '../api/tipos';

export type Recorte = 'animanga' | 'jogos';
export type TipoMidia = Esquemas['Midia']['tipo'];

export const NOMES_RECORTE: Record<Recorte, string> = { animanga: 'Anime & Mangá', jogos: 'Jogos' };
export const RECORTES = Object.keys(NOMES_RECORTE) as Recorte[];

// TODO(web-novo 01): trocar pelos Tipos do Recorte em `dominio/` quando o domínio compartilhado chegar.
const TIPOS_DO_RECORTE: Record<Recorte, readonly TipoMidia[]> = { animanga: ['anime', 'manga'], jogos: ['jogo'] };

const CHAVE = 'medialist.catalogo';
/** O web antigo guardava o Recorte com o nome "sessão"; a chave é descartada. */
const CHAVE_ANTIGA = 'medialist_sessao';

function lerRecorte(): Recorte {
  try {
    localStorage.removeItem(CHAVE_ANTIGA);
    return localStorage.getItem(CHAVE) === 'jogos' ? 'jogos' : 'animanga';
  } catch {
    return 'animanga';
  }
}

type ValorCatalogo = { recorte: Recorte; trocar(recorte: Recorte): void; tipos: readonly TipoMidia[] };

const CatalogoContext = createContext<ValorCatalogo | null>(null);

export function CatalogoProvider({ children }: { children: ReactNode }) {
  const [recorte, setRecorte] = useState(lerRecorte);
  const trocar = useCallback((novo: Recorte) => {
    setRecorte(novo);
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      // Sem armazenamento, vale até recarregar.
    }
  }, []);
  const valor = useMemo(() => ({ recorte, trocar, tipos: TIPOS_DO_RECORTE[recorte] }), [recorte, trocar]);
  return <CatalogoContext.Provider value={valor}>{children}</CatalogoContext.Provider>;
}

export function useCatalogo(): ValorCatalogo {
  const valor = useContext(CatalogoContext);
  if (!valor) throw new Error('useCatalogo fora do CatalogoProvider');
  return valor;
}
