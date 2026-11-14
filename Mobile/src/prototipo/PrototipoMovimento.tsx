// PROTÓTIPO (ticket 29), descartável. Micro-animações: feedback de toque (escala +
// opacidade), entrada escalonada de listas e carrosséis. Tudo some com "reduzir movimento".
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReduzirMovimento } from '../tema/movimento';

/** Anima só se o sistema não pede movimento reduzido. */
export function useAnimar(): boolean {
  return !useReduzirMovimento();
}

type PropsToque = PressableProps & {
  className?: string;
  /** Estilo da caixa externa (largura, flex), que recebe a escala. */
  caixa?: StyleProp<ViewStyle>;
  escala?: number;
};

/** Pressable que encolhe e esmaece levemente enquanto pressionado. */
export function ToqueAnimado({ caixa, escala = 0.96, onPressIn, onPressOut, ...props }: PropsToque) {
  const animar = useAnimar();
  const p = useSharedValue(0);
  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - escala) * p.get() }],
    opacity: 1 - 0.15 * p.get(),
  }));
  return (
    <Animated.View style={[caixa, estilo]}>
      <Pressable
        onPressIn={(e) => {
          if (animar) p.set(withTiming(1, { duration: 90 }));
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          if (animar) p.set(withTiming(0, { duration: 160 }));
          onPressOut?.(e);
        }}
        {...props}
      />
    </Animated.View>
  );
}

type PropsEntrada = {
  indice?: number;
  direcao?: 'baixo' | 'direita' | 'fade';
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/** Entrada escalonada (Reanimated `entering`): cada item atrasa um pouco mais que o anterior. */
export function Entrada({ indice = 0, direcao = 'baixo', style, children }: PropsEntrada) {
  const animar = useAnimar();
  const atraso = Math.min(indice, 8) * 50;
  const base = direcao === 'direita' ? FadeInRight : direcao === 'fade' ? FadeIn : FadeInDown;
  return (
    <Animated.View style={style} entering={animar ? base.delay(atraso).duration(320) : undefined}>
      {children}
    </Animated.View>
  );
}
