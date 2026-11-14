import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentRef, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NOMES_RECORTE, type Recorte, useRecorte } from '../recorte/RecorteContext';
import { usePaleta } from '../prototipo/PrototipoContext';
import { useReduzirMovimento } from '../tema/movimento';

const RECORTES: Recorte[] = ['animanga', 'jogos'];
// PROTÓTIPO (ticket 29): a palavra Recorte some da tela; o leitor de tela diz "Catálogo".
const ROTULO = 'Catálogo';
const ABRIR_MS = 150;
const FECHAR_MS = 100;

type Ancora = { topo: number; direita: number };

/**
 * Pílula do Recorte de catálogo no cabeçalho de Início, Explorar e Lista.
 * Abre um menu ancorado com as duas opções; só troca ao escolher a outra.
 */
export function SeletorRecorte() {
  const paleta = usePaleta();
  const { recorte, destino, escolher } = useRecorte();
  const reduzir = useReduzirMovimento();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pilula = useRef<ComponentRef<typeof View>>(null);
  const [aberto, setAberto] = useState(false);
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const [entrada] = useState(() => new Animated.Value(0));
  const emTransicao = destino !== recorte;

  function abrir() {
    pilula.current?.measureInWindow((x, y, w, h) => setAncora({ topo: y + h + 4, direita: width - x - w }));
    setAberto(true);
    entrada.stopAnimation();
    if (reduzir) entrada.setValue(1);
    else {
      entrada.setValue(0);
      Animated.timing(entrada, { toValue: 1, duration: ABRIR_MS, useNativeDriver: true }).start();
    }
    AccessibilityInfo.announceForAccessibility(`Menu ${ROTULO} aberto`);
  }

  function fechar() {
    entrada.stopAnimation();
    if (reduzir) setAberto(false);
    else Animated.timing(entrada, { toValue: 0, duration: FECHAR_MS, useNativeDriver: true }).start(() => setAberto(false));
  }

  function opcao(r: Recorte) {
    if (r !== destino) escolher(r);
    fechar();
  }

  // Sem medida (ainda), o menu fica logo abaixo do cabeçalho, à direita.
  const posicao = ancora ?? { topo: insets.top + 56, direita: 12 };
  const escala = entrada.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <>
      <Pressable
        ref={pilula}
        accessibilityRole="button"
        accessibilityLabel={`${ROTULO}: ${NOMES_RECORTE[destino]}`}
        accessibilityHint="Abre o menu para trocar o catálogo"
        accessibilityState={{ expanded: aberto }}
        onPress={abrir}
        hitSlop={4}
        style={{ minHeight: 44, justifyContent: 'center', marginRight: 12 }}
      >
        <View
          className={`flex-row items-center gap-1 rounded-full border px-3 py-1.5 ${
            emTransicao ? 'border-accent-blue bg-dark-tertiary' : 'border-dark-border bg-dark-secondary'
          }`}
        >
          <Text maxFontSizeMultiplier={1.3} className="text-legenda font-semibold text-accent-blue">
            {NOMES_RECORTE[destino]}
          </Text>
          <Ionicons name="chevron-down" size={14} color={paleta.text.secondary} />
        </View>
      </Pressable>
      <Modal transparent statusBarTranslucent visible={aberto} animationType="none" onRequestClose={fechar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar menu"
          onPress={fechar}
          className="absolute inset-0"
        />
        <Animated.View
          accessibilityRole="menu"
          accessibilityLabel={ROTULO}
          onAccessibilityEscape={fechar}
          className="rounded-md border border-dark-border bg-dark-secondary py-1"
          style={{
            position: 'absolute',
            top: posicao.topo,
            right: posicao.direita,
            minWidth: 200,
            elevation: 8,
            opacity: entrada,
            transform: [{ scale: escala }],
          }}
        >
          {RECORTES.map((r) => {
            const atual = r === destino;
            return (
              <Pressable
                key={r}
                accessibilityRole="menuitem"
                accessibilityLabel={NOMES_RECORTE[r]}
                accessibilityState={{ selected: atual }}
                onPress={() => opcao(r)}
                className="flex-row items-center justify-between gap-4 px-4"
                style={{ minHeight: 48 }}
              >
                <Text className={`text-corpo ${atual ? 'font-semibold text-accent-blue' : 'text-text-primary'}`}>
                  {NOMES_RECORTE[r]}
                </Text>
                {atual ? <Ionicons name="checkmark" size={18} color={paleta.accent.blue} /> : null}
              </Pressable>
            );
          })}
        </Animated.View>
      </Modal>
    </>
  );
}
