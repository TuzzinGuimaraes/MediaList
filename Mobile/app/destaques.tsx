// Seletor de destaques do Perfil (spec `conquistas-steam`, ticket 04): aberta pelo "Escolher destaques"
// da seção "Conquistas em destaque", com todas as conquistas obtidas do Usuário, busca pelo nome,
// filtro por jogo, "Só as destacadas" e a ordem (raridade ou data), em páginas de 50 que chegam ao
// rolar. Destacar e tirar usam a mesma escrita da tela de conquistas do jogo.
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConquistasDoSeletor, useJogosComConquistas } from '@/api/conquistas';
import { useSessao } from '@/auth/SessaoContext';
import { Botao } from '@/components/Botao';
import { BotaoDeDestaque, LinhaDaConquista } from '@/components/Conquistas';
import { Carregando, Falha, Vazio } from '@/components/EstadoTela';
import { Opcoes } from '@/components/Opcoes';
import { Voltar } from '@/components/TopoDetalhe';
import { useValorAtrasado } from '@/components/useValorAtrasado';
import { useCores } from '@/tema/TemaContext';
import {
  FILTROS_INICIAIS_DO_SELETOR,
  type FiltrosDoSeletor,
  ORDENS_DO_SELETOR,
  TEXTOS_DAS_CONQUISTAS,
} from '@dominio/conquistas';

const ATRASO_BUSCA_MS = 300;
const ORDENS = ORDENS_DO_SELETOR.map((o) => ({ valor: o.valor, titulo: o.rotulo }));

/** Fora das abas, a tela precisa do próprio guard: um deep link pode abrir sem sessão. */
export default function TelaEscolherDestaques() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;
  if (sessao.estado === 'troca_de_senha') return <Redirect href="/definir-senha" />;
  return <EscolherDestaques />;
}

function EscolherDestaques() {
  const router = useRouter();
  const cores = useCores();
  const [texto, setTexto] = useState('');
  const busca = useValorAtrasado(texto.trim(), ATRASO_BUSCA_MS);
  const [escolhas, setEscolhas] = useState<Omit<FiltrosDoSeletor, 'busca'>>(FILTROS_INICIAIS_DO_SELETOR);
  const filtros: FiltrosDoSeletor = { ...escolhas, busca };
  const mudar = (parte: Partial<FiltrosDoSeletor>) => setEscolhas((atual) => ({ ...atual, ...parte }));
  const jogos = useJogosComConquistas();
  const conquistas = useConquistasDoSeletor(filtros);
  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/perfil'));

  const opcoesDeJogo = [
    { valor: null as number | null, titulo: TEXTOS_DAS_CONQUISTAS.todosOsJogos },
    ...(jogos.data ?? []).map((j) => ({ valor: j.steam_appid as number | null, titulo: j.jogo })),
  ];

  const corpo = () => {
    if (conquistas.isError && !conquistas.data) {
      return <Falha erro={conquistas.error} tentarDeNovo={() => conquistas.refetch()} />;
    }
    if (!conquistas.data) return <Carregando />;
    if (!conquistas.data.length) return <Vazio mensagem={TEXTOS_DAS_CONQUISTAS.nenhumaNoSeletor} />;
    return (
      <FlatList
        accessibilityLabel={TEXTOS_DAS_CONQUISTAS.obtidas}
        data={conquistas.data}
        keyExtractor={(c) => `${c.id_lista}/${c.codigo}`}
        renderItem={({ item: c }) => (
          <LinhaDaConquista conquista={c} jogo={c.jogo} comJogo acao={<BotaoDeDestaque conquista={c} />} />
        )}
        ItemSeparatorComponent={() => <View className="h-px bg-borda" />}
        contentContainerClassName="px-4 pb-10"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (conquistas.hasNextPage && !conquistas.isFetchingNextPage) conquistas.fetchNextPage();
        }}
        ListFooterComponent={
          conquistas.isFetchingNextPage ? (
            <ActivityIndicator color={cores['marca-texto']} />
          ) : conquistas.isFetchNextPageError ? (
            <View className="items-center">
              <Botao titulo="Tentar de novo" variante="secundario" onPress={() => conquistas.fetchNextPage()} />
            </View>
          ) : undefined
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-fundo">
      <Voltar aoVoltar={voltar} />
      <View className="gap-3 border-b border-borda pb-3">
        <Text accessibilityRole="header" className="px-4 text-titulo-secao font-bold text-texto-forte">
          {TEXTOS_DAS_CONQUISTAS.escolherDestaques}
        </Text>
        <View className="px-4">
          <TextInput
            accessibilityLabel={TEXTOS_DAS_CONQUISTAS.buscar}
            placeholder={TEXTOS_DAS_CONQUISTAS.buscar}
            placeholderTextColor={cores['texto-suave']}
            value={texto}
            onChangeText={setTexto}
            autoCorrect={false}
            returnKeyType="search"
            className="min-h-[44px] rounded-md border border-borda bg-superficie-alta px-3 py-2.5 text-campo text-texto-forte"
          />
        </View>
        <Opcoes
          rotulo={TEXTOS_DAS_CONQUISTAS.jogo}
          opcoes={opcoesDeJogo}
          valor={escolhas.steamAppid}
          escolher={(steamAppid) => mudar({ steamAppid })}
        />
        <Opcoes
          rotulo={TEXTOS_DAS_CONQUISTAS.ordenarPor}
          opcoes={ORDENS}
          valor={escolhas.ordem}
          escolher={(ordem) => mudar({ ordem })}
        />
        <View className="min-h-11 flex-row items-center justify-between gap-3 px-4">
          <Text className="text-corpo text-texto-forte">{TEXTOS_DAS_CONQUISTAS.soDestacadas}</Text>
          <Switch
            accessibilityLabel={TEXTOS_DAS_CONQUISTAS.soDestacadas}
            value={escolhas.soDestacadas}
            onValueChange={(soDestacadas) => mudar({ soDestacadas })}
            trackColor={{ true: cores.marca, false: cores.borda }}
            thumbColor={cores.superficie}
          />
        </View>
      </View>
      {corpo()}
    </SafeAreaView>
  );
}
