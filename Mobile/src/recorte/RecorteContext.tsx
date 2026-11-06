import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Animated } from 'react-native';

import type { TipoMidia } from '../api/tipos';
import { useReduzirMovimento } from '../tema/movimento';

/** Recorte de catálogo: estado de interface em memória, não persistido (CONTEXT.md). */
export type Recorte = 'animanga' | 'jogos';

export const TIPOS_DO_RECORTE: Record<Recorte, TipoMidia[]> = {
  animanga: ['anime', 'manga'],
  jogos: ['jogo'],
};

export const NOMES_RECORTE: Record<Recorte, string> = {
  animanga: 'Anime & Mangá',
  jogos: 'Jogos',
};

/** Fade-out e fade-in do conteúdo ao trocar: ~200ms no total. */
const METADE_TROCA_MS = 100;

type ValorRecorte = {
  /** Recorte aplicado: as telas pedem e filtram os dados por ele. */
  recorte: Recorte;
  /** Recorte escolhido; durante a transição já é o novo, e a pílula o mostra. */
  destino: Recorte;
  escolher(recorte: Recorte): void;
  /** Opacidade do conteúdo das telas com Recorte (ver ConteudoRecorte). */
  opacidade: Animated.Value;
};

const RecorteContext = createContext<ValorRecorte | null>(null);

export function RecorteProvider({ children }: { children: React.ReactNode }) {
  const [recorte, setRecorte] = useState<Recorte>('animanga');
  const [destino, setDestino] = useState<Recorte>('animanga');
  const [opacidade] = useState(() => new Animated.Value(1));
  const reduzir = useReduzirMovimento();

  // O conteúdo some, o Recorte troca e o conteúdo volta já com os dados do novo.
  const escolher = useCallback(
    (novo: Recorte) => {
      setDestino(novo);
      opacidade.stopAnimation();
      if (reduzir) {
        opacidade.setValue(1);
        setRecorte(novo);
        return;
      }
      Animated.timing(opacidade, { toValue: 0, duration: METADE_TROCA_MS, useNativeDriver: true }).start(
        ({ finished }) => {
          // Interrompida por outra troca: a nova assume.
          if (!finished) return;
          setRecorte(novo);
          Animated.timing(opacidade, { toValue: 1, duration: METADE_TROCA_MS, useNativeDriver: true }).start();
        },
      );
    },
    [opacidade, reduzir],
  );

  const valor = useMemo(() => ({ recorte, destino, escolher, opacidade }), [recorte, destino, escolher, opacidade]);
  return <RecorteContext.Provider value={valor}>{children}</RecorteContext.Provider>;
}

export function useRecorte(): ValorRecorte {
  const valor = useContext(RecorteContext);
  if (!valor) throw new Error('useRecorte fora do RecorteProvider');
  return valor;
}

/** Envolve o conteúdo de uma tela com Recorte: faz o fade da troca. */
export function ConteudoRecorte({ children }: { children: React.ReactNode }) {
  const { opacidade } = useRecorte();
  return <Animated.View style={{ flex: 1, opacity: opacidade }}>{children}</Animated.View>;
}
