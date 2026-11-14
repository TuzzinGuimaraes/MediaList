import { ActivityIndicator, Text } from 'react-native';

import { usePaleta } from '../prototipo/PrototipoContext';
import { ToqueAnimado } from '../prototipo/PrototipoMovimento';

type Props = {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  variante?: 'primario' | 'secundario';
};

/** PROTÓTIPO (ticket 29): o primário é o carmesim da marca; toque com escala. */
export function Botao({ titulo, onPress, carregando = false, variante = 'primario' }: Props) {
  const paleta = usePaleta();
  const primario = variante === 'primario';
  return (
    <ToqueAnimado
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
        <ActivityIndicator color={primario ? paleta['sobre-marca'] : paleta.texto} />
      ) : (
        <Text className={`text-corpo font-semibold ${primario ? 'text-sobre-marca' : 'text-texto'}`}>{titulo}</Text>
      )}
    </ToqueAnimado>
  );
}
