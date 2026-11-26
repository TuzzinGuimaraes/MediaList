import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { mensagemDeErro } from '../api/erros';
import { useAdicionarComoPlanejado } from '../api/lista';
import type { Midia } from '../api/tipos';
import { formatarData } from '@dominio/datas';
import { nomeDoTipo } from '@dominio/estadoConsumo';
import { tituloDaMidia } from '@dominio/midia';
import { seloDeEstimativa } from '@dominio/temporada';
import { rotaDaMidia } from '../rotas';
import { useCores } from '../tema/TemaContext';
import { Selo } from './Selo';
import { Toque } from './Toque';

const textos = {
  planejado: 'Planejado',
  naLista: 'Na Lista',
  estreia: (data: string) => `Estreia ${data}`,
  episodios: (n: number) => `${n} ${n === 1 ? 'episódio' : 'episódios'}`,
};

type Props = {
  anime: Midia;
  /** Se o anime já está na Lista pessoal; undefined enquanto a Lista não chegou. */
  naLista: boolean | undefined;
};

/**
 * Cartão de um anime na Temporada: capa, título, estreia, estúdio e episódios; o selo de
 * Temporada estimada (tocar explica) e "Planejado" (põe na Lista num toque) ou "Na Lista".
 */
export function CartaoTemporada({ anime, naLista }: Props) {
  const router = useRouter();
  const cores = useCores();
  const titulo = tituloDaMidia(anime);
  const estreia = formatarData(anime.data_lancamento);
  const selo = seloDeEstimativa(anime);
  const [explicando, setExplicando] = useState(false);
  const adicionar = useAdicionarComoPlanejado();

  return (
    <View accessibilityLabel={`Cartão de ${titulo}`} className="flex-row gap-3 rounded-lg bg-superficie p-2.5">
      <Toque
        accessibilityRole="link"
        accessibilityLabel={`${titulo}, ${nomeDoTipo(anime.tipo)}`}
        onPress={() => router.push(rotaDaMidia(anime.id_midia))}
        caixa={{ flex: 1 }}
        className="flex-row gap-3"
      >
        <View className="aspect-[2/3] w-[72px] overflow-hidden rounded-md bg-superficie-alta">
          {anime.poster_url ? (
            <Image
              source={anime.poster_url}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="disk"
              recyclingKey={anime.id_midia}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={2} className="text-corpo font-bold text-texto-forte">
            {titulo}
          </Text>
          {estreia ? <Text className="text-legenda text-texto">{textos.estreia(estreia)}</Text> : null}
          {anime.estudio ? (
            <Text numberOfLines={1} className="text-legenda text-texto-suave">
              {anime.estudio}
            </Text>
          ) : null}
          {anime.numero_episodios ? (
            <Text className="text-legenda text-texto-suave">{textos.episodios(anime.numero_episodios)}</Text>
          ) : null}
        </View>
      </Toque>
      <View className="items-end justify-between gap-2">
        {selo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selo.texto}
            accessibilityState={{ expanded: explicando }}
            onPress={() => setExplicando((e) => !e)}
            hitSlop={8}
            className="max-w-[120px] items-end gap-1"
          >
            <Selo texto={selo.texto} />
            {explicando ? <Text className="text-right text-legenda text-texto-suave">{selo.explicacao}</Text> : null}
          </Pressable>
        ) : (
          <View />
        )}
        {naLista ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="checkmark" size={16} color={cores['texto-suave']} />
            <Text className="text-legenda font-semibold text-texto-suave">{textos.naLista}</Text>
          </View>
        ) : naLista === false ? (
          <View className="items-end gap-1">
            <Toque
              accessibilityRole="button"
              accessibilityLabel={`${textos.planejado}, ${titulo}`}
              accessibilityState={{ busy: adicionar.isPending, disabled: adicionar.isPending }}
              disabled={adicionar.isPending}
              onPress={() => adicionar.mutate({ idMidia: anime.id_midia, tipo: anime.tipo })}
              className="min-h-[36px] flex-row items-center gap-1 rounded-md border border-borda bg-superficie-alta px-2.5"
            >
              {adicionar.isPending ? (
                <ActivityIndicator size="small" color={cores.texto} />
              ) : (
                <Ionicons name="add" size={16} color={cores.texto} />
              )}
              <Text className="text-legenda font-semibold text-texto">{textos.planejado}</Text>
            </Toque>
            {adicionar.isError ? (
              <Text accessibilityRole="alert" className="max-w-[120px] text-right text-legenda text-erro">
                {mensagemDeErro(adicionar.error)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
