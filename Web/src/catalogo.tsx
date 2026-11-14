// Recorte de catálogo (CONTEXT.md): estado de interface; na tela só o valor ("Anime & Mangá", "Jogos").
import { createContext, type ReactNode, useContext, useState } from 'react';

import { type Recorte, TIPOS_DO_RECORTE } from './api';

const CHAVE = 'prototipo-web:catalogo';
const Contexto = createContext<{ recorte: Recorte; trocar(r: Recorte): void }>({ recorte: 'animanga', trocar: () => {} });

export function ProvedorCatalogo({ children }: { children: ReactNode }) {
  const [recorte, setRecorte] = useState<Recorte>(() => (localStorage.getItem(CHAVE) === 'jogos' ? 'jogos' : 'animanga'));
  const trocar = (r: Recorte) => {
    localStorage.setItem(CHAVE, r);
    setRecorte(r);
  };
  return <Contexto.Provider value={{ recorte, trocar }}>{children}</Contexto.Provider>;
}

export function useCatalogo() {
  const c = useContext(Contexto);
  return { ...c, tipos: TIPOS_DO_RECORTE[c.recorte] };
}
