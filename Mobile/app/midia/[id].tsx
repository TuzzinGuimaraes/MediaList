// PROTÓTIPO (ticket 29), 2ª rodada: um layout só. O A da 1ª rodada (banner com o pôster
// sobreposto) + o botão grande carmesim de adicionar/editar na Lista (do B) logo abaixo do
// título + o título alternativo em texto suave. O banner leva as assinaturas ligadas.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAvaliacoes } from '@/api/avaliacoes';
import { useItemDaLista } from '@/api/lista';
import { useDistribuicao, useMidia } from '@/api/midias';
import type { ItemLista, Midia } from '@/api/tipos';
import { useSessao } from '@/auth/SessaoContext';
import { EditorItem } from '@/components/EditorItem';
import { Carregando, Falha, FalhaParcial } from '@/components/EstadoTela';
import { SecaoAvaliacoes } from '@/components/SecaoAvaliacoes';
import { SeloTipo } from '@/components/SeloTipo';
import { estadoDe, nomeDoRotulo, somarPorEstado, type TipoMidia } from '@/dominio/estadoConsumo';
import { temProgresso, totalDoItem } from '@/dominio/itemLista';
import { formatarData } from '@/dominio/datas';
import { atributosDoTipo, distribuicaoDeNotas, notasDaMidia, ROTULO_NOTA_MEDIA, tituloDaMidia } from '@/dominio/midia';
import { BannerAssinado, FioProgresso } from '@/prototipo/PrototipoAssinatura';
import { usePaleta } from '@/prototipo/PrototipoContext';
import { Entrada, ToqueAnimado } from '@/prototipo/PrototipoMovimento';
import { SeloStatus, SelosSobrePoster } from '@/prototipo/PrototipoSelos';

const textos = {
  voltar: 'Voltar',
  lancamento: 'Lançamento',
  generos: 'Gêneros',
  totalAvaliacoes: 'Total de avaliações',
  semAvaliacoes: 'Ainda sem Avaliações.',
  notas: 'Distribuição das notas',
  naLista: 'Na sua Lista',
  adicionar: 'Adicionar à Lista',
  editarNaLista: 'Editar na Lista',
  progresso: 'Progresso',
  usuarios: 'Nas Listas dos Usuários',
  avaliacoes: (n: number) => `${n} ${n === 1 ? 'avaliação' : 'avaliações'}`,
};

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View accessible accessibilityLabel={`${rotulo}: ${valor}`} className="gap-0.5">
      <Text className="text-legenda text-text-secondary">{rotulo}</Text>
      <Text className="text-corpo text-text-bright">{valor}</Text>
    </View>
  );
}

function textoProgresso(item: ItemLista): string {
  const total = totalDoItem(item);
  const atual = item.progresso_atual ?? 0;
  return total !== null ? `${atual} de ${total}` : String(atual);
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View className="gap-3 rounded-md bg-dark-secondary p-4">
      <Text className="text-legenda font-bold uppercase tracking-wider text-text-secondary">{titulo}</Text>
      {children}
    </View>
  );
}

function Barra({ rotulo, total, maximo, a11y }: { rotulo: string; total: number; maximo: number; a11y: string }) {
  return (
    <View accessible accessibilityLabel={a11y} className="flex-row items-center gap-2">
      <Text className="w-28 text-legenda text-text-primary">{rotulo}</Text>
      <View className="h-2 flex-1 overflow-hidden rounded-full bg-dark-tertiary">
        <View
          className="h-full rounded-full bg-accent-blue"
          style={{ width: `${maximo ? (total / maximo) * 100 : 0}%` }}
        />
      </View>
      <Text className="w-9 text-right text-legenda text-text-secondary">{total}</Text>
    </View>
  );
}

/** Fora das abas, o detalhe precisa do próprio guard: um deep link pode abrir sem sessão. */
export default function TelaDetalhe() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;
  return <DetalheMidia />;
}

