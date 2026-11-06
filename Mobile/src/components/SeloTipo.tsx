import { Text, View } from 'react-native';

import { NOMES_TIPO, type TipoMidia } from '../dominio/estadoConsumo';
import paleta from '../tema/paleta';

/** Cor de cada Tipo de mídia, dentro da paleta do app. */
const CORES_TIPO: Record<TipoMidia, string> = {
  anime: paleta.accent.blue,
  manga: paleta.accent.green,
  jogo: paleta.accent.orange,
};

/** Nome do Tipo para exibir e para rótulos de acessibilidade; Tipo desconhecido passa como veio. */
export function nomeDoTipo(tipo: string): string {
  return NOMES_TIPO[tipo as TipoMidia] ?? tipo;
}

/** Selo discreto com o nome do Tipo de mídia ("Anime", "Mangá", "Jogo"), na cor do Tipo. */
export function SeloTipo({ tipo }: { tipo: string }) {
  const cor = CORES_TIPO[tipo as TipoMidia] ?? paleta.text.secondary;
  return (
    <View className="self-start rounded-sm border px-1.5" style={{ borderColor: cor }}>
      <Text maxFontSizeMultiplier={1.3} className="text-legenda font-semibold" style={{ color: cor }}>
        {nomeDoTipo(tipo)}
      </Text>
    </View>
  );
}
