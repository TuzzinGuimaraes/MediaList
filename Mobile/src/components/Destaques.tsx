import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';

import type { Midia } from '../api/tipos';
import { useReduzirMovimento } from '../tema/movimento';
import { CardInfo } from './CardMidia';

export const INTERVALO_DESTAQUES_MS = 6000;

/** Margem lateral da página: o card C ocupa a largura da tela menos ela dos dois lados. */
const MARGEM = 16;

/**
 * Pede a página seguinte (da última, a primeira) a cada intervalo, enquanto `ativa`. Mudar
 * de página recomeça a contagem. `trocar` precisa ser estável (useCallback).
 */
export function useTrocaAutomatica(pagina: number, total: number, ativa: boolean, trocar: (proxima: number) => void) {
  useEffect(() => {
    if (!ativa || total < 2) return;
    const id = setTimeout(() => trocar((pagina + 1) % total), INTERVALO_DESTAQUES_MS);
    return () => clearTimeout(id);
  }, [pagina, total, ativa, trocar]);
}

/**
 * Destaques paginados (card C), com o indicador de pontos. Trocam sozinhos a cada 6 s,
 * param enquanto o dedo está neles ou eles deslizam e, com "reduzir movimento", só trocam à mão.
 */
export function Destaques({ midias }: { midias: Midia[] }) {
  const { width } = useWindowDimensions();
  const reduzir = useReduzirMovimento();
  const lista = useRef<FlatList<Midia>>(null);
  const [pagina, setPagina] = useState(0);
  const [parado, setParado] = useState(false);
  const total = midias.length;

  const trocar = useCallback((proxima: number) => {
    lista.current?.scrollToIndex({ index: proxima, animated: true });
    setPagina(proxima);
  }, []);
  useTrocaAutomatica(pagina, total, !reduzir && !parado, trocar);

  return (
    <View accessibilityLabel="Destaques" className="gap-2.5">
      <FlatList
        ref={lista}
        horizontal
        pagingEnabled
        data={midias}
        keyExtractor={(m) => m.id_midia}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onTouchStart={() => setParado(true)}
        onTouchEnd={() => setParado(false)}
        onTouchCancel={() => setParado(false)}
        onScrollBeginDrag={() => setParado(true)}
        onMomentumScrollEnd={(e) => {
          setPagina(Math.round(e.nativeEvent.contentOffset.x / width));
          setParado(false);
        }}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: MARGEM }}>
            <CardInfo midia={item} largura={width - 2 * MARGEM} />
          </View>
        )}
      />
      {total > 1 ? (
        <View className="flex-row justify-center gap-1.5" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {midias.map((m, i) => (
            <View
              key={m.id_midia}
              className={`h-1.5 rounded-full ${i === pagina ? 'w-5 bg-marca' : 'w-1.5 bg-texto-suave/40'}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
