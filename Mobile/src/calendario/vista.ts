import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';

/** As visualizações do Calendário: a lista por dia ou os dias lado a lado. */
export type VistaDoCalendario = 'agenda' | 'semana';

const CHAVE = 'medialist.calendario.vista';
const VISTAS: readonly VistaDoCalendario[] = ['agenda', 'semana'];

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
    SecureStore.getItemAsync(CHAVE)
      .catch(() => null)
      .then((guardada) => {
        const valida = VISTAS.find((v) => v === guardada);
        if (vivo && valida && !escolheu.current) setVista(valida);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const escolher = useCallback((nova: VistaDoCalendario) => {
    escolheu.current = true;
    setVista(nova);
    SecureStore.setItemAsync(CHAVE, nova).catch(() => {});
  }, []);

  return [vista, escolher];
}
