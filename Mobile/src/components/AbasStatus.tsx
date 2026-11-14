import { Animated, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { type EstadoConsumo, NOMES_ESTADO } from '../dominio/estadoConsumo';
import { useCores } from '../tema/TemaContext';
import { corDoEstado } from './Selo';

const textos = {
  abas: 'Status da Lista',
};

/** Rótulos abreviados das abas: até 6 Status cabem na largura sem rolar. */
const ROTULO_CURTO_DA_ABA: Record<EstadoConsumo, string> = {
  em_progresso: 'Em prog.',
  planejado: 'Planej.',
  pausado: 'Pausado',
  abandonado: 'Aband.',
  concluido: 'Concl.',
  platinado: 'Platin.',
};

type PropsAbas = {
  estados: EstadoConsumo[];
  contagem: Record<EstadoConsumo, number>;
  ativa: number;
  /** Página atual com a fração do deslize, para o sublinhado acompanhar o dedo. */
  posicao: Animated.Value;
  ir(i: number): void;
};

/** Barra das páginas: rótulo curto e contagem, com o sublinhado carmesim acompanhando o deslize. */
export function AbasStatus({ estados, contagem, ativa, posicao, ir }: PropsAbas) {
  const cores = useCores();
  const { width } = useWindowDimensions();
  const largura = width / estados.length;
  const deslocamento = posicao.interpolate({
    inputRange: [0, Math.max(1, estados.length - 1)],
    outputRange: [0, largura * Math.max(1, estados.length - 1)],
  });
  return (
    <View className="border-b border-borda">
      <View accessibilityRole="tablist" accessibilityLabel={textos.abas} className="flex-row">
        {estados.map((e, i) => {
          const ativo = i === ativa;
          return (
            <Pressable
              key={e}
              accessibilityRole="tab"
              accessibilityLabel={`${NOMES_ESTADO[e]} (${contagem[e]})`}
              accessibilityState={{ selected: ativo }}
              onPress={() => ir(i)}
              className="items-center justify-center py-2"
              style={{ width: largura, minHeight: 48 }}
            >
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                className={`text-legenda ${ativo ? 'font-bold text-texto-forte' : 'font-semibold text-texto-suave'}`}
              >
                {ROTULO_CURTO_DA_ABA[e]}
              </Text>
              <Text
                maxFontSizeMultiplier={1.2}
                className={`text-legenda ${ativo ? 'text-marca-texto' : 'text-texto-suave'}`}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {contagem[e]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Animated.View
        pointerEvents="none"
        style={{ width: largura, height: 3, alignItems: 'center', transform: [{ translateX: deslocamento }] }}
      >
        <View style={{ width: largura * 0.6, height: 3, borderRadius: 2, backgroundColor: cores['marca-forte'] }} />
      </Animated.View>
    </View>
  );
}

/** Título da aba ativa, no estilo do cabeçalho de seção, com o nome e a cor do Status. */
export function TituloDaAba({ estado, n }: { estado: EstadoConsumo; n: number }) {
  const cor = corDoEstado(estado, useCores());
  return (
    <View className="flex-1 flex-row items-center gap-2">
      <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: cor }} />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        className="flex-shrink text-legenda font-bold uppercase tracking-wider"
        style={{ color: cor }}
      >
        {`${NOMES_ESTADO[estado]} · ${n}`}
      </Text>
    </View>
  );
}
