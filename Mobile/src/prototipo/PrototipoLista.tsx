// PROTÓTIPO (ticket 34), descartável. Layouts da aba Lista, trocados pela barra:
// - eixo `lista-status`: pílula com menu (controle dos testes), seções recolhíveis numa
//   rolagem só (padrão) ou páginas deslizáveis (react-native-pager-view) com indicador fixo.
// - eixo `lista-tipo`: misturado (controle), subseções por Tipo (padrão) ou um carrossel
//   horizontal por Tipo com o card C. No catálogo Jogos (um Tipo só) o eixo não muda nada.
// Fixo: linhas maiores (LinhaItem no estilo do card C) e "Sugestões para você" no fim.
// Tudo vira uma FlatList de "blocos" (cabeçalho, linha, carrossel), para manter uma rolagem
// vertical só com o refresh, mesmo nas seções.
import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Modal, Pressable, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEmAlta } from '../api/midias';
import type { ItemLista } from '../api/tipos';
import { CardMidia } from '../components/CardMidia';
import { LinhaItem } from '../components/LinhaItem';
import { contarPorEstado, type EstadoConsumo, estadoDe, NOMES_ESTADO, NOMES_TIPO, type TipoMidia } from '../dominio/estadoConsumo';
import { estadosDaLista, itensDoEstado } from '../dominio/itemLista';
import { useRecorte } from '../recorte/RecorteContext';
import { EM_TESTE, useEixo, usePaleta } from './PrototipoContext';
import { Entrada, useAnimar } from './PrototipoMovimento';
import { corDoEstado } from './PrototipoSelos';

const textos = {
  status: 'Status',
  itens: 'Itens da Lista',
  vazio: (estado: string) => `Nenhum Item em ${estado}.`,
  listaVazia: 'Sua Lista ainda está vazia neste catálogo.',
  sugestoes: 'Sugestões para você',
};

/** Ordem das seções: o que se acompanha agora, depois o que vem, e o que acabou. */
const ORDEM_SECOES: readonly EstadoConsumo[] = ['em_progresso', 'planejado', 'pausado', 'concluido', 'platinado', 'abandonado'];
/** Concluído e Abandonado começam recolhidas acima disto. */
const RECOLHE_ACIMA = 5;
/** Rótulos curtos do indicador das páginas (6 Status cabem na largura sem rolar). */
const CURTOS: Record<EstadoConsumo, string> = {
  em_progresso: 'Em prog.',
  planejado: 'Planej.',
  pausado: 'Pausado',
  concluido: 'Concl.',
  platinado: 'Platin.',
  abandonado: 'Aband.',
};

export type PropsLista = {
  /** Itens do catálogo ativo, na ordem da API (alfabética pelo título exibido). */
  itens: ItemLista[];
  /** Ids de todas as Mídias na Lista (para as sugestões não repetirem). */
  naLista: Set<string>;
  tipos: TipoMidia[];
  editar(idLista: string): void;
  mudarProgresso(item: ItemLista, progresso: number): void;
  atualizando: boolean;
  atualizar(): void;
};

type Bloco =
  | { k: 'secao'; estado: EstadoConsumo; n: number; aberta: boolean }
  | { k: 'tipo'; tipo: TipoMidia; n: number; chave: string }
  | { k: 'linha'; item: ItemLista; indice: number; chave: string }
  | { k: 'carrossel'; tipo: TipoMidia; itens: ItemLista[]; chave: string };

function chaveDo(b: Bloco): string {
  return b.k === 'secao' ? `secao-${b.estado}` : b.chave;
}

/** Os blocos de um Status, conforme o eixo `lista-tipo`. */
function blocosDoStatus(itens: ItemLista[], tipos: TipoMidia[], modo: string, prefixo: string): Bloco[] {
  const linhas = (lista: ItemLista[]): Bloco[] =>
    lista.map((item, indice) => ({ k: 'linha', item, indice, chave: `${prefixo}-${item.id_lista}` }));
  if (tipos.length < 2 || modo === 'misturado') return linhas(itens);
  return tipos.flatMap((tipo): Bloco[] => {
    const doTipo = itens.filter((i) => i.tipo === tipo);
    if (!doTipo.length) return [];
    const cabecalho: Bloco = { k: 'tipo', tipo, n: doTipo.length, chave: `${prefixo}-tipo-${tipo}` };
    return modo === 'carrosseis'
      ? [cabecalho, { k: 'carrossel', tipo, itens: doTipo, chave: `${prefixo}-car-${tipo}` }]
      : [cabecalho, ...linhas(doTipo)];
  });
}

