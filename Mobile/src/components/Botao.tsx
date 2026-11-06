import { ActivityIndicator, Pressable, Text } from 'react-native';

import paleta from '../tema/paleta';

type Props = {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  variante?: 'primario' | 'secundario';
};

export function Botao({ titulo, onPress, carregando = false, variante = 'primario' }: Props) {
  const primario = variante === 'primario';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: carregando, busy: carregando }}
      disabled={carregando}
      onPress={onPress}
      className={`items-center rounded-md px-4 py-3 ${
        primario ? 'bg-accent-blue active:bg-accent-blue-hover' : 'border border-dark-border bg-dark-tertiary'
      } ${carregando ? 'opacity-60' : ''}`}
    >
      {carregando ? (
        <ActivityIndicator color={primario ? paleta.dark.primary : paleta.text.primary} />
      ) : (
        <Text className={`text-corpo font-semibold ${primario ? 'text-dark-primary' : 'text-text-primary'}`}>
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}
