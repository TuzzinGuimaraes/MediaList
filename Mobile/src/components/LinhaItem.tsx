import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

import type { ItemLista } from '../api/tipos';
import { estadoDe, nomeDoRotulo } from '../dominio/estadoConsumo';
import { passoDeProgresso, temProgresso, totalDoItem } from '../dominio/itemLista';
import { tituloDaMidia } from '../dominio/midia';
import { FioProgresso } from '../prototipo/PrototipoAssinatura';
import { usePaleta } from '../prototipo/PrototipoContext';
import { SeloStatus } from '../prototipo/PrototipoSelos';
import { nomeDoTipo, SeloTipo } from './SeloTipo';

type Props = {
  item: ItemLista;
  editar(): void;
  mudarProgresso(progresso: number): void;
  /** Largura fixa: card C de carrossel (PROTÓTIPO, ticket 34). */
  largura?: number;
};

type PropsPasso = { novo: number | null; icone: 'remove' | 'add'; rotulo: string; mudar(n: number): void };

function BotaoPasso({ novo, icone, rotulo, mudar }: PropsPasso) {
  const paleta = usePaleta();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: novo === null }}
      disabled={novo === null}
      onPress={() => novo !== null && mudar(novo)}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      className="h-8 w-9 items-center justify-center active:opacity-60"
    >
      <Ionicons name={icone} size={18} color={novo === null ? paleta.dark.border : paleta.text.bright} />
    </Pressable>
  );
}

/** Pílula `− 12/24 +` com a altura de uma linha de texto; o hitSlop leva cada alvo a 44pt.
 * O número cresce com a fonte do sistema até 1,3x, para a pílula caber ao lado do título. */
function Stepper({ item, titulo, mudar }: { item: ItemLista; titulo: string; mudar(n: number): void }) {
  const total = totalDoItem(item);
  const atual = item.progresso_atual ?? 0;

  return (
    <View className="flex-row items-center rounded-full border border-dark-border bg-dark-tertiary">
      <BotaoPasso novo={passoDeProgresso(item, -1)} icone="remove" rotulo={`Menos um em ${titulo}`} mudar={mudar} />
      <Text
        accessibilityLabel={total !== null ? `Progresso: ${atual} de ${total}` : `Progresso: ${atual}`}
        maxFontSizeMultiplier={1.3}
        className="min-w-[48px] text-center text-legenda font-semibold text-text-bright"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {total !== null ? `${atual}/${total}` : atual}
      </Text>
      <BotaoPasso novo={passoDeProgresso(item, 1)} icone="add" rotulo={`Mais um em ${titulo}`} mudar={mudar} />
    </View>
  );
}

/**
 * Linha do Item na aba Lista. Tocar abre o editor; o stepper muda o Progresso direto.
 * PROTÓTIPO (ticket 34): linha maior no estilo do card C (banner esmaecido ao fundo, pôster
 * pequeno, Tipo, título, Status, nota, stepper) com o fio de progresso na base. Com `largura`,
 * vira o card C dos carrosséis por Tipo (mesmo conteúdo, largura fixa).
 */
export function LinhaItem({ item, editar, mudarProgresso, largura }: Props) {
  const paleta = usePaleta();
  const titulo = tituloDaMidia(item);
  const nota = item.nota_usuario != null ? String(item.nota_usuario) : null;
  const estado = estadoDe(item.status_consumo, item.tipo);
  const banner = item.banner_url ?? item.poster_url;
  return (
    <View
      accessibilityLabel={`Item ${titulo}`}
      className={`h-[124px] flex-row overflow-hidden rounded-lg bg-superficie ${largura ? '' : 'mx-4'}`}
      style={largura ? { width: largura } : undefined}
    >
      {banner ? (
        <Image
          source={banner}
          style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.32 }}
          contentFit="cover"
          blurRadius={item.banner_url ? 0 : 12}
          cachePolicy="disk"
          recyclingKey={`${item.id_midia}-banner`}
        />
      ) : null}
      <LinearGradient
        colors={[`${paleta.superficie}F7`, `${paleta.superficie}B3`, `${paleta.superficie}66`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Editar ${titulo}, ${nomeDoTipo(item.tipo)}`}
        onPress={editar}
        className="flex-1 flex-row gap-3 p-2.5 active:opacity-80"
      >
        <View className="h-full w-[68px] overflow-hidden rounded-md bg-superficie-alta">
          {item.poster_url ? (
            <Image
              source={item.poster_url}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="disk"
              recyclingKey={item.id_midia}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <View className="flex-1 gap-1">
          <SeloTipo tipo={item.tipo} />
          <Text numberOfLines={2} className="text-corpo font-bold text-texto-forte">
            {titulo}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            {estado ? (
              <SeloStatus estado={estado} />
            ) : (
              <Text className="text-legenda text-text-secondary">{nomeDoRotulo(item.status_consumo, item.tipo)}</Text>
            )}
            {nota ? (
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="star" size={14} color={paleta.accent.yellow} />
                <Text className="text-legenda font-bold text-accent-yellow">{nota}</Text>
              </View>
            ) : null}
            {item.favorito ? <Ionicons name="heart" size={14} color={paleta.accent.red} /> : null}
            {item.privado ? <Ionicons name="lock-closed" size={14} color={paleta.text.secondary} /> : null}
          </View>
        </View>
      </Pressable>
      <View className="justify-end pb-3 pr-2.5">
        {temProgresso(item.tipo) ? (
          <Stepper item={item} titulo={titulo} mudar={mudarProgresso} />
        ) : (
          // Horas jogadas não medem Progresso (CONTEXT.md): só exibidas, editadas no editor.
          <Text accessibilityLabel={`Horas jogadas: ${item.progresso_atual ?? 0}`} className="text-legenda text-text-secondary">
            {`${item.progresso_atual ?? 0} h`}
          </Text>
        )}
      </View>
      <FioProgresso idMidia={item.id_midia} />
    </View>
  );
}