export function ListaPrototipo(props: PropsLista) {
  const variante = useEixo('lista-status');
  if (variante === 'secoes') return <ListaSecoes {...props} />;
  // Trocar de catálogo muda o número de páginas: recomeça o pager.
  if (variante === 'paginas') return <ListaPaginas key={props.tipos.join()} {...props} />;
  return <ListaPilula {...props} />;
}

// ---------------------------------------------------------------- peças comuns

function VerBloco({ bloco: b, props, alternar }: { bloco: Bloco; props: PropsLista; alternar?: (e: EstadoConsumo) => void }) {
  const { width } = useWindowDimensions();
  const larguraCard = Math.round(width * 0.82);
  if (b.k === 'secao') return <CabecalhoSecao bloco={b} alternar={() => alternar?.(b.estado)} />;
  if (b.k === 'tipo') {
    return (
      <Text accessibilityRole="header" className="px-4 pt-1 text-legenda font-semibold uppercase tracking-wide text-texto-suave">
        {`${NOMES_TIPO[b.tipo]} · ${b.n}`}
      </Text>
    );
  }
  if (b.k === 'carrossel') {
    return (
      <FlatList
        horizontal
        data={b.itens}
        keyExtractor={(i) => i.id_lista}
        showsHorizontalScrollIndicator={false}
        snapToInterval={larguraCard + 12}
        decelerationRate="fast"
        contentContainerClassName="gap-3 px-4"
        renderItem={({ item, index }) => (
          <Entrada indice={index} direcao="direita">
            <LinhaItem
              item={item}
              largura={larguraCard}
              editar={() => props.editar(item.id_lista)}
              mudarProgresso={(p) => props.mudarProgresso(item, p)}
            />
          </Entrada>
        )}
      />
    );
  }
  return (
    <Entrada indice={b.indice} direcao="fade">
      <LinhaItem item={b.item} editar={() => props.editar(b.item.id_lista)} mudarProgresso={(p) => props.mudarProgresso(b.item, p)} />
    </Entrada>
  );
}

function ListaDeBlocos({ props, blocos, vazio, alternar }: { props: PropsLista; blocos: Bloco[]; vazio: string; alternar?: (e: EstadoConsumo) => void }) {
  const paleta = usePaleta();
  return (
    <FlatList<Bloco>
      accessibilityLabel={textos.itens}
      data={blocos}
      keyExtractor={chaveDo}
      renderItem={({ item }) => <VerBloco bloco={item} props={props} alternar={alternar} />}
      ListEmptyComponent={<Text className="p-6 text-center text-corpo text-text-secondary">{vazio}</Text>}
      ListFooterComponent={<Sugestoes naLista={props.naLista} />}
      refreshControl={<RefreshControl refreshing={props.atualizando} onRefresh={props.atualizar} tintColor={paleta.accent.blue} />}
      contentContainerClassName="gap-3 pb-28 pt-1"
    />
  );
}

/** "Sugestões para você": Mídias de Em alta do catálogo fora da Lista, com o card A. */
function Sugestoes({ naLista }: { naLista: Set<string> }) {
  // Nos testes não há rota de Em alta simulada na Lista: o carrossel nem pede.
  return EM_TESTE ? null : <SugestoesDoCatalogo naLista={naLista} />;
}

function SugestoesDoCatalogo({ naLista }: { naLista: Set<string> }) {
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
        renderItem={({ item, index }) => (
          <Entrada indice={index} direcao="direita">
            <CardMidia midia={item} largura={112} papel="carrossel" />
          </Entrada>
        )}
      />
    </View>
  );
}

// ---------------------------------------------------------------- (a) pílula com menu

function ListaPilula(props: PropsLista) {
  const [escolhido, setEscolhido] = useState<EstadoConsumo>('em_progresso');
  const modo = useEixo('lista-tipo');
  const estados = estadosDaLista(props.tipos);
  const atual = estados.includes(escolhido) ? escolhido : estados[0];
  const contagem = contarPorEstado(props.itens);
  const blocos = blocosDoStatus(itensDoEstado(props.itens, atual), props.tipos, modo, atual);
  return (
    <>
      <View className="flex-row px-4 pb-2 pt-3">
        <MenuStatus estados={estados} contagem={contagem} valor={atual} escolher={setEscolhido} />
      </View>
      <ListaDeBlocos props={props} blocos={blocos} vazio={textos.vazio(NOMES_ESTADO[atual])} />
    </>
  );
}

type PropsMenu = {
  estados: EstadoConsumo[];
  contagem: Record<EstadoConsumo, number>;
  valor: EstadoConsumo;
  escolher(e: EstadoConsumo): void;
};

