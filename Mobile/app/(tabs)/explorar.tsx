import { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useBuscaMidias, useGeneros } from '@/api/explorar';
import type { OrdemCatalogo, TipoMidia } from '@/api/tipos';
import { Botao } from '@/components/Botao';
import { CardMidia } from '@/components/CardMidia';
import { Carregando, Falha, FalhaParcial, Vazio } from '@/components/EstadoTela';
import { BotaoFiltros, GrupoFiltro, SheetFiltros } from '@/components/SheetFiltros';
import { NOMES_TIPO } from '@/dominio/estadoConsumo';
import { ConteudoRecorte, TIPOS_DO_RECORTE, useRecorte } from '@/recorte/RecorteContext';
import { useCores } from '@/tema/TemaContext';
import { useCabecalhoQueEsconde } from '@/tema/useCabecalhoQueEsconde';

const textos = {
  busca: 'Buscar por título',
  tipo: 'Tipo de mídia',
  genero: 'Gênero',
  todosGeneros: 'Todos',
  ordem: 'Ordem',
  resultados: 'Resultados',
  limpar: 'Limpar filtros',
  nadaEncontrado: (termo: string) => `Nenhuma Mídia encontrada para "${termo}".`,
  nadaNoFiltro: 'Nenhuma Mídia com esses filtros.',
};

const ORDEM_PADRAO: OrdemCatalogo = 'nota_media';
const ORDENS: { valor: OrdemCatalogo; titulo: string }[] = [
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

/**
 * Explorar: busca compacta e botão de filtros (Tipo, Gênero e ordem num sheet) no cabeçalho,
 * que esconde ao rolar para baixo; grade de cards A.
 */
export default function Explorar() {
  const cores = useCores();
  const { recorte } = useRecorte();
  const tipos = TIPOS_DO_RECORTE[recorte];
  const [tipoEscolhido, setTipoEscolhido] = useState<TipoMidia>(tipos[0]);
  const tipo = tipos.includes(tipoEscolhido) ? tipoEscolhido : tipos[0];
  // Gênero vale só para o Tipo em que foi escolhido: trocar Tipo ou Recorte o limpa.
  const [genero, setGenero] = useState<{ tipo: TipoMidia; nome: string } | null>(null);
  const nomeGenero = genero?.tipo === tipo ? genero.nome : null;
  const [ordem, setOrdem] = useState<OrdemCatalogo>(ORDEM_PADRAO);
  const [texto, setTexto] = useState('');
  const termo = useValorAtrasado(texto.trim(), ATRASO_BUSCA_MS);
  const busca = termo.length >= MINIMO_BUSCA ? termo : '';
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const generos = useGeneros(tipo);
  const resultados = useBuscaMidias({ tipo, ordem, genero: nomeGenero, busca });
  const cabecalho = useCabecalhoQueEsconde();
  const { mostrar } = cabecalho;

  // Filtros ou busca novos trazem outra lista, que começa do topo: o cabeçalho volta.
  useEffect(mostrar, [mostrar, tipo, nomeGenero, ordem, busca]);

  const ativos = (tipo !== tipos[0] ? 1 : 0) + (nomeGenero ? 1 : 0) + (ordem !== ORDEM_PADRAO ? 1 : 0);
  const limpar = () => {
    setTipoEscolhido(tipos[0]);
    setGenero(null);
    setOrdem(ORDEM_PADRAO);
  };

  let conteudo: React.ReactNode;
  if (resultados.data?.length === 0) {
    conteudo = <Vazio mensagem={busca ? textos.nadaEncontrado(busca) : textos.nadaNoFiltro} />;
  } else if (resultados.data) {
    conteudo = (
      <Animated.FlatList
        accessibilityLabel={textos.resultados}
        onScroll={cabecalho.aoRolar}
        scrollEventThrottle={16}
        // Espaço do cabeçalho flutuante; o gap da lista já separa a primeira fileira.
        ListHeaderComponent={cabecalho.folga ? <View style={{ height: cabecalho.folga - 8 }} /> : undefined}
        data={resultados.data}
        numColumns={COLUNAS}
        keyExtractor={(m) => m.id_midia}
        renderItem={({ item }) => (
          <View className="flex-1 px-1.5" style={{ maxWidth: `${100 / COLUNAS}%` }}>
            <CardMidia midia={item} />
          </View>
        )}
        contentContainerClassName={`gap-4 px-2.5 pb-6 ${cabecalho.folga ? '' : 'pt-3'}`}
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (resultados.hasNextPage && !resultados.isFetchingNextPage) resultados.fetchNextPage();
        }}
        ListFooterComponent={
          resultados.isFetchingNextPage ? (
            <ActivityIndicator color={cores['marca-texto']} />
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

  return (
    <ConteudoRecorte>
      <View className="flex-1 overflow-hidden">
        <Animated.View
          onLayout={cabecalho.aoMedir}
          style={[
            cabecalho.esconde ? { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 } : null,
            cabecalho.estilo,
          ]}
          className="flex-row items-center gap-2 border-b border-borda bg-fundo px-4 py-3"
        >
          <TextInput
            accessibilityLabel={textos.busca}
            placeholder={textos.busca}
            placeholderTextColor={cores['texto-suave']}
            value={texto}
            onChangeText={setTexto}
            autoCorrect={false}
            returnKeyType="search"
            className="min-h-[44px] flex-1 rounded-md border border-borda bg-superficie-alta px-3 py-2.5 text-campo text-texto-forte"
          />
          <BotaoFiltros ativos={ativos} onPress={() => setFiltrosAbertos(true)} />
        </Animated.View>
        {resultados.data?.length ? (
          conteudo
        ) : (
          <View style={{ flex: 1, paddingTop: cabecalho.folga }}>{conteudo}</View>
        )}
      </View>
      {filtrosAbertos ? (
        <SheetFiltros aoFechar={() => setFiltrosAbertos(false)} limpar={limpar} tituloLimpar={textos.limpar}>
          {tipos.length > 1 ? (
            <GrupoFiltro
              rotulo={textos.tipo}
              opcoes={tipos.map((t) => ({ valor: t, titulo: NOMES_TIPO[t] }))}
              valor={tipo}
              escolher={setTipoEscolhido}
            />
          ) : null}
          <GrupoFiltro
            rotulo={textos.genero}
            opcoes={[
              { valor: null, titulo: textos.todosGeneros },
              ...(generos.data ?? []).map((nome) => ({ valor: nome, titulo: nome })),
            ]}
            valor={nomeGenero}
            escolher={(nome) => setGenero(nome ? { tipo, nome } : null)}
          />
          {generos.isError && !generos.data ? (
            <FalhaParcial erro={generos.error} tentarDeNovo={() => generos.refetch()} />
          ) : null}
          <GrupoFiltro rotulo={textos.ordem} opcoes={ORDENS} valor={ordem} escolher={setOrdem} />
        </SheetFiltros>
      ) : null}
    </ConteudoRecorte>
  );
}
