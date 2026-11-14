import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { deslocarCabecalho } from './cabecalhoQueEsconde';
import { useReduzirMovimento } from './movimento';

/**
 * Cabeçalho que esconde ao rolar para baixo e volta ao rolar para cima, no thread de UI.
 * Com "reduzir movimento" ele fica fixo (`esconde` falso) e a tela o põe no fluxo normal.
 *
 * Uso: `aoMedir` no onLayout do cabeçalho, `estilo` nele (Animated.View, absoluto quando
 * `esconde`), `aoRolar` no onScroll da lista, `folga` como espaço no topo do conteúdo e
 * `mostrar` quando a lista recomeça do topo.
 */
export function useCabecalhoQueEsconde() {
  const esconde = !useReduzirMovimento();
  const [altura, setAltura] = useState(0);
  const alturaUi = useSharedValue(0);
  const deslocamento = useSharedValue(0);
  const ultimoY = useSharedValue(0);

  const aoRolar = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    deslocamento.set(deslocarCabecalho({ atual: deslocamento.get(), y, yAnterior: ultimoY.get(), altura: alturaUi.get() }));
    ultimoY.set(y);
  });
  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: esconde ? -deslocamento.get() : 0 }] }));

  const aoMedir = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setAltura(h);
    alturaUi.set(h);
  };

  /** Traz o cabeçalho de volta (ex.: a lista foi trocada e recomeça do topo). */
  const mostrar = useCallback(() => {
    deslocamento.set(0);
    ultimoY.set(0);
  }, [deslocamento, ultimoY]);

  return { esconde, aoRolar, estilo, aoMedir, mostrar, folga: esconde ? altura : 0 };
}
