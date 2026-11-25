// Cartão de uma Notícia: imagem, título, autor e data, texto e tags. A aba Notícias e a tela
// de uma Notícia (o destino da Notificação) usam o mesmo.
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { Noticia } from '@/api/tipos';
import { formatarData } from '@dominio/datas';

export function CartaoNoticia({ noticia }: { noticia: Noticia }) {
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
