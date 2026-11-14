import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { useCores } from '../tema/TemaContext';
import { Toque } from './Toque';

type Props = {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  variante?: 'primario' | 'secundario';
  /** Ícone antes do título (ex. o botão grande do detalhe). */
  icone?: ComponentProps<typeof Ionicons>['name'];
};

/** O primário é o carmesim da marca; o secundário, neutro na superfície. */
export function Botao({ titulo, onPress, carregando = false, variante = 'primario', icone }: Props) {
  const cores = useCores();
  const primario = variante === 'primario';
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: carregando, busy: carregando }}
      disabled={carregando}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-2 rounded-md px-4 py-3 ${
        primario ? 'bg-marca active:bg-marca-forte' : 'border border-borda bg-superficie-alta'
      } ${carregando ? 'opacity-60' : ''}`}
    >
      {carregando ? (
        <ActivityIndicator color={primario ? cores['sobre-marca'] : cores.texto} />
      ) : (
        <>
          {icone ? <Ionicons name={icone} size={20} color={primario ? cores['sobre-marca'] : cores.texto} /> : null}
          <Text className={`text-corpo font-semibold ${primario ? 'text-sobre-marca' : 'text-texto'}`}>{titulo}</Text>
        </>
      )}
    </Toque>
  );
}
