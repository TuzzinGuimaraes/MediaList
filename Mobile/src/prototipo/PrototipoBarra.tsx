// PROTÓTIPO (ticket 29), descartável. Barra flutuante de variantes, só em __DEV__.
// Linha de cima: ‹ eixo ›. Linha de baixo: ‹ valor ›. Arraste pela alça (≡) para
// subir/descer; o botão × recolhe a barra numa bolinha no canto.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EIXOS, EM_TESTE, type Eixo, usePrototipo, type ValorDo } from './PrototipoContext';

const ORDEM = Object.keys(EIXOS) as Eixo[];
const AMARELO = '#FFD400';

function Seta({ icone, rotulo, aoTocar }: { icone: 'chevron-back' | 'chevron-forward'; rotulo: string; aoTocar(): void }) {
  return (
    <Pressable accessibilityLabel={rotulo} onPress={aoTocar} hitSlop={4} style={{ width: 40, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icone} size={20} color="#000" />
    </Pressable>
  );
}

export function PrototipoBarra() {
  const { valores, mudar } = usePrototipo();
  const insets = useSafeAreaInsets();
  const [eixo, setEixo] = useState<Eixo>('assinatura');
  const [aberta, setAberta] = useState(true);
  const [{ deslocamento, arraste }] = useState(() => {
    const d = new Animated.Value(0);
    let base = 0;
    const pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => d.setValue(base + g.dy),
      onPanResponderRelease: (_, g) => {
        base += g.dy;
      },
    });
    return { deslocamento: d, arraste: pan };
  });

  if (!__DEV__ || EM_TESTE) return null;

  const valoresDoEixo = EIXOS[eixo].valores as readonly { chave: string; nome: string }[];
  const i = valoresDoEixo.findIndex((v) => v.chave === valores[eixo]);
  const atual = valoresDoEixo[i];
  const ciclarValor = (passo: number) => {
    const n = valoresDoEixo.length;
    mudar(eixo, valoresDoEixo[(i + passo + n) % n].chave as ValorDo<typeof eixo>);
  };
  const ciclarEixo = (passo: number) => {
    const j = ORDEM.indexOf(eixo);
    setEixo(ORDEM[(j + passo + ORDEM.length) % ORDEM.length]);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 66,
        alignItems: aberta ? 'center' : 'flex-end',
        paddingHorizontal: 10,
        transform: [{ translateY: deslocamento }],
      }}
    >
      {aberta ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: AMARELO,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: '#000',
            elevation: 10,
          }}
        >
          <View {...arraste.panHandlers} style={{ width: 28, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="reorder-three" size={20} color="#000" />
          </View>
          <View style={{ minWidth: 230 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#0003' }}>
              <Seta icone="chevron-back" rotulo="Eixo anterior" aoTocar={() => ciclarEixo(-1)} />
              <Text style={{ flex: 1, textAlign: 'center', color: '#000', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
                {`eixo ${ORDEM.indexOf(eixo) + 1}/${ORDEM.length}: ${EIXOS[eixo].nome}`}
              </Text>
              <Seta icone="chevron-forward" rotulo="Próximo eixo" aoTocar={() => ciclarEixo(1)} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Seta icone="chevron-back" rotulo="Valor anterior" aoTocar={() => ciclarValor(-1)} />
              <Text numberOfLines={2} style={{ flex: 1, maxWidth: 230, textAlign: 'center', color: '#000', fontSize: 13, fontWeight: '700' }}>
                {`${eixo}: ${atual.chave} (${atual.nome})`}
              </Text>
              <Seta icone="chevron-forward" rotulo="Próximo valor" aoTocar={() => ciclarValor(1)} />
            </View>
          </View>
          <Pressable accessibilityLabel="Recolher barra do protótipo" onPress={() => setAberta(false)} style={{ width: 30, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={18} color="#000" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="Abrir barra do protótipo"
          onPress={() => setAberta(true)}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: AMARELO, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', elevation: 10 }}
        >
          <Ionicons name="color-palette" size={20} color="#000" />
        </Pressable>
      )}
    </Animated.View>
  );
}
