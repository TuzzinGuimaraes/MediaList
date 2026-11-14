import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { type Ordem, useBuscaMidias, useGeneros } from '@/api/explorar';
import type { TipoMidia } from '@/api/tipos';
import { Botao } from '@/components/Botao';
import { BottomSheet } from '@/components/BottomSheet';
import { CardMidia } from '@/components/CardMidia';
import { Carregando, Falha, FalhaParcial, Vazio } from '@/components/EstadoTela';
import { Opcoes } from '@/components/Opcoes';
import { NOMES_TIPO } from '@/dominio/estadoConsumo';
import { ConteudoRecorte, TIPOS_DO_RECORTE, useRecorte } from '@/recorte/RecorteContext';
import { useEixo, usePaleta } from '@/prototipo/PrototipoContext';
import { useReduzirMovimento } from '@/tema/movimento';

// PROTÓTIPO (ticket 34): o eixo `explorar` troca o cabeçalho de busca e filtros.
// - "Esconde": o cabeçalho de hoje sobe ao rolar para baixo e volta ao rolar para cima
//   (translação com clamp, no thread de UI via useAnimatedScrollHandler).
// - "Compacto": fixo, só a busca e um botão de filtros (com contador) que abre um sheet.
// - "Ambos": compacto e escondendo ao rolar.
// Com "reduzir movimento" o cabeçalho não se mexe sozinho: fica fixo.

const textos = {
  busca: 'Buscar por título',
  tipo: 'Tipo de mídia',
  genero: 'Gênero',
  todosGeneros: 'Todos',
  ordem: 'Ordem',
  resultados: 'Resultados',
  nadaEncontrado: (termo: string) => `Nenhuma Mídia encontrada para "${termo}".`,
  nadaNoFiltro: 'Nenhuma Mídia com esses filtros.',
  filtros: 'Filtros',
  verResultados: 'Ver resultados',
  limpar: 'Limpar filtros',
};

const ORDENS: { valor: Ordem; titulo: string }[] = [
  { valor: 'nota_media', titulo: 'Nota' },
  { valor: 'titulo', titulo: 'Título' },
  { valor: 'data_lancamento', titulo: 'Lançamento' },
  { valor: 'mais_adicionados', titulo: 'Mais adicionados' },
];

const COLUNAS = 3;
const ATRASO_BUSCA_MS = 300;
/** Como no web: um caractere só casaria quase tudo. */
const MINIMO_BUSCA = 2;

function useValorAtrasado<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const espera = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(espera);
  }, [valor, ms]);
  return atrasado;
}

