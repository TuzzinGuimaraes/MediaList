import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** Nome do sheet para leitores de tela. */
  rotulo: string;
  aoFechar: () => void;
  /** Topo fixo (título); arrastá-lo para baixo fecha. */
  cabecalho: React.ReactNode;
  /** Conteúdo rolável dentro do sheet. */
  children: React.ReactNode;
  /** Rodapé fixo, sempre visível acima da safe area. */
  rodape: React.ReactNode;
};

/** Distância (pt) ou velocidade do arraste que fecha o sheet. */
const ARRASTE_FECHA = 96;
const VELOCIDADE_FECHA = 1.2;

/**
 * Bottom sheet com altura máxima de 85% da tela, conteúdo rolável dentro e rodapé fixo.
 * Fecha ao tocar fora, ao arrastar o topo para baixo e no botão voltar do Android.
 * Só RN puro (Modal, Animated, PanResponder): roda no Expo Go sem provider extra.
 */
export function BottomSheet({ rotulo, aoFechar, cabecalho, children, rodape }: Props) {
  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const [deslocamento] = useState(() => new Animated.Value(height));

  useEffect(() => {
    Animated.spring(deslocamento, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  }, [deslocamento]);

  // Arrastar o sheet não re-renderiza (só mexe no Animated.Value): o responder não é trocado no meio do gesto.
  const arraste = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => deslocamento.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > ARRASTE_FECHA || g.vy > VELOCIDADE_FECHA) {
            Animated.timing(deslocamento, { toValue: height, duration: 150, useNativeDriver: true }).start(aoFechar);
          } else {
            Animated.spring(deslocamento, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
          }
        },
      }),
    [deslocamento, height, aoFechar],
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={aoFechar} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={aoFechar}
          className="absolute inset-0 bg-black/60"
        />
        <Animated.View
          accessibilityLabel={rotulo}
          style={{ maxHeight: height * 0.85, transform: [{ translateY: deslocamento }] }}
          className="rounded-t-xl bg-dark-secondary"
        >
          <View {...arraste.panHandlers} className="px-5 pb-2 pt-2">
            <View className="mb-2 h-1 w-10 self-center rounded-full bg-dark-border" />
            {cabecalho}
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            className="shrink"
            contentContainerClassName="gap-3 px-5 pb-3"
          >
            {children}
          </ScrollView>
          <View
            className="gap-2 border-t border-dark-border px-5 pt-3"
            style={{ paddingBottom: Math.max(bottom, 12) }}
          >
            {rodape}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
