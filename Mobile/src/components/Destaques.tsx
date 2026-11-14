import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Text, useWindowDimensions, View } from 'react-native';

import { usePosicaoTop10 } from '../api/midias';
import type { ItemLista, Midia } from '../api/tipos';
import { estadoDe, nomeDoTipo } from '../dominio/estadoConsumo';
import { notasDaMidia, tituloDaMidia } from '../dominio/midia';
import { useReduzirMovimento } from '../tema/movimento';
import { useCores } from '../tema/TemaContext';
import { FioProgresso } from './FioProgresso';
import { SeloStatus, SeloTop } from './Selo';
import { Toque } from './Toque';

export const INTERVALO_DESTAQUES_MS = 6000;

/** Fração da altura da tela que cada destaque ocupa. */
const FRACAO_DA_ALTURA = 0.46;

const textos = {
  destaques: 'Destaques',
  adicionar: 'Adicionar à Lista',
  editar: 'Editar',
  detalhes: 'Detalhes',
};

/**
 * Pede a página seguinte (da última, a primeira) a cada intervalo, enquanto `ativa`. Mudar
 * de página recomeça a contagem. `trocar` precisa ser estável (useCallback).
 */
export function useTrocaAutomatica(pagina: number, total: number, ativa: boolean, trocar: (proxima: number) => void) {
  useEffect(() => {
    if (!ativa || total < 2) return;
    const id = setTimeout(() => trocar((pagina + 1) % total), INTERVALO_DESTAQUES_MS);
    return () => clearTimeout(id);
  }, [pagina, total, ativa, trocar]);
}

type PropsDestaque = {
  midia: Midia;
  /** `undefined` enquanto a Lista não carregou (o botão da Lista espera); `null` fora dela. */
  item: ItemLista | null | undefined;
  largura: number;
  altura: number;
  aoEditar(): void;
};

/**
 * Uma página dos destaques, em tela cheia: banner (ou o pôster desfocado) com gradiente até
 * o fundo, pôster com o fio de progresso, Tipo e Gêneros, título, nota, Status e as ações
 * "Adicionar à Lista"/"Editar" e "Detalhes".
 */
function Destaque({ midia, item, largura, altura, aoEditar }: PropsDestaque) {
  const cores = useCores();
  const router = useRouter();
  const top = usePosicaoTop10(midia.id_midia);
  const titulo = tituloDaMidia(midia);
  const nota = notasDaMidia(midia)[0];
  const estado = item ? estadoDe(item.status_consumo, item.tipo) : null;
  const imagem = midia.banner_url ?? midia.poster_url;
  const abrir = () => router.push({ pathname: '/midia/[id]', params: { id: midia.id_midia } });
  const generos = midia.generos_lista?.slice(0, 2) ?? [];

  return (
    <View style={{ width: largura, height: altura }} className="overflow-hidden bg-superficie">
      <View className="absolute inset-0" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {imagem ? (
          <Image
            source={imagem}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            contentFit="cover"
            blurRadius={midia.banner_url ? 0 : 18}
            cachePolicy="disk"
            transition={200}
            recyclingKey={`${midia.id_midia}-destaque`}
          />
        ) : null}
        <View
          className="absolute inset-0"
          style={{ backgroundImage: `linear-gradient(to bottom, transparent 20%, ${cores.fundo}CC 65%, ${cores.fundo} 100%)` }}
        />
      </View>
      {top ? (
        <View className="absolute right-0 top-0">
          <SeloTop posicao={top} />
        </View>
      ) : null}
      <View className="absolute bottom-5 left-0 right-0 flex-row items-end gap-4 px-4">
        <Toque
          accessibilityRole="link"
          accessibilityLabel={`${titulo}, ${nomeDoTipo(midia.tipo)}`}
          accessibilityValue={nota ? { text: `${nota.rotulo} ${nota.valor}` } : undefined}
          onPress={abrir}
        >
          <View className="aspect-[2/3] w-24 overflow-hidden rounded-md bg-superficie-alta" style={{ elevation: 6 }}>
            {midia.poster_url ? (
              <Image source={midia.poster_url} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" />
            ) : null}
            {item ? <FioProgresso item={item} /> : null}
          </View>
        </Toque>
        <View className="flex-1 gap-1.5">
          <Text numberOfLines={1} className="text-legenda font-semibold uppercase tracking-widest text-marca-texto">
            {[nomeDoTipo(midia.tipo), ...generos].join(' · ')}
          </Text>
          <Text numberOfLines={2} className="text-titulo-secao font-bold text-texto-forte">
            {titulo}
          </Text>
          <View className="flex-row items-center gap-3">
            {nota ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={14} color={cores.nota} />
                <Text className="text-legenda font-bold text-nota">{nota.valor}</Text>
              </View>
            ) : null}
            {estado ? <SeloStatus estado={estado} /> : null}
          </View>
          <View className="mt-1 flex-row gap-2">
            {item !== undefined ? (
              <Toque
                accessibilityRole="button"
                accessibilityLabel={`${item ? textos.editar : textos.adicionar}: ${titulo}`}
                onPress={aoEditar}
                className="flex-row items-center gap-1.5 rounded-md bg-marca px-4 py-2 active:bg-marca-forte"
              >
                <Ionicons name={item ? 'create-outline' : 'add'} size={18} color={cores['sobre-marca']} />
                <Text className="text-corpo font-bold text-sobre-marca">{item ? textos.editar : textos.adicionar}</Text>
              </Toque>
            ) : null}
            <Toque
              accessibilityRole="button"
              accessibilityLabel={`${textos.detalhes}: ${titulo}`}
              onPress={abrir}
              className="flex-row items-center gap-1.5 rounded-md bg-texto-forte/15 px-4 py-2"
            >
              <Ionicons name="information-circle-outline" size={18} color={cores['texto-forte']} />
              <Text className="text-corpo font-bold text-texto-forte">{textos.detalhes}</Text>
            </Toque>
          </View>
        </View>
      </View>
    </View>
  );
}

