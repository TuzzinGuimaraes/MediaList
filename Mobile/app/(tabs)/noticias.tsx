import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { useMarcarTodasLidas, useNoticias, useNotificacoes } from '@/api/noticias';
import type { Noticia, Notificacao } from '@/api/tipos';
import { Botao } from '@/components/Botao';
import { Carregando, Falha, Vazio } from '@/components/EstadoTela';
import { useAtualizar } from '@/components/useAtualizar';
import { formatarData } from '@/dominio/datas';

type SubAba = 'noticias' | 'notificacoes';

const subAbas: { chave: SubAba; titulo: string }[] = [
  { chave: 'noticias', titulo: 'Notícias' },
  { chave: 'notificacoes', titulo: 'Notificações' },
];

function CartaoNoticia({ noticia }: { noticia: Noticia }) {
  return (
    <View className="overflow-hidden rounded-md bg-superficie">
      {noticia.imagem_url ? (
        <Image
          source={noticia.imagem_url}
          style={{ width: '100%', height: 160 }}
          contentFit="cover"
          cachePolicy="disk"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View className="gap-2 p-4">
        <Text className="text-titulo-secao font-bold text-texto-forte">{noticia.titulo}</Text>
        <Text className="text-legenda text-texto-suave">
          Por {noticia.autor} · {formatarData(noticia.data_publicacao)}
        </Text>
        {noticia.conteudo ? <Text className="text-corpo text-texto">{noticia.conteudo}</Text> : null}
        {noticia.tags?.length ? (
          <View className="flex-row flex-wrap gap-1.5">
            {noticia.tags.map((tag) => (
              <Text
                key={tag}
                maxFontSizeMultiplier={1.3}
                className="rounded bg-superficie-alta px-2 py-0.5 text-legenda text-marca-texto"
              >
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ListaNoticias() {
  const noticias = useNoticias();
  const atualizar = useAtualizar(noticias);
  if (noticias.isError && !noticias.data) {
    return <Falha erro={noticias.error} tentarDeNovo={() => noticias.refetch()} />;
  }
  if (!noticias.data) return <Carregando />;
  return (
    <FlatList
      data={noticias.data}
      keyExtractor={(n) => n.id_noticia}
      renderItem={({ item }) => <CartaoNoticia noticia={item} />}
      contentContainerClassName="flex-grow gap-4 p-4"
      refreshControl={<RefreshControl {...atualizar} />}
      ListEmptyComponent={<Vazio mensagem="Nenhuma notícia disponível no momento." />}
    />
  );
}

function ItemNotificacao({ notificacao }: { notificacao: Notificacao }) {
  return (
    <View
      className={`flex-row gap-3 rounded-md p-4 ${notificacao.lida ? 'bg-superficie' : 'bg-superficie-alta'}`}
    >
      {notificacao.lida ? (
        <View className="mt-[6px] h-2 w-2" />
      ) : (
        <View accessible accessibilityLabel="Não lida" className="mt-[6px] h-2 w-2 rounded-full bg-marca" />
      )}
      <View className="flex-1 gap-1">
        <Text className="text-legenda text-texto-suave">
          {notificacao.midia_nome} · {formatarData(notificacao.data_criacao)}
        </Text>
        <Text className="text-corpo font-semibold text-texto-forte">{notificacao.titulo}</Text>
        <Text className="text-corpo text-texto">{notificacao.mensagem}</Text>
      </View>
    </View>
  );
}

function ListaNotificacoes() {
  const notificacoes = useNotificacoes();
  const marcar = useMarcarTodasLidas();
  const atualizar = useAtualizar(notificacoes);
  if (notificacoes.isError && !notificacoes.data) {
    return <Falha erro={notificacoes.error} tentarDeNovo={() => notificacoes.refetch()} />;
  }
  if (!notificacoes.data) return <Carregando />;
  const temNaoLidas = notificacoes.data.some((n) => !n.lida);
  return (
    <FlatList
      data={notificacoes.data}
      testID="lista-notificacoes"
      keyExtractor={(n, i) => `${n.id_midia}-${n.data_criacao}-${i}`}
      renderItem={({ item }) => <ItemNotificacao notificacao={item} />}
      contentContainerClassName="flex-grow gap-3 p-4"
      refreshControl={<RefreshControl {...atualizar} />}
      ListHeaderComponent={
        temNaoLidas ? (
          <View className="gap-2">
            <Botao
              titulo="Marcar todas como lidas"
              variante="secundario"
              carregando={marcar.isPending}
              onPress={() => marcar.mutate()}
            />
            {marcar.isError ? (
              <Text accessibilityRole="alert" className="text-center text-corpo text-texto-suave">
                Não deu para marcar como lidas. Tente de novo.
              </Text>
            ) : null}
          </View>
        ) : undefined
      }
      ListEmptyComponent={<Vazio mensagem="Nenhuma notificação por aqui." />}
    />
  );
}

export default function Noticias() {
  const [atual, setAtual] = useState<SubAba>('noticias');
  return (
    <View className="flex-1 bg-fundo">
      <View accessibilityRole="tablist" className="flex-row border-b border-borda">
        {subAbas.map((aba) => {
          const selecionada = aba.chave === atual;
          return (
            <Pressable
              key={aba.chave}
              accessibilityRole="tab"
              accessibilityLabel={aba.titulo}
              accessibilityState={{ selected: selecionada }}
              onPress={() => setAtual(aba.chave)}
              className={`flex-1 items-center border-b-2 py-3 ${
                selecionada ? 'border-marca-texto' : 'border-transparent'
              }`}
            >
              <Text className={`text-corpo ${selecionada ? 'font-semibold text-texto-forte' : 'text-texto-suave'}`}>
                {aba.titulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {atual === 'noticias' ? <ListaNoticias /> : <ListaNotificacoes />}
    </View>
  );
}
