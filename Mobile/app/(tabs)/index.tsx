import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';

import { useAtualizar } from '@/api/consulta';

import { useEmAlta, usePopulares } from '@/api/midias';
import type { CartaoMidia } from '@/api/tipos';
import { CardMidia } from '@/components/CardMidia';
import { Carregando, Falha } from '@/components/EstadoTela';
import { TituloSecao } from '@/components/Secao';
import { ConteudoRecorte, useRecorte } from '@/recorte/RecorteContext';

const textos = {
  emAlta: 'Em alta',
  emAltaVazio: 'Nenhuma Mídia neste catálogo ainda.',
  populares: 'Populares',
  popularesVazio: 'Nenhuma Mídia popular neste catálogo ainda.',
};

/** Carrossel de cards com o cabeçalho de seção. */
function Carrossel({ titulo, midias, vazio }: { titulo: string; midias: CartaoMidia[]; vazio: string }) {
  return (
    <View accessibilityLabel={titulo} className="gap-3">
      <TituloSecao className="px-4">{titulo}</TituloSecao>
      {midias.length === 0 ? (
        <Text className="px-4 text-corpo text-texto-suave">{vazio}</Text>
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
  const atualizar = useAtualizar([emAlta, populares]);

  let conteudo: React.ReactNode;
  if (emAlta.data && populares.data) {
    conteudo = (
      <>
        <Carrossel titulo={textos.emAlta} midias={emAlta.data} vazio={textos.emAltaVazio} />
        <Carrossel titulo={textos.populares} midias={populares.data} vazio={textos.popularesVazio} />
      </>
    );
  } else if (emAlta.isError || populares.isError) {
    conteudo = <Falha erro={emAlta.error ?? populares.error} tentarDeNovo={atualizar.onRefresh} />;
  } else {
    conteudo = <Carregando />;
  }

  return (
    <ConteudoRecorte>
      <ScrollView
        testID="inicio"
        className="flex-1 bg-fundo"
        contentContainerClassName="flex-grow gap-6 py-4"
        refreshControl={<RefreshControl {...atualizar} />}
      >
        {conteudo}
      </ScrollView>
    </ConteudoRecorte>
  );
}
