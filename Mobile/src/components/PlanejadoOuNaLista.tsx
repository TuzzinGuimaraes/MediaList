import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Text, View } from 'react-native';

import { mensagemDeErro } from '../api/erros';
import { useAdicionarComoPlanejado } from '../api/lista';
import type { TipoMidia } from '@dominio/estadoConsumo';
import { useCores } from '../tema/TemaContext';
import { Toque } from './Toque';

const textos = {
  planejado: 'Planejado',
  naLista: 'Na Lista',
};

type Props = {
  idMidia: string;
  tipo: TipoMidia;
  titulo: string;
  /** Se a Mídia já está na Lista pessoal; undefined enquanto a Lista não chegou (não mostra nada). */
  naLista: boolean | undefined;
};

/** "Na Lista" para quem já tem o Item; senão, o botão "Planejado", que põe na Lista num toque. */
export function PlanejadoOuNaLista({ idMidia, tipo, titulo, naLista }: Props) {
  const cores = useCores();
  const adicionar = useAdicionarComoPlanejado();
  if (naLista) {
    return (
      <View className="flex-row items-center gap-1">
        <Ionicons name="checkmark" size={16} color={cores['texto-suave']} />
        <Text className="text-legenda font-semibold text-texto-suave">{textos.naLista}</Text>
      </View>
    );
  }
  if (naLista === undefined) return null;
  return (
    <View className="items-end gap-1">
      <Toque
        accessibilityRole="button"
        accessibilityLabel={`${textos.planejado}, ${titulo}`}
        accessibilityState={{ busy: adicionar.isPending, disabled: adicionar.isPending }}
        disabled={adicionar.isPending}
        onPress={() => adicionar.mutate({ idMidia, tipo })}
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
  );
}
