import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { useCores } from '../tema/TemaContext';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';
import { Toque } from './Toque';

const textos = {
  limpar: 'Limpar',
  aplicar: 'Ver resultados',
  filtros: 'Filtros',
  ativos: (n: number) => `${n} ${n === 1 ? 'ativo' : 'ativos'}`,
};

type PropsSheet = {
  titulo?: string;
  aoFechar: () => void;
  /** Volta todos os filtros ao padrão; sem ele, o botão Limpar não aparece. */
  limpar?: () => void;
  /** Os grupos de filtro (GrupoFiltro). */
  children: React.ReactNode;
};

/**
 * Sheet de filtros genérico (Lista e Explorar): os filtros valem na hora, e o rodapé tem
 * Limpar e Ver resultados, que só fecha.
 */
export function SheetFiltros({ titulo = textos.filtros, aoFechar, limpar, children }: PropsSheet) {
  return (
    <BottomSheet
      rotulo={titulo}
      aoFechar={aoFechar}
      cabecalho={
        <Text accessibilityRole="header" className="text-titulo-secao font-bold text-texto-forte">
          {titulo}
        </Text>
      }
      rodape={
        <View className="flex-row gap-2">
          {limpar ? (
            <View className="flex-1">
              <Botao titulo={textos.limpar} variante="secundario" onPress={limpar} />
            </View>
          ) : null}
          <View className="flex-[2]">
            <Botao titulo={textos.aplicar} onPress={aoFechar} />
          </View>
        </View>
      }
    >
      {children}
    </BottomSheet>
  );
}

type PropsGrupo<V> = {
  rotulo: string;
  opcoes: { valor: V; titulo: string }[];
  valor: V;
  escolher(valor: V): void;
};

/** Um filtro de escolha única dentro do sheet: rótulo e chips que quebram linha. */
export function GrupoFiltro<V>({ rotulo, opcoes, valor, escolher }: PropsGrupo<V>) {
  return (
    <View className="gap-1.5">
      <Text className="text-legenda text-texto-suave">{rotulo}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={rotulo} className="flex-row flex-wrap gap-2">
        {opcoes.map((opcao) => {
          const ativo = opcao.valor === valor;
          return (
            <Pressable
              key={opcao.titulo}
              accessibilityRole="radio"
              accessibilityLabel={opcao.titulo}
              accessibilityState={{ checked: ativo }}
              onPress={() => escolher(opcao.valor)}
              className={`min-h-[40px] justify-center rounded-full border px-3 py-1.5 ${
                ativo ? 'border-marca-texto bg-marca/15' : 'border-borda'
              }`}
            >
              <Text className={`text-corpo font-semibold ${ativo ? 'text-marca-texto' : 'text-texto-suave'}`}>
                {opcao.titulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Botão que abre o sheet, com o contador de filtros fora do padrão. */
export function BotaoFiltros({ ativos, onPress }: { ativos: number; onPress: () => void }) {
  const cores = useCores();
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={ativos ? `${textos.filtros}, ${textos.ativos(ativos)}` : textos.filtros}
      onPress={onPress}
      hitSlop={4}
      className={`min-h-[44px] flex-row items-center gap-1.5 rounded-md border px-3 ${
        ativos ? 'border-marca-texto' : 'border-borda'
      } bg-superficie-alta`}
    >
      <Ionicons name="options-outline" size={18} color={ativos ? cores['marca-texto'] : cores.texto} />
      <Text className={`text-corpo font-semibold ${ativos ? 'text-marca-texto' : 'text-texto'}`}>{textos.filtros}</Text>
      {ativos ? (
        <View className="min-w-[20px] items-center rounded-full bg-marca px-1.5">
          <Text maxFontSizeMultiplier={1.3} className="text-legenda font-bold text-sobre-marca">
            {ativos}
          </Text>
        </View>
      ) : null}
    </Toque>
  );
}