/** Escolha única em chips que quebram linha (dentro do sheet não há por que rolar de lado). */
function ChipsQuebrados<V>({ rotulo, opcoes, valor, escolher }: { rotulo: string; opcoes: { valor: V; titulo: string }[]; valor: V; escolher(v: V): void }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="text-legenda font-semibold uppercase tracking-wide text-texto-suave">
        {rotulo}
      </Text>
      <View accessibilityLabel={rotulo} className="flex-row flex-wrap gap-2">
        {opcoes.map((o) => {
          const ativo = o.valor === valor;
          return (
            <Pressable
              key={o.titulo}
              accessibilityRole="button"
              accessibilityLabel={o.titulo}
              accessibilityState={{ selected: ativo }}
              onPress={() => escolher(o.valor)}
              className={`rounded-full border px-3 py-1.5 ${ativo ? 'border-accent-blue bg-dark-tertiary' : 'border-dark-border bg-dark-primary'}`}
            >
              <Text className={`text-corpo font-semibold ${ativo ? 'text-accent-blue' : 'text-text-secondary'}`}>{o.titulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function Explorar() {
  const paleta = usePaleta();
  const { recorte } = useRecorte();
  const tipos = TIPOS_DO_RECORTE[recorte];
  const [tipoEscolhido, setTipoEscolhido] = useState<TipoMidia>(tipos[0]);
  const tipo = tipos.includes(tipoEscolhido) ? tipoEscolhido : tipos[0];
  // Gênero vale só para o Tipo em que foi escolhido: trocar Tipo ou Recorte o limpa.
  const [genero, setGenero] = useState<{ tipo: TipoMidia; nome: string } | null>(null);
  const nomeGenero = genero?.tipo === tipo ? genero.nome : null;
  const [ordem, setOrdem] = useState<Ordem>('nota_media');
  const [texto, setTexto] = useState('');
  const termo = useValorAtrasado(texto.trim(), ATRASO_BUSCA_MS);
  const busca = termo.length >= MINIMO_BUSCA ? termo : '';

  const generos = useGeneros(tipo);
  const resultados = useBuscaMidias({ tipo, ordem, genero: nomeGenero, busca });

  const variante = useEixo('explorar');
  const reduzir = useReduzirMovimento();
  const compacto = variante !== 'esconde';
  const esconde = variante !== 'compacto' && !reduzir;
  const [sheetAberto, setSheetAberto] = useState(false);
  const ativos = (tipo !== tipos[0] ? 1 : 0) + (nomeGenero ? 1 : 0) + (ordem !== 'nota_media' ? 1 : 0);
  const limpar = () => {
    setTipoEscolhido(tipos[0]);
    setGenero(null);
    setOrdem('nota_media');
  };

  // Clamp: o cabeçalho anda o mesmo que a rolagem, entre 0 e a própria altura.
  const [altura, setAltura] = useState(0);
  const alturaUi = useSharedValue(0);
  const deslocamento = useSharedValue(0);
  const ultimoY = useSharedValue(0);
  const aoRolar = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    const passo = y - ultimoY.get();
    ultimoY.set(y);
    deslocamento.set(y <= 0 ? 0 : Math.min(Math.max(deslocamento.get() + passo, 0), alturaUi.get()));
  });
  const estiloCabecalho = useAnimatedStyle(() => ({ transform: [{ translateY: esconde ? -deslocamento.get() : 0 }] }));
  const folga = esconde ? altura : 0;

  let conteudo: React.ReactNode;
  if (resultados.data?.length === 0) {
    conteudo = <Vazio mensagem={busca ? textos.nadaEncontrado(busca) : textos.nadaNoFiltro} />;
  } else if (resultados.data) {
    conteudo = (
      <Animated.FlatList
        accessibilityLabel={textos.resultados}
        onScroll={aoRolar}
        scrollEventThrottle={16}
        // Espaço do cabeçalho flutuante (variantes que escondem); gap-4 já separa a 1ª fileira.
        ListHeaderComponent={folga ? <View style={{ height: folga - 8 }} /> : undefined}
        data={resultados.data}
        numColumns={COLUNAS}
        keyExtractor={(m) => m.id_midia}
        renderItem={({ item }) => (
          <View className="flex-1 px-1.5" style={{ maxWidth: `${100 / COLUNAS}%` }}>
            <CardMidia midia={item} />
          </View>
        )}
        contentContainerClassName="gap-4 px-2.5 pb-28"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (resultados.hasNextPage && !resultados.isFetchingNextPage) resultados.fetchNextPage();
        }}
        ListFooterComponent={
          resultados.isFetchingNextPage ? (
            <ActivityIndicator color={paleta.accent.blue} />
          ) : resultados.isFetchNextPageError ? (
            <View className="items-center">
              <Botao titulo="Tentar de novo" variante="secundario" onPress={() => resultados.fetchNextPage()} />
            </View>
          ) : undefined
        }
      />
    );
  } else if (resultados.isError) {
    conteudo = <Falha erro={resultados.error} tentarDeNovo={() => resultados.refetch()} />;
  } else {
    conteudo = <Carregando />;
  }

  const filtroTipo =
    tipos.length > 1 ? { rotulo: textos.tipo, opcoes: tipos.map((t) => ({ valor: t, titulo: NOMES_TIPO[t] })), valor: tipo, escolher: setTipoEscolhido } : null;
  const opcoesGenero = [
    { valor: null as string | null, titulo: textos.todosGeneros },
    ...(generos.data ?? []).map((nome) => ({ valor: nome as string | null, titulo: nome })),
  ];
  const escolherGenero = (nome: string | null) => setGenero(nome ? { tipo, nome } : null);
  const falhaGeneros =
    generos.isError && !generos.data ? <FalhaParcial erro={generos.error} tentarDeNovo={() => generos.refetch()} /> : null;

  const campoBusca = (
    <TextInput
      accessibilityLabel={textos.busca}
      placeholder={textos.busca}
      placeholderTextColor={paleta.text.secondary}
      value={texto}
      onChangeText={setTexto}
      autoCorrect={false}
      returnKeyType="search"
      className="flex-1 rounded-md border border-dark-border bg-dark-tertiary px-3 py-2.5 text-campo text-text-bright"
    />
  );

  const cabecalho = compacto ? (
    <View className="flex-row items-center gap-2 px-4 py-3">
      {campoBusca}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ativos ? `${textos.filtros}, ${ativos} ativos` : textos.filtros}
        onPress={() => setSheetAberto(true)}
        className={`h-[46px] w-[46px] items-center justify-center rounded-md border ${ativos ? 'border-accent-blue bg-dark-tertiary' : 'border-dark-border bg-dark-secondary'}`}
      >
        <Ionicons name="options-outline" size={22} color={ativos ? paleta.accent.blue : paleta.text.primary} />
        {ativos ? (
          <View className="absolute -right-1.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full bg-marca px-1">
            <Text className="text-[13px] font-bold leading-4 text-sobre-marca">{ativos}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  ) : (
    <View className="gap-3 py-4">
      <View className="flex-row gap-3 px-4">{campoBusca}</View>
      {filtroTipo ? <Opcoes {...filtroTipo} /> : null}
      <Opcoes rotulo={textos.genero} opcoes={opcoesGenero} valor={nomeGenero} escolher={escolherGenero} />
      {falhaGeneros ? <View className="px-4">{falhaGeneros}</View> : null}
      <Opcoes rotulo={textos.ordem} opcoes={ORDENS} valor={ordem} escolher={setOrdem} />
    </View>
  );

  return (
    <ConteudoRecorte>
      <View className="flex-1 overflow-hidden">
        <Animated.View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setAltura(h);
            alturaUi.set(h);
          }}
          style={[esconde ? { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 } : null, estiloCabecalho]}
          className="border-b border-dark-border bg-fundo"
        >
          {cabecalho}
        </Animated.View>
        {resultados.data?.length ? conteudo : <View style={{ flex: 1, paddingTop: folga }}>{conteudo}</View>}
      </View>
      {sheetAberto ? (
        <BottomSheet
          rotulo={textos.filtros}
          aoFechar={() => setSheetAberto(false)}
          cabecalho={<Text className="text-titulo-secao font-bold text-texto-forte">{textos.filtros}</Text>}
          rodape={
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Botao titulo={textos.limpar} variante="secundario" onPress={limpar} />
              </View>
              <View className="flex-1">
                <Botao titulo={textos.verResultados} onPress={() => setSheetAberto(false)} />
              </View>
            </View>
          }
        >
          {filtroTipo ? <ChipsQuebrados {...filtroTipo} /> : null}
          <ChipsQuebrados rotulo={textos.genero} opcoes={opcoesGenero} valor={nomeGenero} escolher={escolherGenero} />
          {falhaGeneros}
          <ChipsQuebrados rotulo={textos.ordem} opcoes={ORDENS} valor={ordem} escolher={setOrdem} />
        </BottomSheet>
      ) : null}
    </ConteudoRecorte>
  );
}
