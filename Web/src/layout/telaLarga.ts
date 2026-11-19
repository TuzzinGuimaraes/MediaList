import { useEffect, useState } from 'react';

/**
 * Desktop: a partir de 1024px (o `lg` do Tailwind). Abaixo, até o tablet, a nav vira menu,
 * os filtros do Explorar viram painel e o detalhe cai para uma coluna. No celular, o app.
 */
export const CONSULTA_TELA_LARGA = '(min-width: 1024px)';

/** A tela é de desktop (≥ 1024px); acompanha o redimensionamento. */
export function useTelaLarga(): boolean {
  const [larga, setLarga] = useState(() => window.matchMedia(CONSULTA_TELA_LARGA).matches);
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_TELA_LARGA);
    const ouvir = (e: MediaQueryListEvent) => setLarga(e.matches);
    consulta.addEventListener('change', ouvir);
    return () => consulta.removeEventListener('change', ouvir);
  }, []);
  return larga;
}