/** Pílula "Em progresso (4) ▾" no estilo da pílula de catálogo, com menu ancorado. */
function MenuStatus({ estados, contagem, valor, escolher }: PropsMenu) {
  const paleta = usePaleta();
  const animar = useAnimar();
  const insets = useSafeAreaInsets();
  const pilula = useRef<ComponentRef<typeof View>>(null);
  const [aberto, setAberto] = useState(false);
  const [ancora, setAncora] = useState<{ topo: number; esquerda: number } | null>(null);
  const entrada = useSharedValue(0);
  const estilo = useAnimatedStyle(() => ({ opacity: entrada.get(), transform: [{ scale: 0.92 + 0.08 * entrada.get() }] }));

  function abrir() {
    pilula.current?.measureInWindow((x, y, _w, h) => setAncora({ topo: y + h + 4, esquerda: x }));
    setAberto(true);
    entrada.set(animar ? withTiming(1, { duration: 150 }) : 1);
    AccessibilityInfo.announceForAccessibility(`Menu ${textos.status} aberto`);
  }
  function fechar() {
    entrada.set(0);
    setAberto(false);
  }
  const posicao = ancora ?? { topo: insets.top + 110, esquerda: 16 };
  const titulo = `${NOMES_ESTADO[valor]} (${contagem[valor]})`;

  return (
    <>
      <Pressable
        ref={pilula}
        accessibilityRole="button"
        accessibilityLabel={`${textos.status}: ${titulo}`}
        accessibilityHint="Abre o menu para trocar o Status"
        accessibilityState={{ expanded: aberto }}
        onPress={abrir}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <View className="flex-row items-center gap-1.5 rounded-full border border-dark-border bg-dark-secondary px-3.5 py-2">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: corDoEstado(valor, paleta) }} />
          <Text maxFontSizeMultiplier={1.3} className="text-corpo font-semibold text-accent-blue">
            {titulo}
          </Text>
          <Ionicons name="chevron-down" size={16} color={paleta.text.secondary} />
        </View>
      </Pressable>
      <Modal transparent statusBarTranslucent visible={aberto} animationType="none" onRequestClose={fechar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" onPress={fechar} className="absolute inset-0" />
        <Animated.View
          accessibilityRole="menu"
          accessibilityLabel={textos.status}
          className="rounded-md border border-dark-border bg-dark-secondary py-1"
          style={[{ position: 'absolute', top: posicao.topo, left: posicao.esquerda, minWidth: 220, elevation: 8 }, estilo]}
        >
          {estados.map((e) => {
            const atual = e === valor;
            return (
              <Pressable
                key={e}
                accessibilityRole="menuitem"
                accessibilityLabel={`${NOMES_ESTADO[e]} (${contagem[e]})`}
                accessibilityState={{ selected: atual }}
                onPress={() => {
                  escolher(e);
                  fechar();
                }}
                className="flex-row items-center gap-3 px-4"
                style={{ minHeight: 48 }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: corDoEstado(e, paleta) }} />
                <Text className={`flex-1 text-corpo ${atual ? 'font-semibold text-accent-blue' : 'text-text-primary'}`}>
                  {NOMES_ESTADO[e]}
                </Text>
                <Text className="text-legenda text-texto-suave" style={{ fontVariant: ['tabular-nums'] }}>
                  {contagem[e]}
                </Text>
                <View style={{ width: 18 }}>{atual ? <Ionicons name="checkmark" size={18} color={paleta.accent.blue} /> : null}</View>
              </Pressable>
            );
          })}
        </Animated.View>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- (b) seções recolhíveis

function ListaSecoes(props: PropsLista) {
  const modo = useEixo('lista-tipo');
  // Só o que o usuário mudou; o resto segue a regra inicial (Concluído/Abandonado longos recolhidos).
  const [mudadas, setMudadas] = useState<Partial<Record<EstadoConsumo, boolean>>>({});
  const estados = estadosDaLista(props.tipos);

  const blocos = useMemo(() => {
    const todos: Bloco[] = [];
    for (const estado of ORDEM_SECOES) {
      if (!estados.includes(estado)) continue;
      // Nas seções cada Item aparece uma vez: Platinado não se repete em Concluído.
      const doEstado = props.itens.filter((i) => estadoDe(i.status_consumo, i.tipo) === estado);
      if (!doEstado.length) continue;
      const inicial = !((estado === 'concluido' || estado === 'abandonado') && doEstado.length > RECOLHE_ACIMA);
      const aberta = mudadas[estado] ?? inicial;
      todos.push({ k: 'secao', estado, n: doEstado.length, aberta });
      if (aberta) todos.push(...blocosDoStatus(doEstado, props.tipos, modo, estado));
    }
    return todos;
  }, [estados, props.itens, props.tipos, modo, mudadas]);

  const alternar = (estado: EstadoConsumo) => {
    const atual = blocos.find((b) => b.k === 'secao' && b.estado === estado);
    if (atual?.k === 'secao') setMudadas((m) => ({ ...m, [estado]: !atual.aberta }));
  };

  return <ListaDeBlocos props={props} blocos={blocos} vazio={textos.listaVazia} alternar={alternar} />;
}

