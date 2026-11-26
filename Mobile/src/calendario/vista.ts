import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CHAVE_DA_VISTA, type VistaDoCalendario, vistaGuardada } from '@dominio/calendario';

/**
 * A visualização escolhida, guardada no aparelho (estado de interface, como o tema). Começa na
 * Agenda e troca para a guardada quando ela chega.
 */
export function useVistaDoCalendario(): [VistaDoCalendario, (vista: VistaDoCalendario) => void] {
  const [vista, setVista] = useState<VistaDoCalendario>('agenda');
  // Escolheu antes de a guardada chegar: a escolha vale.
  const escolheu = useRef(false);

  useEffect(() => {
    let vivo = true;
    SecureStore.getItemAsync(CHAVE_DA_VISTA)
      .catch(() => null)
      .then((guardada) => {
        if (vivo && !escolheu.current) setVista(vistaGuardada(guardada));
      });
    return () => {
      vivo = false;
    };
  }, []);

  const escolher = useCallback((nova: VistaDoCalendario) => {
    escolheu.current = true;
    setVista(nova);
    SecureStore.setItemAsync(CHAVE_DA_VISTA, nova).catch(() => {});
  }, []);

  return [vista, escolher];
}
