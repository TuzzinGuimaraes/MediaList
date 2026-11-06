import { ActivityIndicator, FlatList, View } from 'react-native';

import { useBuscaMidias } from '@/api/explorar';
import { CardMidia } from '@/components/CardMidia';
import { Carregando, Falha } from '@/components/EstadoTela';
import { SeletorRecorte } from '@/components/SeletorRecorte';
import paleta from '@/tema/paleta';

const COLUNAS = 3;

export default function Explorar() {
  const busca = useBuscaMidias({ tipo: 'anime', ordem: 'nota_media' });

  let conteudo: React.ReactNode;
  if (busca.data) {
    conteudo = (
      <FlatList
        accessibilityLabel="Resultados"
        data={busca.data}
        numColumns={COLUNAS}
        keyExtractor={(m) => m.id_midia}
        renderItem={({ item }) => (
          <View className="flex-1 px-1.5" style={{ maxWidth: `${100 / COLUNAS}%` }}>
            <CardMidia midia={item} />
          </View>
        )}
        contentContainerClassName="gap-4 px-2.5 pb-6"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (busca.hasNextPage && !busca.isFetchingNextPage) busca.fetchNextPage();
        }}
        ListFooterComponent={busca.isFetchingNextPage ? <ActivityIndicator color={paleta.accent.blue} /> : undefined}
      />
    );
  } else if (busca.isError) {
    conteudo = <Falha erro={busca.error} tentarDeNovo={() => busca.refetch()} />;
  } else {
    conteudo = <Carregando />;
  }

  return (
    <View className="flex-1 bg-dark-primary">
      <View className="gap-3 px-4 py-4">
        <SeletorRecorte />
      </View>
      {conteudo}
    </View>
  );
}
