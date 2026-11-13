import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAvaliacoes } from '@/api/avaliacoes';
import { useItemDaLista } from '@/api/lista';
import { useDistribuicao, useMidia } from '@/api/midias';
import type { ItemLista } from '@/api/tipos';
import { useSessao } from '@/auth/SessaoContext';
import { Botao } from '@/components/Botao';
import { EditorItem } from '@/components/EditorItem';
import { Carregando, Falha, FalhaParcial } from '@/components/EstadoTela';
import { SecaoAvaliacoes } from '@/components/SecaoAvaliacoes';
import { nomeDoRotulo, somarPorEstado } from '@/dominio/estadoConsumo';
import { temProgresso, totalDoItem } from '@/dominio/itemLista';
import { formatarData } from '@/dominio/datas';
import { atributosDoTipo, distribuicaoDeNotas, notasDaMidia, ROTULO_NOTA_MEDIA, tituloDaMidia } from '@/dominio/midia';
import paleta from '@/tema/paleta';

const textos = {
  voltar: 'Voltar',
  lancamento: 'Lançamento',
  generos: 'Gêneros',
  totalAvaliacoes: 'Total de avaliações',
  semAvaliacoes: 'Ainda sem Avaliações.',
  notas: 'Distribuição das notas',
  naLista: 'Na sua Lista',
  foraDaLista: 'Fora da sua Lista.',
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

function DetalheMidia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const midia = useMidia(id);
  const avaliacoes = useAvaliacoes(id);
  const distribuicao = useDistribuicao(id);
  const item = useItemDaLista(id);
  const [editor, setEditor] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/'));

  let corpo: React.ReactNode;
  if (midia.data) {
    const m = midia.data;
    const notasDaObra = notasDaMidia(m);
    const lancamento = formatarData(m.data_lancamento);
    const notas = distribuicaoDeNotas((avaliacoes.data ?? []).map((a) => a.nota));
    const maiorNota = Math.max(...notas.map((n) => n.total));
    const estados = somarPorEstado(distribuicao.data ?? [], m.tipo);
    const maiorEstado = Math.max(0, ...estados.map((e) => e.total));
    const titulo = tituloDaMidia(m);

    corpo = (
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <View className="flex-row gap-4">
          <View className="aspect-[2/3] w-32 overflow-hidden rounded bg-dark-tertiary">
            {m.poster_url ? (
              <Image
                source={m.poster_url}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                cachePolicy="disk"
                transition={150}
                accessibilityIgnoresInvertColors
              />
            ) : null}
          </View>
          <View className="flex-1 gap-2">
            <Text accessibilityRole="header" className="text-titulo-secao font-bold text-text-bright">
              {titulo}
            </Text>
            {m.titulo_original !== titulo ? (
              <Text className="text-corpo text-text-secondary">{m.titulo_original}</Text>
            ) : null}
            <Text className="text-legenda text-text-secondary">{m.tipo_label}</Text>
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
                  color={paleta.accent.yellow}
                />
                <Text className="text-corpo font-bold text-accent-yellow">{n.valor}</Text>
                <Text className="text-legenda text-text-secondary">{n.rotulo}</Text>
              </View>
            ))}
            <Info rotulo={textos.totalAvaliacoes} valor={String(m.total_avaliacoes ?? 0)} />
          </View>
        </View>

        {item.data ? (
          <View className="flex-row items-center gap-4 rounded-md bg-dark-secondary p-4">
            <View className="flex-1 flex-row flex-wrap gap-x-6 gap-y-2">
              <Info rotulo={textos.naLista} valor={nomeDoRotulo(item.data.status_consumo, m.tipo)} />
              {temProgresso(m.tipo) ? (
                <Info rotulo={textos.progresso} valor={textoProgresso(item.data)} />
              ) : null}
            </View>
            <Botao titulo={textos.editarNaLista} variante="secundario" onPress={() => setEditor(true)} />
          </View>
        ) : item.data === null ? (
          <View className="flex-row items-center gap-4 rounded-md bg-dark-secondary p-4">
            <Text className="flex-1 text-corpo text-text-secondary">{textos.foraDaLista}</Text>
            <Botao titulo={textos.adicionar} onPress={() => setEditor(true)} />
          </View>
        ) : item.isError ? (
          <View className="rounded-md bg-dark-secondary p-4">
            <FalhaParcial erro={item.error} tentarDeNovo={() => item.refetch()} />
          </View>
        ) : null}
        {editor && item.data !== undefined ? (
          <EditorItem midia={m} item={item.data} aoFechar={() => setEditor(false)} />
        ) : null}

        {m.sinopse ? <Text className="text-corpo text-text-primary">{m.sinopse}</Text> : null}

        <View className="flex-row flex-wrap gap-x-6 gap-y-3 rounded-md bg-dark-secondary p-4">
          {lancamento ? <Info rotulo={textos.lancamento} valor={lancamento} /> : null}
          {atributosDoTipo(m).map(([rotulo, valor]) => (
            <Info key={rotulo} rotulo={rotulo} valor={valor} />
          ))}
          {m.generos_lista.length ? (
            <Info rotulo={textos.generos} valor={m.generos_lista.join(', ')} />
          ) : null}
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
      </ScrollView>
    );
  } else if (midia.isError) {
    corpo = <Falha erro={midia.error} tentarDeNovo={() => midia.refetch()} />;
  } else {
    corpo = <Carregando />;
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark-primary">
      <View className="flex-row items-center border-b border-dark-border bg-dark-nav px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={textos.voltar}
          onPress={voltar}
          hitSlop={8}
          className="flex-row items-center gap-1 p-2"
        >
          <Ionicons name="chevron-back" size={20} color={paleta.text.bright} />
          <Text className="text-corpo text-text-bright">{textos.voltar}</Text>
        </Pressable>
      </View>
      {corpo}
    </SafeAreaView>
  );
}
