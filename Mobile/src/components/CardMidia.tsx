import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { CartaoMidia } from '../api/tipos';
import { notasDaMidia, ROTULO_NOTA_MEDIA, tituloDaMidia } from '../dominio/midia';
import paleta from '../tema/paleta';
import { nomeDoTipo, SeloTipo } from './SeloTipo';

type Props = {
  midia: CartaoMidia;
  /** Largura fixa (carrossel) ou ocupando a coluna (grade). */
  largura?: number;
};

/**
 * Pôster, título, selo do Tipo de mídia e as notas (Nota dos Usuários, Nota da fonte),
 * cada uma com seu rótulo; tocar abre o detalhe da Mídia. As notas vão no valor de
 * acessibilidade, para o leitor de tela anunciá-las depois do título.
 */
export function CardMidia({ midia, largura }: Props) {
  const titulo = tituloDaMidia(midia);
  const notas = notasDaMidia(midia);
  return (
    <Link href={{ pathname: '/midia/[id]', params: { id: midia.id_midia } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${titulo}, ${nomeDoTipo(midia.tipo)}`}
        accessibilityValue={notas.length ? { text: notas.map((n) => `${n.rotulo} ${n.valor}`).join(', ') } : undefined}
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
        <Text numberOfLines={2} className="text-legenda text-text-primary">
          {titulo}
        </Text>
        <SeloTipo tipo={midia.tipo} />
        {notas.map((n) => (
          <View key={n.rotulo} className="flex-row items-center gap-1">
            <Ionicons
              name={n.rotulo === ROTULO_NOTA_MEDIA ? 'star' : 'star-outline'}
              size={12}
              color={paleta.accent.yellow}
            />
            <Text className="text-legenda font-bold text-accent-yellow">{n.valor}</Text>
            <Text numberOfLines={1} className="text-legenda text-text-secondary">
              {n.curto}
            </Text>
          </View>
        ))}
      </Pressable>
    </Link>
  );
}
