import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, RefreshControl, Text, TextInput, useWindowDimensions, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { useAtualizar } from '@/api/consulta';
import { mensagemDeErro } from '@/api/erros';
import { useLista, useMudarProgresso } from '@/api/lista';
import { useEmAlta } from '@/api/midias';
import type { ItemLista } from '@/api/tipos';
import { CardMidia } from '@/components/CardMidia';
import { EditorItem } from '@/components/EditorItem';
import { Carregando, Falha } from '@/components/EstadoTela';
import { LinhaItem } from '@/components/LinhaItem';
import { TituloSecao } from '@/components/Secao';
import { SeletorRecorte } from '@/components/SeletorRecorte';
import { corDoEstado } from '@/components/Selo';
import { BotaoFiltros, GrupoFiltro, SheetFiltros } from '@/components/SheetFiltros';
import { contarPorEstado, type EstadoConsumo, NOMES_ESTADO, NOMES_TIPO, type TipoMidia } from '@/dominio/estadoConsumo';
import {
  buscarNaLista,
  FILTROS_PADRAO,
  type FiltrosLista,
  filtrosAtivos,
  type OpcoesDosFiltros,
  type OrdemLista,
  opcoesDosFiltros,
  organizarLista,
  porTipo,
} from '@/dominio/filtrosLista';
import { estadosDaLista, itensDoEstado } from '@/dominio/itemLista';
import { ConteudoRecorte, TIPOS_DO_RECORTE, useRecorte } from '@/recorte/RecorteContext';
import { useReduzirMovimento } from '@/tema/movimento';
import { useCores } from '@/tema/TemaContext';

const textos = {
  abas: 'Status da Lista',
  itens: 'Itens da Lista',
  resultados: 'Resultados da busca',
  vazio: (estado: string) => `Nenhum Item em ${estado}.`,
  vazioFiltrado: (estado: string) => `Nenhum Item em ${estado} com esses filtros.`,
  semResultado: (termo: string) => `Nada na Lista com "${termo}".`,
  sugestoes: 'Sugestões para você',
  buscar: 'Buscar na Lista',
  fecharBusca: 'Fechar a busca',
  genero: 'Gênero',
  situacao: 'Situação',
  ordem: 'Ordem',
  todos: 'Todos',
  todas: 'Todas',
};

/** Rótulos curtos das abas: até 6 Status cabem na largura sem rolar. */
const CURTOS: Record<EstadoConsumo, string> = {
  em_progresso: 'Em prog.',
  planejado: 'Planej.',
  pausado: 'Pausado',
  abandonado: 'Aband.',
  concluido: 'Concl.',
  platinado: 'Platin.',
};

const ORDENS: { valor: OrdemLista; titulo: string }[] = [
  { valor: 'titulo', titulo: 'Alfabética' },
  { valor: 'nota', titulo: 'Nota pessoal' },
  { valor: 'adicao', titulo: 'Adicionado recentemente' },
  { valor: 'atualizacao', titulo: 'Atualizado recentemente' },
];

/** O botão de filtros e o aviso de página vazia: valem nas páginas e nos resultados da busca. */
type ControleDosFiltros = {
  /** Gênero ou Situação fora de "todos". */
  filtrado: boolean;
  /** Filtros fora do padrão, para o contador do botão. */
  ativos: number;
  abrir(): void;
};

type Acoes = {
  editar(idLista: string): void;
  mudarProgresso(item: ItemLista, progresso: number): void;
};

