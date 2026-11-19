import { useEffect, useState } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';

/** "Reduzir movimento" do sistema; o CSS global já zera transições, isto é para o que roda em JS. */
export function useReduzirMovimento(): boolean {
  const [reduzir, setReduzir] = useState(() => window.matchMedia(CONSULTA).matches);
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA);
    const ouvir = (e: MediaQueryListEvent) => setReduzir(e.matches);
    consulta.addEventListener('change', ouvir);
    return () => consulta.removeEventListener('change', ouvir);
  }, []);
  return reduzir;
}
