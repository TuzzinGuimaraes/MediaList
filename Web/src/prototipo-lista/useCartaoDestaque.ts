// PROTÓTIPO (ticket 39, 2ª rodada): estado e tempos do cartão de destaque das linhas.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Ancora } from './contexto';

const ESPERA = 300;
const TOLERANCIA = 220;

/** Estado do cartão e os gatilhos que as linhas chamam (pelo contexto). */
export function useCartaoDestaque() {
  const [aberto, setAberto] = useState<Ancora | null>(null);
  const atual = useRef<Ancora | null>(null);
  const timer = useRef(0);
  const abrir = useCallback((a: Ancora | null) => {
    atual.current = a;
    setAberto(a);
  }, []);

  const destacar = useCallback((a: Ancora) => {
    const mesmo = atual.current?.item.id_lista === a.item.id_lista;
    clearTimeout(timer.current);
    if (mesmo) return; // já aberto nesta linha: só cancela um fechamento pendente
    if (a.origem === 'foco') abrir(a);
    // "Parado": cada movimento recomeça a espera.
    else timer.current = window.setTimeout(() => abrir(a), ESPERA);
  }, [abrir]);
  const soltar = useCallback((imediato = false) => {
    clearTimeout(timer.current);
    if (imediato) abrir(null);
    else timer.current = window.setTimeout(() => abrir(null), TOLERANCIA);
  }, [abrir]);
  const segurar = useCallback(() => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => soltar(true);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    addEventListener('scroll', fechar, { passive: true });
    addEventListener('resize', fechar);
    addEventListener('keydown', esc);
    return () => {
      removeEventListener('scroll', fechar);
      removeEventListener('resize', fechar);
      removeEventListener('keydown', esc);
    };
  }, [aberto, soltar]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return useMemo(() => ({ aberto, destacar, soltar, segurar }), [aberto, destacar, soltar, segurar]);
}
