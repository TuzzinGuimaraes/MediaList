// PROTÓTIPO (ticket 29): três layouts do Início pelo eixo `inicio`.
// A: Netflix (destaque grande + carrosséis Continuar / Em alta / Top 10).
// B: destaques paginados em tela cheia + grade de Populares.
// C: o layout atual com a pele nova (controle). Os dados são os mesmos nos três.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { useLista } from '@/api/lista';
import { useEmAlta, usePopulares } from '@/api/midias';
import type { CartaoMidia, ItemLista, Midia, MidiaPopular } from '@/api/tipos';
import { CardMidia } from '@/components/CardMidia';
import { EditorItem } from '@/components/EditorItem';
import { Carregando, Falha } from '@/components/EstadoTela';
import { estadoDe, type TipoMidia } from '@/dominio/estadoConsumo';
import { totalDoItem } from '@/dominio/itemLista';
import { notasDaMidia, tituloDaMidia } from '@/dominio/midia';
import { useEixo, usePaleta } from '@/prototipo/PrototipoContext';
import { Entrada, ToqueAnimado } from '@/prototipo/PrototipoMovimento';
import { SeloStatus, SelosSobrePoster, useSelos } from '@/prototipo/PrototipoSelos';
import { ConteudoRecorte, TIPOS_DO_RECORTE, useRecorte } from '@/recorte/RecorteContext';

const textos = {
  emAlta: 'Em alta',
  emAltaVazio: 'Nenhuma Mídia neste catálogo ainda.',
  populares: 'Populares',
  popularesVazio: 'Nenhuma Mídia popular neste catálogo ainda.',
  top10: 'Top 10 de hoje',
  continuar: 'Continuar',
  adicionar: 'Adicionar à Lista',
  naLista: 'Na Lista',
  detalhes: 'Detalhes',
};

/** Título de seção no estilo da pele nova: forte, sem caixa alta. */
function TituloSecao({ children }: { children: string }) {
  return <Text className="px-4 text-titulo-secao font-bold text-texto-forte">{children}</Text>;
}

