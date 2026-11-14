import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { FlatList, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import type { ItemLista } from '../api/tipos';
import { useCores } from '../tema/TemaContext';
import { type AcoesDoItem, LinhaDaLista } from './LinhaItem';
import { SeletorRecorte } from './SeletorRecorte';
import { BotaoFiltros, type ControleDosFiltros } from './SheetFiltros';

const textos = {
  resultados: 'Resultados da busca',
  semResultado: (termo: string) => `Nada na Lista com "${termo}".`,
  buscar: 'Buscar na Lista',
  fecharBusca: 'Fechar a busca',
};

/**
 * A lupa ao lado da pílula do catálogo vira o campo de busca no lugar do título.
 * `busca` null: fechada; texto: o campo aberto com ele.
 */
export function useCabecalhoDeBusca(busca: string | null, setBusca: (b: string | null) => void) {
  const navigation = useNavigation();
  const cores = useCores();
  const { width } = useWindowDimensions();
  const aberta = busca !== null;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: aberta
        ? () => (
            <TextInput
              accessibilityLabel={textos.buscar}
              placeholder={textos.buscar}
              placeholderTextColor={cores['texto-suave']}
              value={busca}
              onChangeText={setBusca}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              className="text-campo text-texto-forte"
              style={{ width: width - 96, minHeight: 44 }}
            />
          )
        : undefined,
      headerRight: () => (
        <View className="flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={aberta ? textos.fecharBusca : textos.buscar}
            onPress={() => setBusca(aberta ? null : '')}
            hitSlop={4}
            className="h-11 w-11 items-center justify-center active:opacity-60"
            style={aberta ? { marginRight: 8 } : undefined}
          >
            <Ionicons name={aberta ? 'close' : 'search'} size={22} color={cores['texto-forte']} />
          </Pressable>
          {aberta ? null : <SeletorRecorte />}
        </View>
      ),
    });
  }, [navigation, aberta, busca, setBusca, cores, width]);
}

type PropsResultados = {
  itens: ItemLista[];
  termo: string;
  filtros: ControleDosFiltros;
  acoes: AcoesDoItem;
};

/** Com texto na busca, as páginas dão lugar a uma lista única, de todos os Status; os filtros seguem valendo. */
export function ResultadosDaBusca({ itens, termo, filtros, acoes }: PropsResultados) {
  return (
    <>
      <View className="flex-row justify-end px-4 pt-3">
        <BotaoFiltros ativos={filtros.ativos} onPress={filtros.abrir} />
      </View>
      <FlatList<ItemLista>
        accessibilityLabel={textos.resultados}
        data={itens}
        keyExtractor={(i) => i.id_lista}
        renderItem={({ item }) => <LinhaDaLista item={item} acoes={acoes} />}
        ListEmptyComponent={
          <Text className="p-6 text-center text-corpo text-texto-suave">{textos.semResultado(termo)}</Text>
        }
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-3 pb-6 pt-3"
      />
    </>
  );
}