export default function Lista() {
  const { recorte } = useRecorte();
  const tipos = TIPOS_DO_RECORTE[recorte];
  const lista = useLista();
  const progresso = useMudarProgresso();
  const [estado, setEstado] = useState<EstadoConsumo>('em_progresso');
  const [filtros, setFiltros] = useState<FiltrosLista>(FILTROS_PADRAO);
  const [sheetAberto, setSheetAberto] = useState(false);
  // null: busca fechada (o cabeçalho mostra a lupa); texto: o campo no cabeçalho.
  const [busca, setBusca] = useState<string | null>(null);
  // Guarda só o id: o editor lê o Item atual da Lista.
  const [editando, setEditando] = useState<string | null>(null);

  useCabecalhoDeBusca(busca, setBusca);

  const acoes: Acoes = {
    editar: setEditando,
    mudarProgresso: (item, p) =>
      progresso.mutate({ idLista: item.id_lista, idMidia: item.id_midia, passo: p - (item.progresso_atual ?? 0) }),
  };

  let conteudo: React.ReactNode;
  if (lista.data) {
    const doRecorte = lista.data.filter((i) => (tipos as string[]).includes(i.tipo));
    const opcoes = opcoesDosFiltros(doRecorte);
    const efetivos = filtrosEfetivos(filtros, opcoes);
    const filtrados = organizarLista(doRecorte, efetivos);
    const emEdicao = lista.data.find((i) => i.id_lista === editando);
    const termo = busca?.trim() ?? '';
    const controle: ControleDosFiltros = {
      filtrado: efetivos.genero !== null || efetivos.situacao !== null,
      ativos: filtrosAtivos(efetivos),
      abrir: () => setSheetAberto(true),
    };

    conteudo = (
      <>
        {progresso.isError ? (
          <Text accessibilityRole="alert" className="px-4 pb-2 pt-2 text-corpo text-erro">
            {mensagemDeErro(progresso.error)}
          </Text>
        ) : null}
        {termo ? (
          <Resultados itens={buscarNaLista(filtrados, termo)} termo={termo} filtros={controle} acoes={acoes} />
        ) : (
          <PaginasStatus
            // Trocar de catálogo muda o número de páginas: recomeça o pager.
            key={tipos.join()}
            itens={filtrados}
            tipos={tipos}
            estado={estado}
            escolher={setEstado}
            filtros={controle}
            naLista={new Set(lista.data.map((i) => i.id_midia))}
            acoes={acoes}
          />
        )}
        {sheetAberto ? (
          <SheetDaLista filtros={efetivos} opcoes={opcoes} mudar={setFiltros} aoFechar={() => setSheetAberto(false)} />
        ) : null}
        {emEdicao ? <EditorItem midia={emEdicao} item={emEdicao} aoFechar={() => setEditando(null)} /> : null}
      </>
    );
  } else if (lista.isError) {
    conteudo = <Falha erro={lista.error} tentarDeNovo={() => lista.refetch()} />;
  } else {
    conteudo = <Carregando />;
  }

  return <ConteudoRecorte>{conteudo}</ConteudoRecorte>;
}

/** Gênero ou Situação que não existe no catálogo atual (ex.: depois de trocá-lo) volta a "todos". */
function filtrosEfetivos(filtros: FiltrosLista, opcoes: OpcoesDosFiltros): FiltrosLista {
  return {
    ...filtros,
    genero: filtros.genero !== null && opcoes.generos.includes(filtros.genero) ? filtros.genero : null,
    situacao: opcoes.situacoes.some((s) => s.valor === filtros.situacao) ? filtros.situacao : null,
  };
}

// ---------------------------------------------------------------- cabeçalho com busca

