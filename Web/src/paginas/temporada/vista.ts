import { useCallback, useState } from 'react';

import { CHAVE_DA_VISTA, type VistaDoCalendario, vistaGuardada } from '@dominio/calendario';

function lerVista(): VistaDoCalendario {
  try {
    return vistaGuardada(localStorage.getItem(CHAVE_DA_VISTA));
  } catch {
    return 'agenda';
  }
}

/** A visualização do Calendário, guardada no navegador (estado de interface). */
export function useVista(): [VistaDoCalendario, (vista: VistaDoCalendario) => void] {
  const [vista, setVista] = useState(lerVista);
  const mudar = useCallback((nova: VistaDoCalendario) => {
    setVista(nova);
    try {
      localStorage.setItem(CHAVE_DA_VISTA, nova);
    } catch {
      // Sem armazenamento, vale até recarregar.
    }
  }, []);
  return [vista, mudar];
}