function CabecalhoSecao({ bloco, alternar }: { bloco: Extract<Bloco, { k: 'secao' }>; alternar(): void }) {
  const paleta = usePaleta();
  const animar = useAnimar();
  const giro = useSharedValue(bloco.aberta ? 1 : 0);
  useEffect(() => {
    giro.set(animar ? withTiming(bloco.aberta ? 1 : 0, { duration: 180 }) : bloco.aberta ? 1 : 0);
  }, [bloco.aberta, animar, giro]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ rotate: `${-90 + 90 * giro.get()}deg` }] }));
  const cor = corDoEstado(bloco.estado, paleta);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${NOMES_ESTADO[bloco.estado]} (${bloco.n})`}
      accessibilityState={{ expanded: bloco.aberta }}
      onPress={alternar}
      className="mx-4 mt-2 flex-row items-center gap-2.5 border-b border-dark-border pb-2 pt-1 active:opacity-70"
      style={{ minHeight: 44 }}
    >
      <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: cor }} />
      <Text className="text-titulo-secao font-bold text-texto-forte">{NOMES_ESTADO[bloco.estado]}</Text>
      <View className="rounded-full bg-superficie-alta px-2 py-0.5">
        <Text className="text-legenda font-semibold text-texto-suave" style={{ fontVariant: ['tabular-nums'] }}>
          {bloco.n}
        </Text>
      </View>
      <View className="flex-1" />
      <Animated.View style={estilo}>
        <Ionicons name="chevron-down" size={20} color={paleta.text.secondary} />
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- (c) páginas deslizáveis

function ListaPaginas(props: PropsLista) {
  const paleta = usePaleta();
  const animar = useAnimar();
  const modo = useEixo('lista-tipo');
  const { width } = useWindowDimensions();
  const pager = useRef<PagerView>(null);
  const [pagina, setPagina] = useState(0);
  const posicao = useSharedValue(0);
  const estados = estadosDaLista(props.tipos);
  const contagem = contarPorEstado(props.itens);
  const larguraAba = width / estados.length;
  const sublinhado = useAnimatedStyle(() => ({ transform: [{ translateX: posicao.get() * larguraAba }] }));

  const ir = (i: number) => {
    if (animar) pager.current?.setPage(i);
    else pager.current?.setPageWithoutAnimation(i);
  };

  return (
    <>
      <View accessibilityRole="tablist" accessibilityLabel={textos.status} className="border-b border-dark-border">
        <View className="flex-row">
          {estados.map((e, i) => {
            const ativo = i === pagina;
            return (
              <Pressable
                key={e}
                accessibilityRole="tab"
                accessibilityLabel={`${NOMES_ESTADO[e]} (${contagem[e]})`}
                accessibilityState={{ selected: ativo }}
                onPress={() => ir(i)}
                className="items-center justify-center py-2"
                style={{ width: larguraAba, minHeight: 48 }}
              >
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  className={`text-legenda ${ativo ? 'font-bold text-texto-forte' : 'font-medium text-texto-suave'}`}
                >
                  {CURTOS[e]}
                </Text>
                <Text maxFontSizeMultiplier={1.2} className={`text-[13px] ${ativo ? 'text-accent-blue' : 'text-texto-suave'}`}>
                  {contagem[e]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Animated.View style={[{ width: larguraAba, height: 3, alignItems: 'center' }, sublinhado]}>
          <View style={{ width: larguraAba * 0.6, height: 3, borderRadius: 2, backgroundColor: paleta['marca-forte'] }} />
        </Animated.View>
      </View>
      <PagerView
        ref={pager}
        style={{ flex: 1 }}
        initialPage={0}
        onPageScroll={(e) => posicao.set(e.nativeEvent.position + e.nativeEvent.offset)}
        onPageSelected={(e) => {
          setPagina(e.nativeEvent.position);
          posicao.set(e.nativeEvent.position);
        }}
      >
        {estados.map((e) => (
          <View key={e} style={{ flex: 1 }}>
            <ListaDeBlocos
              props={props}
              blocos={blocosDoStatus(itensDoEstado(props.itens, e), props.tipos, modo, e)}
              vazio={textos.vazio(NOMES_ESTADO[e])}
            />
          </View>
        ))}
      </PagerView>
    </>
  );
}
