// As conquistas da Steam de um jogo da Lista pessoal (spec `conquistas-steam`): aberta pelo
// "34/50 conquistas" do Detalhe, pelo id da Mídia. A API já manda na ordem do Detalhe, com a
// oculta não obtida sem nome nem descrição.
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConquistasDoItem } from '@/api/conquistas';
import { useItemDaLista } from '@/api/lista';
import { useSessao } from '@/auth/SessaoContext';
import { LinhaDaConquista } from '@/components/Conquistas';
import { Carregando, Falha, Vazio } from '@/components/EstadoTela';
import { Voltar } from '@/components/TopoDetalhe';
import { TEXTOS_DAS_CONQUISTAS, textoDoResumo } from '@dominio/conquistas';
import { tituloDaMidia } from '@dominio/midia';

/** Fora das abas, a tela precisa do próprio guard: um deep link pode abrir sem sessão. */
export default function TelaConquistas() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;
  if (sessao.estado === 'troca_de_senha') return <Redirect href="/definir-senha" />;
  return <Conquistas />;
}

function Conquistas() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const item = useItemDaLista(id);
  const conquistas = useConquistasDoItem(item.data?.id_lista);
  const voltar = () =>
    router.canGoBack() ? router.back() : router.replace({ pathname: '/midia/[id]', params: { id } });
  const jogo = item.data ? tituloDaMidia(item.data) : '';
  const resumo = textoDoResumo(item.data?.conquistas);

  const corpo = () => {
    if (item.isError) return <Falha erro={item.error} tentarDeNovo={() => item.refetch()} />;
    if (item.data === null) return <Vazio mensagem={TEXTOS_DAS_CONQUISTAS.vazia} />;
    if (conquistas.isError) return <Falha erro={conquistas.error} tentarDeNovo={() => conquistas.refetch()} />;
    if (!conquistas.data) return <Carregando />;
    if (!conquistas.data.length) return <Vazio mensagem={TEXTOS_DAS_CONQUISTAS.vazia} />;
    return (
      <FlatList
        data={conquistas.data}
        keyExtractor={(c) => c.codigo}
        renderItem={({ item: c }) => <LinhaDaConquista conquista={c} jogo={jogo} />}
        ItemSeparatorComponent={() => <View className="h-px bg-borda" />}
        contentContainerClassName="px-4 pb-10"
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-fundo">
      <Voltar aoVoltar={voltar} />
      <View className="gap-1 px-4 pb-2">
        <Text accessibilityRole="header" className="text-titulo-secao font-bold text-texto-forte">
          {TEXTOS_DAS_CONQUISTAS.titulo}
        </Text>
        {jogo ? (
          <Text className="text-corpo text-texto-suave">
            {resumo ? `${jogo} · ${resumo}` : jogo}
          </Text>
        ) : null}
      </View>
      {corpo()}
    </SafeAreaView>
  );
}
