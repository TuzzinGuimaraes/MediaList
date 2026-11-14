import { useState } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useReduzirMovimento } from '../tema/movimento';

type Props = PressableProps & {
  className?: string;
  /** Estilo da caixa externa (largura, flex), que recebe a escala. */
  caixa?: StyleProp<ViewStyle>;
  /** Escala enquanto pressionado. */
  escala?: number;
};

const ENTRA_MS = 90;
const SAI_MS = 160;

/**
 * Pressable com micro-animação: encolhe e esmaece de leve enquanto pressionado.
 * Com "reduzir movimento", fica parado. Animated do RN, no driver nativo.
 */
export function Toque({ caixa, escala = 0.96, onPressIn, onPressOut, ...props }: Props) {
  const reduzir = useReduzirMovimento();
  const [pressao] = useState(() => new Animated.Value(0));
  const animar = (valor: number, duracao: number) => {
    if (reduzir) return;
    Animated.timing(pressao, { toValue: valor, duration: duracao, useNativeDriver: true }).start();
  };
  const estilo = {
    transform: [{ scale: pressao.interpolate({ inputRange: [0, 1], outputRange: [1, escala] }) }],
    opacity: pressao.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }),
  };
  return (
    <Animated.View style={[caixa, estilo]}>
      <Pressable
        onPressIn={(e) => {
          animar(1, ENTRA_MS);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          animar(0, SAI_MS);
          onPressOut?.(e);
        }}
        {...props}
      />
    </Animated.View>
  );
}
