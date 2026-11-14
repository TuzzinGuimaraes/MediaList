// PROTÓTIPO (ticket 29), descartável. Transição compartilhada do pôster, card -> detalhe,
// feita à mão: o `sharedTransitionTag` do Reanimated 4.7.1 depende da flag estática
// ENABLE_SHARED_ELEMENT_TRANSITIONS, que exige build nativo (não liga no Expo Go).
//
// Como funciona: ao tocar no card, `partir` mede o pôster na janela e mostra uma cópia
// dele num overlay acima da navegação. O detalhe abre com fade; o pôster de destino
// (PosterDestino) se mede e chama `chegar`; a cópia voa do retângulo do card até o do
// detalhe e some, revelando o pôster real. Só ida: a volta usa a transição normal.
import { Image } from 'expo-image';
import { type ComponentRef, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useEixo } from './PrototipoContext';
import { useAnimar } from './PrototipoMovimento';

export type Retangulo = { x: number; y: number; w: number; h: number };

type Voo = { id: string; uri: string; origem: Retangulo; raio: number };

type Valor = {
  ativa: boolean;
  /** Id da Mídia cujo pôster está em voo: o destino fica invisível até a cópia pousar. */
  emVoo: string | null;
  partir(voo: Voo): void;
  chegar(id: string, destino: Retangulo, raio: number): void;
};

const Contexto = createContext<Valor>({ ativa: false, emVoo: null, partir: () => {}, chegar: () => {} });

const DURACAO = 420;

export function PrototipoTransicaoProvider({ children }: { children: React.ReactNode }) {
  const animar = useAnimar();
  const ativa = useEixo('animacao') === 'compartilhada' && animar;
  const [voo, setVoo] = useState<Voo | null>(null);
  const [emVoo, setEmVoo] = useState<string | null>(null);
  const chegou = useRef(false);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const r = useSharedValue(0);
  const opacidade = useSharedValue(0);

  const encerrar = useCallback(() => {
    setVoo(null);
    setEmVoo(null);
  }, []);

  const partir = useCallback(
    (v: Voo) => {
      chegou.current = false;
      x.set(v.origem.x);
      y.set(v.origem.y);
      w.set(v.origem.w);
      h.set(v.origem.h);
      r.set(v.raio);
      opacidade.set(1);
      setVoo(v);
      setEmVoo(v.id);
    },
    [x, y, w, h, r, opacidade],
  );

  const chegar = useCallback(
    (id: string, d: Retangulo, raio: number) => {
      if (!voo || voo.id !== id || chegou.current) return;
      chegou.current = true;
      const curva = { duration: DURACAO, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
      x.set(withTiming(d.x, curva));
      y.set(withTiming(d.y, curva));
      w.set(withTiming(d.w, curva));
      r.set(withTiming(raio, curva));
      h.set(
        withTiming(d.h, curva, (fim) => {
          if (!fim) return;
          runOnJS(setEmVoo)(null);
          opacidade.set(withTiming(0, { duration: 140 }, () => runOnJS(setVoo)(null)));
        }),
      );
    },
    [voo, x, y, w, h, r, opacidade],
  );

  // Rede de segurança: se o destino nunca se medir (erro, tela sem pôster), a cópia some.
  useEffect(() => {
    if (!voo) return;
    const t = setTimeout(() => {
      if (!chegou.current) encerrar();
    }, 1500);
    return () => clearTimeout(t);
  }, [voo, encerrar]);

  const estilo = useAnimatedStyle(() => ({
    left: x.get(),
    top: y.get(),
    width: w.get(),
    height: h.get(),
    borderRadius: r.get(),
    opacity: opacidade.get(),
  }));

  const valor = useMemo(() => ({ ativa, emVoo, partir, chegar }), [ativa, emVoo, partir, chegar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      {voo ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={[{ position: 'absolute', overflow: 'hidden' }, estilo]}>
            <Image source={voo.uri} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" />
          </Animated.View>
        </View>
      ) : null}
    </Contexto.Provider>
  );
}

export function useTransicaoPoster() {
  return useContext(Contexto);
}

type PropsDestino = {
  id: string;
  uri: string | null;
  raio?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
  children?: React.ReactNode;
};

/** Pôster de destino no detalhe: se há um voo para esta Mídia, se mede e recebe a cópia. */
export function PosterDestino({ id, uri, raio = 6, style, className, children }: PropsDestino) {
  const { emVoo, chegar } = useTransicaoPoster();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const esperando = emVoo === id;
  return (
    <View
      ref={ref}
      collapsable={false}
      className={className}
      style={[style, esperando ? { opacity: 0 } : null]}
      onLayout={() => {
        if (!esperando) return;
        // Um quadro depois do layout, para a medida já sair na posição final.
        requestAnimationFrame(() =>
          ref.current?.measureInWindow((x, y, w, h) => {
            if (w > 0 && h > 0) chegar(id, { x, y, w, h }, raio);
          }),
        );
      }}
    >
      {uri ? (
        <Image
          source={uri}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="disk"
          transition={esperando ? 0 : 150}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {children}
    </View>
  );
}
