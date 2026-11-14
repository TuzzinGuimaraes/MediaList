// O topo do detalhe da Mídia: banner, pôster sobreposto e o voltar.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePosicaoTop10 } from '../api/midias';
import type { ItemLista, Midia } from '../api/tipos';
import { estadoDe } from '../dominio/estadoConsumo';
import { emLancamento } from '../dominio/situacao';
import { useCores } from '../tema/TemaContext';
import { FioProgresso } from './FioProgresso';
import { Selo, SeloStatus, SeloTipo, SeloTop } from './Selo';

const TEXTO_VOLTAR = 'Voltar';

/** Altura do banner; o pôster sobe sobre a base dele. */
const ALTURA_BANNER = 260;

/**
 * Banner do topo: o banner da Mídia (ou o pôster desfocado, sem banner), escurecido no alto
 * para o botão voltar e fundido no fundo da tela na base. A imagem é decorativa; o selo do
 * Tipo fica sobre ela, no canto.
 */
export function Banner({ midia }: { midia: Midia }) {
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
export function PosterDoDetalhe({ midia, item }: { midia: Midia; item: ItemLista | null | undefined }) {
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
export function Voltar({ aoVoltar, flutuante }: { aoVoltar(): void; flutuante?: boolean }) {
  const cores = useCores();
  const insets = useSafeAreaInsets();
  if (flutuante) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={TEXTO_VOLTAR}
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
        accessibilityLabel={TEXTO_VOLTAR}
        onPress={aoVoltar}
        hitSlop={8}
        className="flex-row items-center gap-1 p-2"
      >
        <Ionicons name="chevron-back" size={20} color={cores['texto-forte']} />
        <Text className="text-corpo text-texto-forte">{TEXTO_VOLTAR}</Text>
      </Pressable>
    </View>
  );
}
