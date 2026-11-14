import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAvaliacoes } from '@/api/avaliacoes';
import { useItemDaLista } from '@/api/lista';
import { useDistribuicao, useMidia, usePosicaoTop10 } from '@/api/midias';
import type { ItemLista, Midia } from '@/api/tipos';
import { useSessao } from '@/auth/SessaoContext';
import { Barra } from '@/components/Barras';
import { Botao } from '@/components/Botao';
import { EditorItem } from '@/components/EditorItem';
import { Carregando, Falha, FalhaParcial } from '@/components/EstadoTela';
import { FioProgresso } from '@/components/FioProgresso';
import { Info } from '@/components/Info';
import { Secao } from '@/components/Secao';
import { SecaoAvaliacoes } from '@/components/SecaoAvaliacoes';
import { Selo, SeloStatus, SeloTipo, SeloTop } from '@/components/Selo';
import { estadoDe, nomeDoRotulo, somarPorEstado } from '@/dominio/estadoConsumo';
import { temProgresso, totalDoItem } from '@/dominio/itemLista';
import { formatarData } from '@/dominio/datas';
import { emLancamento } from '@/dominio/situacao';
import {
  atributosDoTipo,
  distribuicaoDeNotas,
  notasDaMidia,
  ROTULO_NOTA_MEDIA,
  tituloAlternativo,
  tituloDaMidia,
} from '@/dominio/midia';
import { useCores } from '@/tema/TemaContext';

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

function textoProgresso(item: ItemLista): string {
  const total = totalDoItem(item);
  const atual = item.progresso_atual ?? 0;
  return total !== null ? `${atual} de ${total}` : String(atual);
}

/** Fora das abas, o detalhe precisa do próprio guard: um deep link pode abrir sem sessão. */
export default function TelaDetalhe() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;
  return <DetalheMidia />;
}

/** Altura do banner; o pôster sobe sobre a base dele. */
const ALTURA_BANNER = 260;

/**
 * Banner do topo: o banner da Mídia (ou o pôster desfocado, sem banner), escurecido no alto
 * para o botão voltar e fundido no fundo da tela na base. A imagem é decorativa; o selo do
 * Tipo fica sobre ela, no canto.
 */
