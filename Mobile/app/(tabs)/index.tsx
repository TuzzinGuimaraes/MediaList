// PROTÓTIPO (ticket 29), 2ª rodada: só o layout A do Início (Netflix), com os destaques
// paginados (até 5 Mídias de Em alta, troca a cada 6 s, pausa ao tocar/arrastar) e os
// carrosséis Continuar / Em alta / Top 10. O estilo dos cards sai do eixo `card`.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { useLista } from '@/api/lista';
import { useEmAlta, usePopulares } from '@/api/midias';
import type { ItemLista, Midia, MidiaPopular } from '@/api/tipos';
import { CardMidia, useLarguraCard } from '@/components/CardMidia';
import { EditorItem } from '@/components/EditorItem';
import { Carregando, Falha } from '@/components/EstadoTela';
import { estadoDe, type TipoMidia } from '@/dominio/estadoConsumo';
import { totalDoItem } from '@/dominio/itemLista';
import { notasDaMidia, tituloDaMidia } from '@/dominio/midia';
import { alturaDoCorte, BannerAssinado, FioProgresso } from '@/prototipo/PrototipoAssinatura';
import { EM_TESTE, useAssinatura, usePaleta } from '@/prototipo/PrototipoContext';
import { Entrada, ToqueAnimado, useAnimar } from '@/prototipo/PrototipoMovimento';
import { SeloStatus, SeloTop, useSelos } from '@/prototipo/PrototipoSelos';
import { ConteudoRecorte, TIPOS_DO_RECORTE, useRecorte } from '@/recorte/RecorteContext';

const textos = {
  emAlta: 'Em alta',
  emAltaVazio: 'Nenhuma Mídia neste catálogo ainda.',
  popularesVazio: 'Nenhuma Mídia popular neste catálogo ainda.',
  top10: 'Top 10 de hoje',
  continuar: 'Continuar',
  destaques: 'Destaques',
  adicionar: 'Adicionar à Lista',
  naLista: 'Na Lista',
  detalhes: 'Detalhes',
};

const MAX_DESTAQUES = 5;
const INTERVALO_MS = 6000;

/** Título de seção no estilo da pele nova: forte, sem caixa alta. */
function TituloSecao({ children }: { children: string }) {
  return <Text className="px-4 text-titulo-secao font-bold text-texto-forte">{children}</Text>;
}

/**
 * Uma página dos destaques, no espírito do card C: banner (ou pôster desfocado) ao fundo,
 * pôster pequeno, título, nota, Status e as ações.
 */
function Destaque({
  midia,
  item,
  altura,
  largura,
  aoAdicionar,
}: {
  midia: Midia;
  item: ItemLista | null | undefined;
  altura: number;
  largura: number;
  aoAdicionar(): void;
}) {
  const paleta = usePaleta();
  const router = useRouter();
  const { estado, top } = useSelos(midia);
  const corte = useAssinatura('diagonal') ? alturaDoCorte(largura) : 0;
  const nota = notasDaMidia(midia)[0];
  const titulo = tituloDaMidia(midia);
  return (
    <BannerAssinado
      midia={midia}
      largura={largura}
      altura={altura}
      imagem={midia.banner_url ?? midia.poster_url}
      desfocar={!midia.banner_url}
      estilo="destaque"
    >
      {top ? (
        <View className="absolute right-0 top-0">
          <SeloTop posicao={top} />
        </View>
      ) : null}
      <View className="absolute left-0 right-0 flex-row items-end gap-4 px-4" style={{ bottom: 18 + corte }}>
        <View className="w-24 overflow-hidden rounded-md bg-superficie-alta" style={{ aspectRatio: 2 / 3, elevation: 6 }}>
          {midia.poster_url ? (
            <Image source={midia.poster_url} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" />
          ) : null}
          <FioProgresso idMidia={midia.id_midia} />
        </View>
        <View className="flex-1 gap-1.5">
          <Text numberOfLines={1} className="text-legenda font-semibold uppercase tracking-widest text-marca-texto">
            {midia.tipo_label}
            {midia.generos_lista?.length ? ` · ${midia.generos_lista.slice(0, 2).join(' · ')}` : ''}
          </Text>
          <Text numberOfLines={2} className="text-titulo-secao font-bold text-texto-forte">
            {titulo}
          </Text>
          <View className="flex-row items-center gap-3">
            {nota ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={14} color={paleta.nota} />
                <Text className="text-legenda font-bold text-nota">{nota.valor}</Text>
              </View>
            ) : null}
            {estado ? <SeloStatus estado={estado} /> : null}
          </View>
          <View className="mt-1 flex-row gap-2">
            {item !== undefined ? (
              <ToqueAnimado
                accessibilityRole="button"
                accessibilityLabel={item ? textos.naLista : textos.adicionar}
                onPress={aoAdicionar}
                className="flex-row items-center gap-1.5 rounded-md bg-marca px-4 py-2 active:bg-marca-forte"
              >
                <Ionicons name={item ? 'checkmark' : 'add'} size={18} color={paleta['sobre-marca']} />
                <Text className="text-corpo font-bold text-sobre-marca">{item ? textos.naLista : textos.adicionar}</Text>
              </ToqueAnimado>
            ) : null}
            <ToqueAnimado
              accessibilityRole="button"
              accessibilityLabel={`${textos.detalhes} de ${titulo}`}
              onPress={() => router.push({ pathname: '/midia/[id]', params: { id: midia.id_midia } })}
              className="flex-row items-center gap-1.5 rounded-md bg-texto-forte/15 px-4 py-2"
            >
              <Ionicons name="information-circle-outline" size={18} color={paleta['texto-forte']} />
              <Text className="text-corpo font-bold text-texto-forte">{textos.detalhes}</Text>
            </ToqueAnimado>
          </View>
        </View>
      </View>
    </BannerAssinado>
  );
}

