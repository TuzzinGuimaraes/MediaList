import { useRef, useState } from 'react';
import { Animated, FlatList, RefreshControl, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { useLista } from '../api/lista';
import { useEmAlta } from '../api/midias';
import type { ItemLista } from '../api/tipos';
import { contarPorEstado, type EstadoConsumo, NOMES_ESTADO, NOMES_TIPO, type TipoMidia } from '../dominio/estadoConsumo';
import { porTipo } from '../dominio/filtrosLista';
import { foraDe } from '../dominio/inicio';
import { estadosDaLista, itensDoEstado } from '../dominio/itemLista';
import { useRecorte } from '../recorte/RecorteContext';
import { useReduzirMovimento } from '../tema/movimento';
import { AbasStatus, TituloDaAba } from './AbasStatus';
import { Carrossel } from './Carrossel';
import { type AcoesDoItem, LinhaDaLista } from './LinhaItem';
import { TituloSecao } from './Secao';
import { BotaoFiltros, type ControleDosFiltros } from './SheetFiltros';
import { useAtualizar } from './useAtualizar';

const textos = {
  itens: 'Itens da Lista',
  vazio: (estado: string) => `Nenhum Item em ${estado}.`,
  vazioFiltrado: (estado: string) => `Nenhum Item em ${estado} com esses filtros.`,
  sugestoes: 'Sugestões para você',
};

type PropsPaginas = {
  /** Itens do catálogo já filtrados e na Ordem escolhida. */
  itens: ItemLista[];
  tipos: TipoMidia[];
  estado: EstadoConsumo;
  escolher(estado: EstadoConsumo): void;
  filtros: ControleDosFiltros;
  acoes: AcoesDoItem;
};

/** Páginas deslizáveis por Status, com as abas, o título da aba ativa e o botão de filtros. */
export function PaginasStatus({ itens, tipos, estado, escolher, filtros, acoes }: PropsPaginas) {
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

/** Uma linha da página: o cabeçalho de uma subseção por Tipo ou um Item. */
type Bloco = { subsecao: TipoMidia; total: number } | { item: ItemLista };

type PropsPagina = {
  itens: ItemLista[];
  tipos: TipoMidia[];
  vazio: string;
  acoes: AcoesDoItem;
};

/** Uma página: subseções "Anime · N" e "Mangá · N", e as Sugestões no fim. */
function PaginaStatus({ itens, tipos, vazio, acoes }: PropsPagina) {
  const lista = useLista();
  const atualizar = useAtualizar(lista);
  const blocos = porTipo(itens, tipos).flatMap(({ tipo, itens: doTipo }): Bloco[] => [
    ...(tipo ? [{ subsecao: tipo, total: doTipo.length }] : []),
    ...doTipo.map((item) => ({ item })),
  ]);
  return (
    <FlatList<Bloco>
      accessibilityLabel={textos.itens}
      data={blocos}
      keyExtractor={(b) => ('subsecao' in b ? `tipo-${b.subsecao}` : b.item.id_lista)}
      renderItem={({ item: b }) =>
        'subsecao' in b ? (
          <TituloSecao className="px-4 pt-2">{`${NOMES_TIPO[b.subsecao]} · ${b.total}`}</TituloSecao>
        ) : (
          <LinhaDaLista item={b.item} acoes={acoes} />
        )
      }
      ListEmptyComponent={<Text className="p-6 text-center text-corpo text-texto-suave">{vazio}</Text>}
      ListFooterComponent={<Sugestoes />}
      refreshControl={<RefreshControl {...atualizar} />}
      contentContainerClassName="gap-3 pb-6 pt-2"
    />
  );
}

/** "Sugestões para você": Mídias de Em alta do catálogo que não estão na Lista, no carrossel do Início. */
function Sugestoes() {
  const { recorte } = useRecorte();
  const emAlta = useEmAlta(recorte);
  const lista = useLista();
  return <Carrossel titulo={textos.sugestoes} midias={foraDe(emAlta.data, lista.data)} className="mt-4" />;
}
