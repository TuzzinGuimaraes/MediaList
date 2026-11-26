import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Midia } from '../api/tipos';
import { formatarData } from '@dominio/datas';
import { nomeDoTipo } from '@dominio/estadoConsumo';
import { contagemDeEpisodios, tituloDaMidia } from '@dominio/midia';
import { seloDeEstimativa } from '@dominio/temporada';
import { rotaDaMidia } from '../rotas';
import { PlanejadoOuNaLista } from './PlanejadoOuNaLista';
import { Selo } from './Selo';
import { Toque } from './Toque';

const textos = {
  estreia: (data: string) => `Estreia ${data}`,
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
  const titulo = tituloDaMidia(anime);
  const estreia = formatarData(anime.data_lancamento);
  const selo = seloDeEstimativa(anime);
  const [explicando, setExplicando] = useState(false);

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
            <Text className="text-legenda text-texto-suave">{contagemDeEpisodios(anime.numero_episodios)}</Text>
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
        <PlanejadoOuNaLista idMidia={anime.id_midia} tipo={anime.tipo} titulo={titulo} naLista={naLista} />
      </View>
    </View>
  );
}
