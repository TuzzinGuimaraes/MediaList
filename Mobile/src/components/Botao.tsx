import { ActivityIndicator, Text } from 'react-native';

import { useCores } from '../tema/TemaContext';
import { Toque } from './Toque';

type Props = {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  variante?: 'primario' | 'secundario';
};

/** O primário é o carmesim da marca; o secundário, neutro na superfície. */
export function Botao({ titulo, onPress, carregando = false, variante = 'primario' }: Props) {
  const cores = useCores();
  const primario = variante === 'primario';
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: carregando, busy: carregando }}
      disabled={carregando}
      onPress={onPress}
      className={`items-center rounded-md px-4 py-3 ${
        primario ? 'bg-marca active:bg-marca-forte' : 'border border-borda bg-superficie-alta'
      } ${carregando ? 'opacity-60' : ''}`}
    >
      {carregando ? (
        <ActivityIndicator color={primario ? cores['sobre-marca'] : cores.texto} />
      ) : (
        <Text className={`text-corpo font-semibold ${primario ? 'text-sobre-marca' : 'text-texto'}`}>{titulo}</Text>
      )}
    </Toque>
  );
}
