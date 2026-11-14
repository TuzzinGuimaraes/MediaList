import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAvaliacoes, useNotas } from '@/api/avaliacoes';
import { useItemDaLista } from '@/api/lista';
import { useDistribuicao, useMidia } from '@/api/midias';
import { useSessao } from '@/auth/SessaoContext';
import { Barra } from '@/components/Barras';
import { Botao } from '@/components/Botao';
import { EditorItem } from '@/components/EditorItem';
import { Carregando, Falha, FalhaParcial } from '@/components/EstadoTela';
import { Info } from '@/components/Info';
import { Secao } from '@/components/Secao';
import { SecaoAvaliacoes } from '@/components/SecaoAvaliacoes';
import { Banner, PosterDoDetalhe, Voltar } from '@/components/TopoDetalhe';
import { formatarData } from '@/dominio/datas';
import { nomeDoRotulo, somarPorEstado } from '@/dominio/estadoConsumo';
import { temProgresso, textoDoProgresso } from '@/dominio/itemLista';
import {
  atributosDoTipo,
  notasDaMidia,
  ROTULO_NOTA_MEDIA,
  tituloAlternativo,
  tituloDaMidia,
} from '@/dominio/midia';
import { useCores } from '@/tema/TemaContext';

const textos = {
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

/** Fora das abas, o detalhe precisa do próprio guard: um deep link pode abrir sem sessão. */
export default function TelaDetalhe() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;
  return <DetalheMidia />;
}

function DetalheMidia() {
  const cores = useCores();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const midia = useMidia(id);
  const avaliacoes = useAvaliacoes(id);
  const notasDasAvaliacoes = useNotas(id);
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
  // As 10 faixas, de todas as Avaliações (GET /midias/<id>/notas).
  const notas = notasDasAvaliacoes.data?.distribuicao ?? [];
  const maiorNota = Math.max(0, ...notas.map((n) => n.total));
  const estados = somarPorEstado(distribuicao.data ?? [], m.tipo);
  const maiorEstado = Math.max(0, ...estados.map((e) => e.total));
  const titulo = tituloDaMidia(m);
  const alternativo = tituloAlternativo(m);

  return (
    <View className="flex-1 bg-fundo">
      <ScrollView contentContainerClassName="pb-10">
        <Banner midia={m} />
        <View className="-mt-24 flex-row items-end gap-4 px-4">
          <PosterDoDetalhe midia={m} item={item.data} />
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
              {temProgresso(m.tipo) ? <Info rotulo={textos.progresso} valor={textoDoProgresso(item.data)} /> : null}
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
            {notasDasAvaliacoes.isError && !notasDasAvaliacoes.data ? (
              <FalhaParcial erro={notasDasAvaliacoes.error} tentarDeNovo={() => notasDasAvaliacoes.refetch()} />
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

          <SecaoAvaliacoes
            idMidia={m.id_midia}
            avaliacoes={avaliacoes.data?.itens}
            minha={notasDasAvaliacoes.data?.minha_avaliacao}
            falha={
              avaliacoes.isError && !avaliacoes.data ? (
                <FalhaParcial erro={avaliacoes.error} tentarDeNovo={() => avaliacoes.refetch()} />
              ) : null
            }
          />
        </View>
      </ScrollView>
      <Voltar aoVoltar={voltar} flutuante />
    </View>
  );
}