/**
 * Destaques paginados: troca sozinho a cada 6 s, pausa enquanto o dedo está na tela ou o
 * carrossel desliza, e retoma depois. Com "reduzir movimento", só troca à mão.
 */
function Destaques({
  midias,
  itemDe,
  aoAdicionar,
}: {
  midias: Midia[];
  itemDe(m: Midia): ItemLista | null | undefined;
  aoAdicionar(m: Midia): void;
}) {
  const { width, height } = useWindowDimensions();
  const animar = useAnimar();
  const ref = useRef<FlatList<Midia>>(null);
  const [pagina, setPagina] = useState(0);
  const [pausado, setPausado] = useState(false);
  const n = midias.length;
  const altura = Math.round(height * 0.46);

  useEffect(() => {
    if (!animar || pausado || n < 2 || EM_TESTE) return;
    const t = setTimeout(() => {
      const proxima = (pagina + 1) % n;
      ref.current?.scrollToIndex({ index: proxima, animated: true });
      setPagina(proxima);
    }, INTERVALO_MS);
    return () => clearTimeout(t);
  }, [animar, pausado, pagina, n]);

  return (
    <View accessibilityLabel={textos.destaques} className="gap-2">
      <FlatList
        ref={ref}
        horizontal
        pagingEnabled
        data={midias}
        keyExtractor={(m) => m.id_midia}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onTouchStart={() => setPausado(true)}
        onTouchEnd={() => setPausado(false)}
        onTouchCancel={() => setPausado(false)}
        onScrollBeginDrag={() => setPausado(true)}
        onMomentumScrollEnd={(e) => {
          setPagina(Math.round(e.nativeEvent.contentOffset.x / width));
          setPausado(false);
        }}
        renderItem={({ item: m }) => (
          <Destaque midia={m} item={itemDe(m)} largura={width} altura={altura} aoAdicionar={() => aoAdicionar(m)} />
        )}
      />
      {n > 1 ? (
        <View className="flex-row justify-center gap-1.5" importantForAccessibility="no-hide-descendants">
          {midias.map((m, i) => (
            <View key={m.id_midia} className={`h-1.5 rounded-full ${i === pagina ? 'w-5 bg-marca' : 'w-1.5 bg-texto-suave/40'}`} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Top 10 com o numeral grande atrás do pôster, como na Netflix. */
function CarrosselTop({ midias }: { midias: MidiaPopular[] }) {
  return (
    <View accessibilityLabel={textos.top10} className="gap-3">
      <TituloSecao>{textos.top10}</TituloSecao>
      {midias.length === 0 ? (
        <Text className="px-4 text-corpo text-texto-suave">{textos.popularesVazio}</Text>
      ) : (
        <FlatList
          horizontal
          data={midias.slice(0, 10)}
          keyExtractor={(m) => m.id_midia}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-1 px-4"
          renderItem={({ item, index }) => (
            <Entrada indice={index} direcao="direita" style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text
                className="font-bold text-texto-suave/40"
                style={{ fontSize: 112, lineHeight: 112, marginRight: -18, letterSpacing: -8 }}
              >
                {index + 1}
              </Text>
              <CardMidia midia={item} largura={104} papel="carrossel" />
            </Entrada>
          )}
        />
      )}
    </View>
  );
}

/** Itens Em progresso da Lista; sem o fio de progresso, a barra fica sob o card. */
function CarrosselContinuar({ itens }: { itens: ItemLista[] }) {
  const largura = useLarguraCard('continuar', 150);
  const fio = useAssinatura('fio');
  if (!itens.length) return null;
  return (
    <View accessibilityLabel={textos.continuar} className="gap-3">
      <TituloSecao>{textos.continuar}</TituloSecao>
      <FlatList
        horizontal
        data={itens}
        keyExtractor={(i) => i.id_lista}
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4"
        renderItem={({ item, index }) => {
          const total = totalDoItem(item);
          const fracao = total ? Math.min(1, (item.progresso_atual ?? 0) / total) : 0;
          return (
            <Entrada indice={index} direcao="direita" style={{ width: largura, gap: 6 }}>
              <CardMidia midia={item} largura={150} papel="continuar" />
              {fio ? null : (
                <View className="h-1 overflow-hidden rounded-full bg-superficie-alta">
                  <View className="h-full bg-marca" style={{ width: `${fracao * 100}%` }} />
                </View>
              )}
              <Text className="text-legenda text-texto-suave">
                {total ? `${item.progresso_atual ?? 0} de ${total}` : `${item.progresso_atual ?? 0}`}
              </Text>
            </Entrada>
          );
        }}
      />
    </View>
  );
}

/** Itens da Lista no Recorte atual. */
function useListaDoRecorte(): ItemLista[] | undefined {
  const { recorte } = useRecorte();
  const lista = useLista();
  const tipos = TIPOS_DO_RECORTE[recorte] as string[];
  return lista.data?.filter((i) => tipos.includes(i.tipo));
}

function Conteudo({ emAlta, populares }: { emAlta: Midia[]; populares: MidiaPopular[] }) {
  const lista = useListaDoRecorte();
  const [editor, setEditor] = useState<Midia | null>(null);
  const destaques = emAlta.slice(0, MAX_DESTAQUES);
  const itemDe = (m: Midia) => (lista ? (lista.find((i) => i.id_midia === m.id_midia) ?? null) : undefined);
  const continuar = (lista ?? []).filter((i) => estadoDe(i.status_consumo, i.tipo as TipoMidia) === 'em_progresso');
  const itemEditor = editor ? itemDe(editor) : undefined;
  return (
    <View className="gap-7 pb-28">
      {destaques.length ? (
        <Entrada direcao="fade">
          <Destaques midias={destaques} itemDe={itemDe} aoAdicionar={setEditor} />
        </Entrada>
      ) : null}
      <CarrosselContinuar itens={continuar} />
      <View accessibilityLabel={textos.emAlta} className="gap-3">
        <TituloSecao>{textos.emAlta}</TituloSecao>
        {emAlta.length ? (
          <FlatList
            horizontal
            data={emAlta}
            keyExtractor={(m) => m.id_midia}
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 px-4"
            renderItem={({ item: m, index }) => (
              <Entrada indice={index} direcao="direita">
                <CardMidia midia={m} largura={120} papel="carrossel" />
              </Entrada>
            )}
          />
        ) : (
          <Text className="px-4 text-corpo text-texto-suave">{textos.emAltaVazio}</Text>
        )}
      </View>
      <CarrosselTop midias={populares} />
      {editor && itemEditor !== undefined ? <EditorItem midia={editor} item={itemEditor} aoFechar={() => setEditor(null)} /> : null}
    </View>
  );
}

export default function Inicio() {
  const paleta = usePaleta();
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
    conteudo = <Conteudo emAlta={emAlta.data} populares={populares.data} />;
  } else if (emAlta.isError || populares.isError) {
    conteudo = <Falha erro={emAlta.error ?? populares.error} tentarDeNovo={atualizar} />;
  } else {
    conteudo = <Carregando />;
  }

  return (
    <ConteudoRecorte>
      <ScrollView
        testID="inicio"
        className="flex-1 bg-fundo"
        contentContainerClassName="flex-grow"
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={atualizar}
            tintColor={paleta['marca-texto']}
            colors={[paleta.marca]}
            progressBackgroundColor={paleta.superficie}
          />
        }
      >
        {conteudo}
      </ScrollView>
    </ConteudoRecorte>
  );
}
