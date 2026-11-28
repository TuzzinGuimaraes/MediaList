import { useEffect, useState } from 'react';

/** O `valor` só depois de `ms` sem mudar: a busca não vai à API a cada letra. */
export function useValorAtrasado<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const espera = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(espera);
  }, [valor, ms]);
  return atrasado;
}
