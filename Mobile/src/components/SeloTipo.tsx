import { Text, View } from 'react-native';

import { NOMES_TIPO, type TipoMidia } from '../dominio/estadoConsumo';

/** Nome do Tipo para exibir e para rótulos de acessibilidade; Tipo desconhecido passa como veio. */
export function nomeDoTipo(tipo: string): string {
  return NOMES_TIPO[tipo as TipoMidia] ?? tipo;
}

/**
 * Selo discreto com o nome do Tipo de mídia ("Anime", "Mangá", "Jogo").
 * PROTÓTIPO (ticket 29): neutro; a cor fica para o carmesim (marca) e os Status.
 */
export function SeloTipo({ tipo }: { tipo: string }) {
  return (
    <View className="self-start rounded-sm border border-borda px-1.5">
      <Text maxFontSizeMultiplier={1.3} className="text-legenda font-semibold text-texto-suave">
        {nomeDoTipo(tipo)}
      </Text>
    </View>
  );
}
