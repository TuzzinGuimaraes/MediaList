import { FlatList, Text, View } from 'react-native';

import type { CartaoMidia } from '../api/tipos';
import { CardMidia } from './CardMidia';
import { TituloSecao } from './Secao';

/** Largura do card A nos carrosséis. */
const LARGURA_CARD = 115;

type PropsFileira<T> = {
  titulo: string;
  itens: T[];
  chave(item: T): string;
  renderizar(item: T, indice: number): React.ReactElement;
  /** Espaço entre os cards (classe de gap). */
  espaco?: string;
  className?: string;
};

/** Fileira horizontal com título (Início, Sugestões da Lista); sem itens, não aparece. */
export function Fileira<T>({ titulo, itens, chave, renderizar, espaco = 'gap-3', className = '' }: PropsFileira<T>) {
  if (!itens.length) return null;
  return (
    <View accessibilityLabel={titulo} className={`gap-3 ${className}`}>
      <TituloSecao className="px-4">{titulo}</TituloSecao>
      <FlatList
        horizontal
        data={itens}
        keyExtractor={chave}
        renderItem={({ item, index }) => renderizar(item, index)}
        contentContainerClassName={`${espaco} px-4`}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

/** Carrossel de catálogo: card A. */
export function Carrossel({ titulo, midias, className }: { titulo: string; midias: CartaoMidia[]; className?: string }) {
  return (
    <Fileira
      titulo={titulo}
      itens={midias}
      chave={(m) => m.id_midia}
      renderizar={(m) => <CardMidia midia={m} largura={LARGURA_CARD} />}
      className={className}
    />
  );
}

/** Top 10 com o numeral grande ao lado do pôster. */
export function Top10({ titulo, midias }: { titulo: string; midias: CartaoMidia[] }) {
  return (
    <Fileira
      titulo={titulo}
      itens={midias}
      chave={(m) => m.id_midia}
      espaco="gap-1"
      renderizar={(m, i) => (
        <View className="flex-row items-end">
          <Text
            importantForAccessibility="no"
            className="font-bold text-texto-suave/40"
            style={{ fontSize: 104, lineHeight: 104, marginRight: -14, letterSpacing: -6 }}
          >
            {i + 1}
          </Text>
          <CardMidia midia={m} largura={LARGURA_CARD - 11} />
        </View>
      )}
    />
  );
}
