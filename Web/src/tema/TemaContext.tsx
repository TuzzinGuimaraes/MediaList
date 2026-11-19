import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  CONSULTA_CLARO,
  guardarPreferencia,
  lerPreferencia,
  PREFERENCIA_PADRAO,
  type PreferenciaTema,
  resolverTema,
  type Tema,
} from './tema';

type ValorTema = {
  preferencia: PreferenciaTema;
  escolher(preferencia: PreferenciaTema): void;
  /** Tema aplicado, com Sistema já resolvido. */
  tema: Tema;
};

const TemaContext = createContext<ValorTema>({ preferencia: PREFERENCIA_PADRAO, escolher: () => {}, tema: 'escuro' });

function useSistemaClaro(): boolean {
  const [claro, setClaro] = useState(() => window.matchMedia(CONSULTA_CLARO).matches);
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_CLARO);
    const ouvir = (e: MediaQueryListEvent) => setClaro(e.matches);
    consulta.addEventListener('change', ouvir);
    return () => consulta.removeEventListener('change', ouvir);
  }, []);
  return claro;
}

/** Aplica o tema como a classe `claro` no <html>; os tokens do tema.gerado.css fazem o resto. */
export function TemaProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState(lerPreferencia);
  const sistemaClaro = useSistemaClaro();
  const tema = resolverTema(preferencia, sistemaClaro);

  useEffect(() => {
    document.documentElement.classList.toggle('claro', tema === 'claro');
  }, [tema]);

  const escolher = useCallback((nova: PreferenciaTema) => {
    setPreferencia(nova);
    guardarPreferencia(nova);
  }, []);

  const valor = useMemo(() => ({ preferencia, escolher, tema }), [preferencia, escolher, tema]);
  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTema(): ValorTema {
  return useContext(TemaContext);
}