/** Notas da obra (Nota dos Usuários, Nota da fonte), uma por linha. */
function Notas({ m }: { m: Midia }) {
  const paleta = usePaleta();
  return (
    <>
      {notasDaMidia(m).map((n) => (
        <View key={n.rotulo} accessible accessibilityLabel={`${n.rotulo}: ${n.valor}`} className="flex-row items-center gap-1">
          <Ionicons name={n.rotulo === ROTULO_NOTA_MEDIA ? 'star' : 'star-outline'} size={16} color={paleta.accent.yellow} />
          <Text className="text-corpo font-bold text-accent-yellow">{n.valor}</Text>
          <Text className="text-legenda text-text-secondary">{n.rotulo}</Text>
        </View>
      ))}
    </>
  );
}

/** Botão voltar flutuante, sobre a imagem. */
function VoltarFlutuante({ aoVoltar }: { aoVoltar(): void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={textos.voltar}
      onPress={aoVoltar}
      hitSlop={8}
      className="absolute left-3 h-10 w-10 items-center justify-center rounded-full"
      style={{ top: insets.top + 8, backgroundColor: 'rgba(0,0,0,0.55)' }}
    >
      <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
    </Pressable>
  );
}

function DetalheMidia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const paleta = usePaleta();
  const { width } = useWindowDimensions();
  const midia = useMidia(id);
  const avaliacoes = useAvaliacoes(id);
  const distribuicao = useDistribuicao(id);
  const item = useItemDaLista(id);
  const [editor, setEditor] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!midia.data) {
    const corpo = midia.isError ? <Falha erro={midia.error} tentarDeNovo={() => midia.refetch()} /> : <Carregando />;
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-dark-primary">
        <CabecalhoVoltar aoVoltar={voltar} />
        {corpo}
      </SafeAreaView>
    );
  }

  const m = midia.data;
  const lancamento = formatarData(m.data_lancamento);
  const notas = distribuicaoDeNotas((avaliacoes.data ?? []).map((a) => a.nota));
  const maiorNota = Math.max(...notas.map((n) => n.total));
  const estados = somarPorEstado(distribuicao.data ?? [], m.tipo);
  const maiorEstado = Math.max(0, ...estados.map((e) => e.total));
  const titulo = tituloDaMidia(m);
  const estado = item.data ? estadoDe(item.data.status_consumo, m.tipo as TipoMidia) : null;

  const alternativo = [m.titulo_original, m.titulo_ingles].find((t) => t && t !== titulo) ?? null;

  const blocos = (
    <>
      {item.data ? (
        <View className="flex-row flex-wrap gap-x-6 gap-y-2 rounded-md bg-dark-secondary p-4">
          <Info rotulo={textos.naLista} valor={nomeDoRotulo(item.data.status_consumo, m.tipo)} />
          {temProgresso(m.tipo) ? <Info rotulo={textos.progresso} valor={textoProgresso(item.data)} /> : null}
        </View>
      ) : item.isError ? (
        <View className="rounded-md bg-dark-secondary p-4">
          <FalhaParcial erro={item.error} tentarDeNovo={() => item.refetch()} />
        </View>
      ) : null}
      {editor && item.data !== undefined ? <EditorItem midia={m} item={item.data} aoFechar={() => setEditor(false)} /> : null}

      {m.sinopse ? <Text className="text-corpo text-text-primary">{m.sinopse}</Text> : null}

      <View className="flex-row flex-wrap gap-x-6 gap-y-3 rounded-md bg-dark-secondary p-4">
        {lancamento ? <Info rotulo={textos.lancamento} valor={lancamento} /> : null}
        {atributosDoTipo(m).map(([rotulo, valor]) => (
          <Info key={rotulo} rotulo={rotulo} valor={valor} />
        ))}
        {m.generos_lista.length ? <Info rotulo={textos.generos} valor={m.generos_lista.join(', ')} /> : null}
      </View>

      <Secao titulo={textos.notas}>
        {avaliacoes.isError && !avaliacoes.data ? (
          <FalhaParcial erro={avaliacoes.error} tentarDeNovo={() => avaliacoes.refetch()} />
        ) : m.total_avaliacoes ? (
          notas
            .slice()
            .reverse()
            .map((n) => (
              <Barra
                key={n.nota}
                rotulo={String(n.nota)}
                total={n.total}
                maximo={maiorNota}
                a11y={`Nota ${n.nota}: ${textos.avaliacoes(n.total)}`}
              />
            ))
        ) : (
          <Text className="text-corpo text-text-secondary">{textos.semAvaliacoes}</Text>
        )}
      </Secao>

      {distribuicao.isError && !distribuicao.data ? (
        <Secao titulo={textos.usuarios}>
          <FalhaParcial erro={distribuicao.error} tentarDeNovo={() => distribuicao.refetch()} />
        </Secao>
      ) : estados.length ? (
        <Secao titulo={textos.usuarios}>
          {estados.map((e) => (
            <Barra key={e.estado} rotulo={e.nome} total={e.total} maximo={maiorEstado} a11y={`${e.nome}: ${e.total}`} />
          ))}
        </Secao>
      ) : null}

      <SecaoAvaliacoes idMidia={m.id_midia} avaliacoes={avaliacoes.data} />
    </>
  );

  return (
    <View className="flex-1 bg-fundo">
      <ScrollView contentContainerClassName="pb-10">
        <BannerAssinado
          midia={m}
          largura={width}
          altura={260}
          imagem={m.banner_url ?? m.poster_url}
          desfocar={!m.banner_url}
          estilo="detalhe"
          halo
        />
        <View className="-mt-24 flex-row items-end gap-4 px-4">
          <View className="w-32 overflow-hidden rounded-lg border-2 border-fundo bg-superficie-alta" style={{ aspectRatio: 2 / 3, elevation: 8 }}>
            {m.poster_url ? (
              <Image source={m.poster_url} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" transition={150} />
            ) : null}
            <SelosSobrePoster midia={m} tipo={false} status={false} />
            <FioProgresso idMidia={m.id_midia} />
          </View>
          <Entrada direcao="baixo" style={{ flex: 1, gap: 4, paddingBottom: 4 }}>
            <SeloTipo tipo={m.tipo} />
            <Text accessibilityRole="header" className="text-titulo-secao font-bold text-texto-forte">
              {titulo}
            </Text>
            {alternativo ? (
              <Text numberOfLines={2} className="text-legenda text-texto-suave">
                {alternativo}
              </Text>
            ) : null}
            {estado ? <SeloStatus estado={estado} /> : null}
          </Entrada>
        </View>
        <Entrada indice={2} style={{ gap: 16, padding: 16 }}>
          {item.data !== undefined ? (
            <ToqueAnimado
              accessibilityRole="button"
              accessibilityLabel={item.data ? textos.editarNaLista : textos.adicionar}
              onPress={() => setEditor(true)}
              className="flex-row items-center justify-center gap-2 rounded-md bg-marca py-3 active:bg-marca-forte"
            >
              <Ionicons name={item.data ? 'create-outline' : 'add'} size={20} color={paleta['sobre-marca']} />
              <Text className="text-corpo font-bold text-sobre-marca">{item.data ? textos.editarNaLista : textos.adicionar}</Text>
            </ToqueAnimado>
          ) : null}
          <View className="flex-row flex-wrap gap-x-5 gap-y-1">
            <Notas m={m} />
            <Info rotulo={textos.totalAvaliacoes} valor={String(m.total_avaliacoes ?? 0)} />
          </View>
          {blocos}
        </Entrada>
      </ScrollView>
      <VoltarFlutuante aoVoltar={voltar} />
    </View>
  );
}

function CabecalhoVoltar({ aoVoltar }: { aoVoltar(): void }) {
  const paleta = usePaleta();
  return (
    <View className="flex-row items-center border-b border-dark-border bg-dark-nav px-2 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={textos.voltar}
        onPress={aoVoltar}
        hitSlop={8}
        className="flex-row items-center gap-1 p-2"
      >
        <Ionicons name="chevron-back" size={20} color={paleta.text.bright} />
        <Text className="text-corpo text-text-bright">{textos.voltar}</Text>
      </Pressable>
    </View>
  );
}
