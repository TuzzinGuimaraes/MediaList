import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { CartaoMidia } from '../api/tipos';
import { tituloDaMidia } from '../dominio/midia';

type Props = {
  midia: CartaoMidia;
  /** Largura fixa (carrossel) ou ocupando a coluna (grade). */
  largura?: number;
};

/** Pôster e título; tocar abre o detalhe da Mídia. */
export function CardMidia({ midia, largura }: Props) {
  const titulo = tituloDaMidia(midia);
  return (
    <Link href={{ pathname: '/midia/[id]', params: { id: midia.id_midia } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={titulo}
        className="gap-1.5 active:opacity-80"
        style={largura ? { width: largura } : { flex: 1 }}
      >
        <View className="aspect-[2/3] w-full overflow-hidden rounded bg-dark-tertiary">
          {midia.poster_url ? (
            <Image
              source={midia.poster_url}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="disk"
              transition={150}
              recyclingKey={midia.id_midia}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <Text numberOfLines={2} className="text-xs leading-tight text-text-primary">
          {titulo}
        </Text>
        <Text className="text-[10px] text-text-secondary">{midia.tipo_label}</Text>
      </Pressable>
    </Link>
  );
}
