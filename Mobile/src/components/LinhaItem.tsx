import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import type { ItemLista } from '../api/tipos';
import { nomeDoRotulo } from '../dominio/estadoConsumo';
import { passoDeProgresso, temProgresso, totalDoItem } from '../dominio/itemLista';
import { tituloDaMidia } from '../dominio/midia';
import paleta from '../tema/paleta';
import { nomeDoTipo, SeloTipo } from './SeloTipo';

type Props = {
  item: ItemLista;
  editar(): void;
  mudarProgresso(progresso: number): void;
};

type PropsPasso = { novo: number | null; icone: 'remove' | 'add'; rotulo: string; mudar(n: number): void };

function BotaoPasso({ novo, icone, rotulo, mudar }: PropsPasso) {
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

/** Linha do Item na aba Lista. Tocar abre o editor; o stepper muda o Progresso direto. */
export function LinhaItem({ item, editar, mudarProgresso }: Props) {
  const titulo = tituloDaMidia(item);
  const nota = item.nota_usuario != null && item.nota_usuario !== '' ? String(Number(item.nota_usuario)) : null;
  return (
    <View accessibilityLabel={`Item ${titulo}`} className="flex-row items-center gap-3 px-4 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Editar ${titulo}, ${nomeDoTipo(item.tipo)}`}
        onPress={editar}
        className="flex-1 flex-row items-center gap-3 active:opacity-80"
      >
        <View className="h-[60px] w-10 overflow-hidden rounded bg-dark-tertiary">
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
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={2} className="text-corpo text-text-bright">
            {titulo}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <SeloTipo tipo={item.tipo} />
            <Text className="text-legenda text-text-secondary">{nomeDoRotulo(item.status_consumo, item.tipo)}</Text>
            {nota ? (
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="star" size={14} color={paleta.accent.yellow} />
                <Text className="text-legenda text-accent-yellow">{nota}</Text>
              </View>
            ) : null}
            {item.favorito ? <Ionicons name="heart" size={14} color={paleta.accent.red} /> : null}
            {item.privado ? <Ionicons name="lock-closed" size={14} color={paleta.text.secondary} /> : null}
          </View>
        </View>
      </Pressable>
      {temProgresso(item.tipo) ? (
        <Stepper item={item} titulo={titulo} mudar={mudarProgresso} />
      ) : (
        // Horas jogadas não medem Progresso (CONTEXT.md): só exibidas, editadas no editor.
        <Text accessibilityLabel={`Horas jogadas: ${item.progresso_atual ?? 0}`} className="text-legenda text-text-secondary">
          {`${item.progresso_atual ?? 0} h`}
        </Text>
      )}
    </View>
  );
}
