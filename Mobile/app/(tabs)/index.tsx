import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';

import { useEmAlta, usePopulares } from '@/api/midias';
import type { CartaoMidia } from '@/api/tipos';
import { CardMidia } from '@/components/CardMidia';
import { Carregando, Falha } from '@/components/EstadoTela';
import { ConteudoRecorte, useRecorte } from '@/recorte/RecorteContext';
import paleta from '@/tema/paleta';

const textos = {
  emAlta: 'Em alta',
  emAltaVazio: 'Nenhuma Mídia neste Recorte ainda.',
  populares: 'Populares',
  popularesVazio: 'Nenhuma Mídia popular neste Recorte ainda.',
};

function Secao({ titulo, midias, vazio }: { titulo: string; midias: CartaoMidia[]; vazio: string }) {
  return (
    <View accessibilityLabel={titulo} className="gap-3">
      <Text className="px-4 text-sm font-bold uppercase tracking-wider text-text-secondary">{titulo}</Text>
      {midias.length === 0 ? (
        <Text className="px-4 text-text-secondary">{vazio}</Text>
      ) : (
        <FlatList
          horizontal
          data={midias}
          keyExtractor={(m) => m.id_midia}
          renderItem={({ item }) => <CardMidia midia={item} largura={115} />}
          contentContainerClassName="gap-3 px-4"
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
}

export default function Inicio() {
  const { recorte } = useRecorte();
  const emAlta = useEmAlta(recorte);
  const populares = usePopulares(recorte);
  const [atualizando, setAtualizando] = useState(false);

  async function atualizar() {
    setAtualizando(true);
    await Promise.all([emAlta.refetch(), populares.refetch()]);
    setAtualizando(false);
  }

  let conteudo: React.ReactNode;
  if (emAlta.data && populares.data) {
    conteudo = (
      <>
        <Secao titulo={textos.emAlta} midias={emAlta.data} vazio={textos.emAltaVazio} />
        <Secao titulo={textos.populares} midias={populares.data} vazio={textos.popularesVazio} />
      </>
    );
  } else if (emAlta.isError || populares.isError) {
    conteudo = <Falha erro={emAlta.error ?? populares.error} tentarDeNovo={atualizar} />;
  } else {
    conteudo = <Carregando />;
  }

  return (
    <ConteudoRecorte>
      <ScrollView
        testID="inicio"
        className="flex-1 bg-dark-primary"
        contentContainerClassName="flex-grow gap-6 py-4"
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={atualizar}
            tintColor={paleta.accent.blue}
            colors={[paleta.accent.blue]}
            progressBackgroundColor={paleta.dark.secondary}
          />
        }
      >
        {conteudo}
      </ScrollView>
    </ConteudoRecorte>
  );
}