/** A lupa ao lado da pílula do catálogo vira o campo de busca no lugar do título. */
function useCabecalhoDeBusca(busca: string | null, setBusca: (b: string | null) => void) {
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

// ---------------------------------------------------------------- páginas por Status

type PropsPaginas = {
  /** Itens do catálogo já filtrados e na Ordem escolhida. */
  itens: ItemLista[];
  tipos: TipoMidia[];
  estado: EstadoConsumo;
  escolher(estado: EstadoConsumo): void;
  filtros: ControleDosFiltros;
  naLista: Set<string>;
  acoes: Acoes;
};

function PaginasStatus({ itens, tipos, estado, escolher, filtros, naLista, acoes }: PropsPaginas) {
  const estados = estadosDaLista(tipos);
  const indice = Math.max(0, estados.indexOf(estado));
  const aba = estados[indice];
  const contagem = contarPorEstado(itens);
  const pager = useRef<PagerView>(null);
  const reduzir = useReduzirMovimento();
  const [posicao] = useState(() => new Animated.Value(indice));

  function ir(i: number) {
    escolher(estados[i]);
    if (reduzir) {
      posicao.setValue(i);
      pager.current?.setPageWithoutAnimation(i);
    } else pager.current?.setPage(i);
  }

  return (
    <>
      <AbasStatus estados={estados} contagem={contagem} ativa={indice} posicao={posicao} ir={ir} />
      <View className="flex-row items-center justify-between gap-3 px-4 pb-1 pt-3">
        <TituloDaAba estado={aba} n={contagem[aba]} />
        <BotaoFiltros ativos={filtros.ativos} onPress={filtros.abrir} />
      </View>
      <PagerView
        ref={pager}
        style={{ flex: 1 }}
        initialPage={indice}
        onPageScroll={(e) => posicao.setValue(e.nativeEvent.position + e.nativeEvent.offset)}
        onPageSelected={(e) => {
          posicao.setValue(e.nativeEvent.position);
          escolher(estados[e.nativeEvent.position]);
        }}
      >
        {estados.map((e, i) => {
          const ativa = i === indice;
          return (
            // As vizinhas já ficam prontas para o deslize, mas fora do leitor de tela.
            <View
              key={e}
              style={{ flex: 1 }}
              accessibilityElementsHidden={!ativa}
              importantForAccessibility={ativa ? 'auto' : 'no-hide-descendants'}
            >
              {Math.abs(i - indice) <= 1 ? (
                <PaginaStatus
                  itens={itensDoEstado(itens, e)}
                  tipos={tipos}
                  vazio={filtros.filtrado ? textos.vazioFiltrado(NOMES_ESTADO[e]) : textos.vazio(NOMES_ESTADO[e])}
                  naLista={naLista}
                  acoes={acoes}
                />
              ) : null}
            </View>
          );
        })}
      </PagerView>
    </>
  );
}

type PropsAbas = {
  estados: EstadoConsumo[];
  contagem: Record<EstadoConsumo, number>;
  ativa: number;
  posicao: Animated.Value;
  ir(i: number): void;
};

/** Barra das páginas: rótulo curto e contagem, com o sublinhado carmesim acompanhando o deslize. */
function AbasStatus({ estados, contagem, ativa, posicao, ir }: PropsAbas) {
  const cores = useCores();
  const { width } = useWindowDimensions();
  const largura = width / estados.length;
  const deslocamento = posicao.interpolate({
    inputRange: [0, Math.max(1, estados.length - 1)],
    outputRange: [0, largura * Math.max(1, estados.length - 1)],
  });
  return (
    <View className="border-b border-borda">
      <View accessibilityRole="tablist" accessibilityLabel={textos.abas} className="flex-row">
        {estados.map((e, i) => {
          const ativo = i === ativa;
          return (
            <Pressable
              key={e}
              accessibilityRole="tab"
              accessibilityLabel={`${NOMES_ESTADO[e]} (${contagem[e]})`}
              accessibilityState={{ selected: ativo }}
              onPress={() => ir(i)}
              className="items-center justify-center py-2"
              style={{ width: largura, minHeight: 48 }}
            >
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                className={`text-legenda ${ativo ? 'font-bold text-texto-forte' : 'font-semibold text-texto-suave'}`}
              >
                {CURTOS[e]}
              </Text>
              <Text
                maxFontSizeMultiplier={1.2}
                className={`text-legenda ${ativo ? 'text-marca-texto' : 'text-texto-suave'}`}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {contagem[e]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Animated.View
        pointerEvents="none"
        style={{ width: largura, height: 3, alignItems: 'center', transform: [{ translateX: deslocamento }] }}
      >
        <View style={{ width: largura * 0.6, height: 3, borderRadius: 2, backgroundColor: cores['marca-forte'] }} />
      </Animated.View>
    </View>
  );
}

/** Título da aba ativa, no estilo do cabeçalho de seção, com o nome e a cor do Status. */
function TituloDaAba({ estado, n }: { estado: EstadoConsumo; n: number }) {
  const cor = corDoEstado(estado, useCores());
  return (
    <View className="flex-1 flex-row items-center gap-2">
      <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: cor }} />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        className="flex-shrink text-legenda font-bold uppercase tracking-wider"
        style={{ color: cor }}
      >
        {`${NOMES_ESTADO[estado]} · ${n}`}
      </Text>
    </View>
  );
}

type Bloco = { k: 'tipo'; tipo: TipoMidia; n: number } | { k: 'linha'; item: ItemLista };

type PropsPagina = {
  itens: ItemLista[];
  tipos: TipoMidia[];
  vazio: string;
  naLista: Set<string>;
  acoes: Acoes;
};

/** Uma página: subseções "Anime · N" e "Mangá · N", e as Sugestões no fim. */
function PaginaStatus({ itens, tipos, vazio, naLista, acoes }: PropsPagina) {
  const lista = useLista();
  const atualizar = useAtualizar(lista);
  const blocos = porTipo(itens, tipos).flatMap(({ tipo, itens: doTipo }): Bloco[] => [
    ...(tipo ? [{ k: 'tipo' as const, tipo, n: doTipo.length }] : []),
    ...doTipo.map((item) => ({ k: 'linha' as const, item })),
  ]);
  return (
    <FlatList<Bloco>
      accessibilityLabel={textos.itens}
      data={blocos}
      keyExtractor={(b) => (b.k === 'tipo' ? `tipo-${b.tipo}` : b.item.id_lista)}
      renderItem={({ item: b }) =>
        b.k === 'tipo' ? (
          <TituloSecao className="px-4 pt-2">{`${NOMES_TIPO[b.tipo]} · ${b.n}`}</TituloSecao>
        ) : (
          <Linha item={b.item} acoes={acoes} />
        )
      }
      ListEmptyComponent={<Text className="p-6 text-center text-corpo text-texto-suave">{vazio}</Text>}
      ListFooterComponent={<Sugestoes naLista={naLista} />}
      refreshControl={<RefreshControl {...atualizar} />}
      contentContainerClassName="gap-3 pb-6 pt-2"
    />
  );
}

function Linha({ item, acoes }: { item: ItemLista; acoes: Acoes }) {
  return (
    <LinhaItem
      item={item}
      editar={() => acoes.editar(item.id_lista)}
      mudarProgresso={(p) => acoes.mudarProgresso(item, p)}
    />
  );
}

/** "Sugestões para você": Mídias de Em alta do catálogo que não estão na Lista, com o card A. */
function Sugestoes({ naLista }: { naLista: Set<string> }) {
  const { recorte } = useRecorte();
  const emAlta = useEmAlta(recorte);
  const midias = (emAlta.data ?? []).filter((m) => !naLista.has(m.id_midia));
  if (!midias.length) return null;
  return (
    <View accessibilityLabel={textos.sugestoes} className="mt-4 gap-3">
      <Text accessibilityRole="header" className="px-4 text-titulo-secao font-bold text-texto-forte">
        {textos.sugestoes}
      </Text>
      <FlatList
        horizontal
        data={midias}
        keyExtractor={(m) => m.id_midia}
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4"
        renderItem={({ item }) => <CardMidia midia={item} largura={112} />}
      />
    </View>
  );
}

// ---------------------------------------------------------------- busca e filtros

/** Com texto na busca, as páginas dão lugar a uma lista única, de todos os Status. */
function Resultados({ itens, termo, filtros, acoes }: { itens: ItemLista[]; termo: string; filtros: ControleDosFiltros; acoes: Acoes }) {
  return (
    <>
      <View className="flex-row justify-end px-4 pt-3">
        <BotaoFiltros ativos={filtros.ativos} onPress={filtros.abrir} />
      </View>
      <FlatList<ItemLista>
        accessibilityLabel={textos.resultados}
        data={itens}
        keyExtractor={(i) => i.id_lista}
        renderItem={({ item }) => <Linha item={item} acoes={acoes} />}
        ListEmptyComponent={<Text className="p-6 text-center text-corpo text-texto-suave">{textos.semResultado(termo)}</Text>}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-3 pb-6 pt-3"
      />
    </>
  );
}

type PropsSheet = {
  filtros: FiltrosLista;
  opcoes: OpcoesDosFiltros;
  mudar(filtros: FiltrosLista): void;
  aoFechar(): void;
};

function SheetDaLista({ filtros, opcoes, mudar, aoFechar }: PropsSheet) {
  return (
    <SheetFiltros aoFechar={aoFechar} limpar={() => mudar(FILTROS_PADRAO)}>
      <View className="gap-5">
        {opcoes.generos.length ? (
          <GrupoFiltro
            rotulo={textos.genero}
            opcoes={[{ valor: null, titulo: textos.todos }, ...opcoes.generos.map((g) => ({ valor: g, titulo: g }))]}
            valor={filtros.genero}
            escolher={(genero) => mudar({ ...filtros, genero })}
          />
        ) : null}
        {opcoes.situacoes.length ? (
          <GrupoFiltro<string | null>
            rotulo={textos.situacao}
            opcoes={[{ valor: null, titulo: textos.todas }, ...opcoes.situacoes]}
            valor={filtros.situacao}
            escolher={(situacao) => mudar({ ...filtros, situacao })}
          />
        ) : null}
        <GrupoFiltro rotulo={textos.ordem} opcoes={ORDENS} valor={filtros.ordem} escolher={(ordem) => mudar({ ...filtros, ordem })} />
      </View>
    </SheetFiltros>
  );
}