function Secao({ titulo, midias, vazio }: { titulo: string; midias: CartaoMidia[]; vazio: string }) {
  return (
    <View accessibilityLabel={titulo} className="gap-3">
      <Text className="px-4 text-legenda font-bold uppercase tracking-wider text-text-secondary">{titulo}</Text>
      {midias.length === 0 ? (
        <Text className="px-4 text-corpo text-text-secondary">{vazio}</Text>
      ) : (
        <FlatList
          horizontal
          data={midias}
          keyExtractor={(m) => m.id_midia}
          renderItem={({ item, index }) => (
            <Entrada indice={index} direcao="direita">
              <CardMidia midia={item} largura={115} />
            </Entrada>
          )}
          contentContainerClassName="gap-3 px-4"
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
}

/** Banner do destaque (A) e cada página do carrossel (B): imagem, gradiente, título e ações. */
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
  const { estado } = useSelos(midia);
  const nota = notasDaMidia(midia)[0];
  const imagem = midia.poster_url ?? midia.banner_url;
  return (
    <View style={{ width: largura, height: altura }} className="overflow-hidden bg-superficie">
      {imagem ? (
        <Image source={imagem} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" transition={200} />
      ) : null}
      <LinearGradient
        colors={['transparent', `${paleta.fundo}99`, paleta.fundo]}
        locations={[0.35, 0.72, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View className="absolute right-0 top-0">
        <SelosSobrePoster midia={midia} tipo={false} status={false} />
      </View>
      <View className="absolute bottom-0 left-0 right-0 items-center gap-2 px-6 pb-5">
        <Text className="text-legenda font-semibold uppercase tracking-widest text-marca-texto">
          {midia.tipo_label}
          {midia.generos_lista?.length ? ` · ${midia.generos_lista.slice(0, 2).join(' · ')}` : ''}
        </Text>
        <Text numberOfLines={2} accessibilityRole="header" className="text-center text-titulo-tela font-bold text-texto-forte">
          {tituloDaMidia(midia)}
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
        <View className="mt-1 flex-row gap-3">
          {item !== undefined ? (
            <ToqueAnimado
              accessibilityRole="button"
              accessibilityLabel={item ? textos.naLista : textos.adicionar}
              onPress={aoAdicionar}
              className="flex-row items-center gap-1.5 rounded-md bg-marca px-5 py-2.5 active:bg-marca-forte"
            >
              <Ionicons name={item ? 'checkmark' : 'add'} size={20} color={paleta['sobre-marca']} />
              <Text className="text-corpo font-bold text-sobre-marca">{item ? textos.naLista : textos.adicionar}</Text>
            </ToqueAnimado>
          ) : null}
          <ToqueAnimado
            accessibilityRole="button"
            accessibilityLabel={`${textos.detalhes} de ${tituloDaMidia(midia)}`}
            onPress={() => router.push({ pathname: '/midia/[id]', params: { id: midia.id_midia } })}
            className="flex-row items-center gap-1.5 rounded-md bg-texto-forte/15 px-5 py-2.5"
          >
            <Ionicons name="information-circle-outline" size={20} color={paleta['texto-forte']} />
            <Text className="text-corpo font-bold text-texto-forte">{textos.detalhes}</Text>
          </ToqueAnimado>
        </View>
      </View>
    </View>
  );
}

/** Top 10 com o numeral grande atrás do pôster, como na Netflix. */
function CarrosselTop({ midias }: { midias: MidiaPopular[] }) {
  return (
    <View accessibilityLabel={textos.top10} className="gap-3">
      <TituloSecao>{textos.top10}</TituloSecao>
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
            <CardMidia midia={item} largura={104} />
          </Entrada>
        )}
      />
    </View>
  );
}

/** Itens Em progresso da Lista, com a barra de Progresso sob o pôster. */
function CarrosselContinuar({ itens }: { itens: ItemLista[] }) {
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
            <Entrada indice={index} direcao="direita" style={{ width: 150, gap: 6 }}>
              <CardMidia midia={item} largura={150} />
              <View className="h-1 overflow-hidden rounded-full bg-superficie-alta">
                <View className="h-full bg-marca" style={{ width: `${fracao * 100}%` }} />
              </View>
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

/** Itens da Lista no Recorte atual; só A e B pedem a Lista (o controle C não). */
function useListaDoRecorte(): ItemLista[] | undefined {
  const { recorte } = useRecorte();
  const lista = useLista();
  const tipos = TIPOS_DO_RECORTE[recorte] as string[];
  return lista.data?.filter((i) => tipos.includes(i.tipo));
}

function InicioA({ emAlta, populares }: { emAlta: Midia[]; populares: MidiaPopular[] }) {
  const lista = useListaDoRecorte();
  const { width, height } = useWindowDimensions();
  const [editor, setEditor] = useState(false);
  const destaque = emAlta[0];
  const item = destaque && lista ? lista.find((i) => i.id_midia === destaque.id_midia) ?? null : undefined;
  const continuar = (lista ?? []).filter((i) => estadoDe(i.status_consumo, i.tipo as TipoMidia) === 'em_progresso');
  return (
    <View className="gap-7 pb-28">
      {destaque ? (
        <Entrada direcao="fade">
          <Destaque midia={destaque} item={item} largura={width} altura={Math.round(height * 0.62)} aoAdicionar={() => setEditor(true)} />
        </Entrada>
      ) : null}
      <CarrosselContinuar itens={continuar} />
      <View className="gap-3">
        <TituloSecao>{textos.emAlta}</TituloSecao>
        {emAlta.length > 1 ? (
          <FlatList
            horizontal
            data={emAlta.slice(1)}
            keyExtractor={(m) => m.id_midia}
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 px-4"
            renderItem={({ item: m, index }) => (
              <Entrada indice={index} direcao="direita">
                <CardMidia midia={m} largura={120} />
              </Entrada>
            )}
          />
        ) : (
          <Text className="px-4 text-corpo text-texto-suave">{textos.emAltaVazio}</Text>
        )}
      </View>
      {populares.length ? <CarrosselTop midias={populares} /> : null}
      {editor && destaque && item !== undefined ? <EditorItem midia={destaque} item={item} aoFechar={() => setEditor(false)} /> : null}
    </View>
  );
}

function InicioB({ emAlta, populares }: { emAlta: Midia[]; populares: MidiaPopular[] }) {
  const lista = useListaDoRecorte();
  const { width, height } = useWindowDimensions();
  const [pagina, setPagina] = useState(0);
  const [editor, setEditor] = useState<Midia | null>(null);
  const destaques = emAlta.slice(0, 6);
  const itemDe = (m: Midia) => (lista ? lista.find((i) => i.id_midia === m.id_midia) ?? null : undefined);
  const colunas = 3;
  const larguraCard = (width - 32 - 12 * (colunas - 1)) / colunas;
  return (
    <View className="gap-6 pb-28">
      <View>
        <FlatList
          horizontal
          pagingEnabled
          data={destaques}
          keyExtractor={(m) => m.id_midia}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPagina(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item: m }) => (
            <Destaque midia={m} item={itemDe(m)} largura={width} altura={Math.round(height * 0.7)} aoAdicionar={() => setEditor(m)} />
          )}
        />
        <View className="absolute bottom-1.5 left-0 right-0 flex-row justify-center gap-1.5">
          {destaques.map((m, i) => (
            <View key={m.id_midia} className={`h-1.5 rounded-full ${i === pagina ? 'w-5 bg-marca' : 'w-1.5 bg-texto-suave/50'}`} />
          ))}
        </View>
      </View>
      <View className="gap-3">
        <TituloSecao>{textos.populares}</TituloSecao>
        <View className="flex-row flex-wrap gap-3 px-4">
          {populares.slice(0, 12).map((m, i) => (
            <Entrada key={m.id_midia} indice={i}>
              <CardMidia midia={m} largura={larguraCard} />
            </Entrada>
          ))}
        </View>
      </View>
      {editor ? <EditorItem midia={editor} item={itemDe(editor) ?? null} aoFechar={() => setEditor(null)} /> : null}
    </View>
  );
}

export default function Inicio() {
  const variante = useEixo('inicio');
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
    conteudo =
      variante === 'a' ? (
        <InicioA emAlta={emAlta.data} populares={populares.data} />
      ) : variante === 'b' ? (
        <InicioB emAlta={emAlta.data} populares={populares.data} />
      ) : (
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
        className="flex-1 bg-fundo"
        contentContainerClassName={variante === 'c' ? 'flex-grow gap-6 py-4' : 'flex-grow'}
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