type Props = {
  midias: Midia[];
  /** Itens da Lista; `undefined` enquanto ela carrega. */
  itens: ItemLista[] | undefined;
  /** Abre o editor do Item (adicionar, se `item` for null). */
  aoEditar(midia: Midia, item: ItemLista | null): void;
};

/**
 * Destaques paginados em tela cheia, com o indicador de pontos. Trocam sozinhos a cada 6 s,
 * param enquanto o dedo está neles ou eles deslizam e, com "reduzir movimento", só trocam à mão.
 */
export function Destaques({ midias, itens, aoEditar }: Props) {
  const { width, height } = useWindowDimensions();
  const reduzir = useReduzirMovimento();
  const lista = useRef<FlatList<Midia>>(null);
  const [pagina, setPagina] = useState(0);
  const [parado, setParado] = useState(false);
  const total = midias.length;
  const altura = Math.round(height * FRACAO_DA_ALTURA);

  const trocar = useCallback((proxima: number) => {
    lista.current?.scrollToIndex({ index: proxima, animated: true });
    setPagina(proxima);
  }, []);
  useTrocaAutomatica(pagina, total, !reduzir && !parado, trocar);

  return (
    <View accessibilityLabel={textos.destaques} className="gap-2.5">
      <FlatList
        ref={lista}
        horizontal
        pagingEnabled
        data={midias}
        keyExtractor={(m) => m.id_midia}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onTouchStart={() => setParado(true)}
        onTouchEnd={() => setParado(false)}
        onTouchCancel={() => setParado(false)}
        onScrollBeginDrag={() => setParado(true)}
        onMomentumScrollEnd={(e) => {
          setPagina(Math.round(e.nativeEvent.contentOffset.x / width));
          setParado(false);
        }}
        renderItem={({ item: midia }) => {
          const item = itens ? (itens.find((i) => i.id_midia === midia.id_midia) ?? null) : undefined;
          return (
            <Destaque
              midia={midia}
              item={item}
              largura={width}
              altura={altura}
              aoEditar={() => aoEditar(midia, item ?? null)}
            />
          );
        }}
      />
      {total > 1 ? (
        <View className="flex-row justify-center gap-1.5" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {midias.map((m, i) => (
            <View
              key={m.id_midia}
              className={`h-1.5 rounded-full ${i === pagina ? 'w-5 bg-marca' : 'w-1.5 bg-texto-suave/40'}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
