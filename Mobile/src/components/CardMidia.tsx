import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useItemEmCache } from '../api/lista';
import { usePosicaoTop10 } from '../api/midias';
import type { CartaoMidia, Midia } from '../api/tipos';
import { estadoDe, nomeDoTipo } from '../dominio/estadoConsumo';
import { notasDaMidia, ROTULO_NOTA_MEDIA, tituloDaMidia } from '../dominio/midia';
import { type ComSituacao, emLancamento } from '../dominio/situacao';
import { useCores } from '../tema/TemaContext';
import { FioProgresso } from './FioProgresso';
import { Selo, SeloStatus, SeloTipo, SeloTop } from './Selo';
import { Toque } from './Toque';

/** A listagem pode trazer os campos completos (Em alta e a Lista trazem; Populares não). */
type MidiaDoCard = CartaoMidia & Partial<Pick<Midia, 'banner_url'>> & ComSituacao;

type Props = {
  midia: MidiaDoCard;
  /** Largura fixa (carrossel) ou ocupando a coluna (grade). */
  largura?: number;
};

function Poster({ midia }: { midia: CartaoMidia }) {
  return midia.poster_url ? (
    <Image
      source={midia.poster_url}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      cachePolicy="disk"
      transition={150}
      recyclingKey={midia.id_midia}
      accessibilityIgnoresInvertColors
    />
  ) : null;
}

/** Notas da obra, cada uma com estrela e rótulo curto. */
function Notas({ midia, limite }: { midia: CartaoMidia; limite?: number }) {
  const cores = useCores();
  return notasDaMidia(midia)
    .slice(0, limite)
    .map((n) => (
      <View key={n.rotulo} className="flex-row items-center gap-1">
        <Ionicons name={n.rotulo === ROTULO_NOTA_MEDIA ? 'star' : 'star-outline'} size={12} color={cores.nota} />
        <Text className="text-legenda font-bold text-nota">{n.valor}</Text>
        <Text numberOfLines={1} className="text-legenda text-texto-suave">
          {n.curto}
        </Text>
      </View>
    ));
}

/** Toque que abre o detalhe, com o título e as notas para o leitor de tela. */
function useAbrir(midia: CartaoMidia) {
  const router = useRouter();
  const titulo = tituloDaMidia(midia);
  const notas = notasDaMidia(midia);
  return {
    titulo,
    a11y: {
      accessibilityRole: 'link' as const,
      accessibilityLabel: `${titulo}, ${nomeDoTipo(midia.tipo)}`,
      // As notas vão no valor, para o leitor de tela anunciá-las depois do título.
      accessibilityValue: notas.length ? { text: notas.map((n) => `${n.rotulo} ${n.valor}`).join(', ') } : undefined,
    },
    abrir: () => router.push({ pathname: '/midia/[id]', params: { id: midia.id_midia } }),
  };
}

/**
 * Card A (denso): pôster vertical com os selos sobre a imagem (Top 10, lançamento, Status do
 * Item) e o fio de progresso; título, Tipo e notas abaixo. Tocar abre o detalhe.
 */
export function CardMidia({ midia, largura }: Props) {
  const { titulo, a11y, abrir } = useAbrir(midia);
  const item = useItemEmCache(midia.id_midia);
  const top = usePosicaoTop10(midia.id_midia);
  const estado = item ? estadoDe(item.status_consumo, item.tipo) : null;
  const lancamento = emLancamento(midia);
  return (
    <Toque {...a11y} onPress={abrir} className="gap-1.5" caixa={largura ? { width: largura } : { flex: 1 }}>
      <View className="aspect-[2/3] w-full overflow-hidden rounded-md bg-superficie-alta">
        <Poster midia={midia} />
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
      <Text numberOfLines={2} className="text-legenda text-texto">
        {titulo}
      </Text>
      <SeloTipo tipo={midia.tipo} />
      <Notas midia={midia} />
    </Toque>
  );
}

/**
 * Card C (informativo): horizontal, com o banner (ou o pôster desfocado) esmaecido ao fundo,
 * o pôster pequeno, Tipo, título, notas e o Status do Item, e o fio de progresso na base.
 * Vai no Continuar e nos destaques.
 */
export function CardInfo({ midia, largura }: Props) {
  const { titulo, a11y, abrir } = useAbrir(midia);
  const item = useItemEmCache(midia.id_midia);
  const top = usePosicaoTop10(midia.id_midia);
  const estado = item ? estadoDe(item.status_consumo, item.tipo) : null;
  const fundo = midia.banner_url ?? midia.poster_url;
  return (
    <Toque {...a11y} onPress={abrir} caixa={largura ? { width: largura } : { flex: 1 }}>
      <View className="h-[150px] flex-row overflow-hidden rounded-lg bg-superficie">
        {fundo ? (
          <Image
            source={fundo}
            style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.4 }}
            contentFit="cover"
            blurRadius={midia.banner_url ? 0 : 12}
            cachePolicy="disk"
            recyclingKey={`${midia.id_midia}-fundo`}
          />
        ) : null}
        <View className="absolute inset-0 bg-superficie/70" />
        <View className="m-2.5 w-[86px] overflow-hidden rounded-md bg-superficie-alta">
          <Poster midia={midia} />
          {top ? (
            <View className="absolute right-0 top-0">
              <SeloTop posicao={top} />
            </View>
          ) : null}
        </View>
        <View className="flex-1 justify-center gap-1 py-2 pr-3">
          <SeloTipo tipo={midia.tipo} />
          <Text numberOfLines={2} className="text-corpo font-bold text-texto-forte">
            {titulo}
          </Text>
          <Notas midia={midia} />
          {estado ? <SeloStatus estado={estado} /> : null}
        </View>
        {item ? <FioProgresso item={item} /> : null}
      </View>
    </Toque>
  );
}