function Banner({ midia }: { midia: Midia }) {
  const cores = useCores();
  const insets = useSafeAreaInsets();
  const imagem = midia.banner_url ?? midia.poster_url;
  return (
    <View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="overflow-hidden bg-superficie"
        style={{ height: ALTURA_BANNER }}
      >
        {imagem ? (
          <Image
            source={imagem}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            contentFit="cover"
            blurRadius={midia.banner_url ? 0 : 18}
            cachePolicy="disk"
            transition={200}
          />
        ) : null}
        <View
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 35%, transparent 60%, ${cores.fundo} 100%)`,
          }}
        />
      </View>
      {/* Fora da parte decorativa: o Tipo é lido. Na altura do voltar, no canto oposto. */}
      <View className="absolute right-3 h-10 justify-center" style={{ top: insets.top + 8 }}>
        <SeloTipo tipo={midia.tipo} sobreImagem />
      </View>
    </View>
  );
}

/** Pôster sobre a base do banner, com os selos de Top 10, lançamento e Status e o fio de progresso. */
function Poster({ midia, item }: { midia: Midia; item: ItemLista | null | undefined }) {
  const top = usePosicaoTop10(midia.id_midia);
  const lancamento = emLancamento(midia);
  const estado = item ? estadoDe(item.status_consumo, midia.tipo) : null;
  return (
    <View
      className="aspect-[2/3] w-32 overflow-hidden rounded-lg border-2 border-fundo bg-superficie-alta"
      style={{ elevation: 8 }}
    >
      {midia.poster_url ? (
        <Image
          source={midia.poster_url}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="disk"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {top ? (
        <View className="absolute right-0 top-0">
          <SeloTop posicao={top} />
        </View>
      ) : null}
      {lancamento || estado ? (
        <View className="absolute bottom-1.5 left-1 right-1 gap-1">
          {lancamento ? <Selo texto={lancamento} tom="marca" /> : null}
          {estado ? <SeloStatus estado={estado} sobreImagem /> : null}
        </View>
      ) : null}
      {item ? <FioProgresso item={item} /> : null}
    </View>
  );
}

/** Voltar flutuante sobre o banner; no carregamento e no erro, o cabeçalho com "Voltar". */
function Voltar({ aoVoltar, flutuante }: { aoVoltar(): void; flutuante?: boolean }) {
  const cores = useCores();
  const insets = useSafeAreaInsets();
  if (flutuante) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={textos.voltar}
        onPress={aoVoltar}
        hitSlop={8}
        className="absolute left-3 h-10 w-10 items-center justify-center rounded-full bg-black/55"
        style={{ top: insets.top + 8 }}
      >
        {/* Branco nos dois temas: o fundo é sempre a imagem escurecida. */}
        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
      </Pressable>
    );
  }
  return (
    <View className="flex-row items-center border-b border-borda bg-nav px-2 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={textos.voltar}
        onPress={aoVoltar}
        hitSlop={8}
        className="flex-row items-center gap-1 p-2"
      >
        <Ionicons name="chevron-back" size={20} color={cores['texto-forte']} />
        <Text className="text-corpo text-texto-forte">{textos.voltar}</Text>
      </Pressable>
    </View>
  );
}

function DetalheMidia() {
  const cores = useCores();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const midia = useMidia(id);
  const avaliacoes = useAvaliacoes(id);
  const distribuicao = useDistribuicao(id);
  const item = useItemDaLista(id);
  const [editor, setEditor] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!midia.data) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-fundo">
        <Voltar aoVoltar={voltar} />
        {midia.isError ? <Falha erro={midia.error} tentarDeNovo={() => midia.refetch()} /> : <Carregando />}
      </SafeAreaView>
    );
  }

  const m = midia.data;
  const notasDaObra = notasDaMidia(m);
  const lancamento = formatarData(m.data_lancamento);
  const notas = distribuicaoDeNotas((avaliacoes.data ?? []).map((a) => a.nota));
  const maiorNota = Math.max(...notas.map((n) => n.total));
  const estados = somarPorEstado(distribuicao.data ?? [], m.tipo);
  const maiorEstado = Math.max(0, ...estados.map((e) => e.total));
  const titulo = tituloDaMidia(m);
  const alternativo = tituloAlternativo(m);

  return (
    <View className="flex-1 bg-fundo">
      <ScrollView contentContainerClassName="pb-10">
        <Banner midia={m} />
        <View className="-mt-24 flex-row items-end gap-4 px-4">
          <Poster midia={m} item={item.data} />
          <View className="flex-1 gap-1 pb-1">
            <Text accessibilityRole="header" className="text-titulo-secao font-bold text-texto-forte">
              {titulo}
            </Text>
            {alternativo ? (
              <Text numberOfLines={2} className="text-legenda text-texto-suave">
                {alternativo}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="gap-4 p-4">
          {/* Só com a Lista carregada se sabe se é adicionar ou editar. */}
          {item.data !== undefined ? (
            <Botao
              titulo={item.data ? textos.editarNaLista : textos.adicionar}
              icone={item.data ? 'create-outline' : 'add'}
              onPress={() => setEditor(true)}
            />
          ) : null}

          <View className="flex-row flex-wrap items-center gap-x-5 gap-y-1">
            {notasDaObra.map((n) => (
              <View
                key={n.rotulo}
                accessible
                accessibilityLabel={`${n.rotulo}: ${n.valor}`}
                className="flex-row items-center gap-1"
              >
                <Ionicons
                  name={n.rotulo === ROTULO_NOTA_MEDIA ? 'star' : 'star-outline'}
                  size={16}
                  color={cores.nota}
                />
                <Text className="text-corpo font-bold text-nota">{n.valor}</Text>
                <Text className="text-legenda text-texto-suave">{n.rotulo}</Text>
              </View>
            ))}
            <Info rotulo={textos.totalAvaliacoes} valor={String(m.total_avaliacoes ?? 0)} />
          </View>

          {item.data ? (
            <View className="flex-row flex-wrap gap-x-6 gap-y-2 rounded-md bg-superficie p-4">
              <Info rotulo={textos.naLista} valor={nomeDoRotulo(item.data.status_consumo, m.tipo)} />
              {temProgresso(m.tipo) ? <Info rotulo={textos.progresso} valor={textoProgresso(item.data)} /> : null}
            </View>
          ) : item.isError ? (
            <View className="rounded-md bg-superficie p-4">
              <FalhaParcial erro={item.error} tentarDeNovo={() => item.refetch()} />
            </View>
          ) : null}
          {editor && item.data !== undefined ? (
            <EditorItem midia={m} item={item.data} aoFechar={() => setEditor(false)} />
          ) : null}

          {m.sinopse ? <Text className="text-corpo text-texto">{m.sinopse}</Text> : null}

          <View className="flex-row flex-wrap gap-x-6 gap-y-3 rounded-md bg-superficie p-4">
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
              <Text className="text-corpo text-texto-suave">{textos.semAvaliacoes}</Text>
            )}
          </Secao>

          {distribuicao.isError && !distribuicao.data ? (
            <Secao titulo={textos.usuarios}>
              <FalhaParcial erro={distribuicao.error} tentarDeNovo={() => distribuicao.refetch()} />
            </Secao>
          ) : estados.length ? (
            <Secao titulo={textos.usuarios}>
              {estados.map((e) => (
                <Barra
                  key={e.estado}
                  rotulo={e.nome}
                  total={e.total}
                  maximo={maiorEstado}
                  a11y={`${e.nome}: ${e.total}`}
                />
              ))}
            </Secao>
          ) : null}

          <SecaoAvaliacoes idMidia={m.id_midia} avaliacoes={avaliacoes.data} />
        </View>
      </ScrollView>
      <Voltar aoVoltar={voltar} flutuante />
    </View>
  );
}
