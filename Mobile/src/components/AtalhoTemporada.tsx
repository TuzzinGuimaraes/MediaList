import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { rotuloDaTemporada, temporadaDe } from '@dominio/temporada';
import { TIPOS_DO_RECORTE, useRecorte } from '../recorte/RecorteContext';
import { useCores } from '../tema/TemaContext';
import { Toque } from './Toque';

const TITULO = 'Temporada de anime';

/** Atalho para a tela da Temporada (Explorar e Início), só nos Recortes com anime; `className` vai na caixa externa. */
export function AtalhoTemporada({ className }: { className?: string }) {
  const { recorte } = useRecorte();
  const router = useRouter();
  const cores = useCores();
  const [atual] = useState(() => rotuloDaTemporada(temporadaDe(new Date())));
  if (!TIPOS_DO_RECORTE[recorte].includes('anime')) return null;
  return (
    <View className={className}>
      <Toque
        accessibilityRole="link"
        accessibilityLabel={`${TITULO}: ${atual}`}
        onPress={() => router.push('/temporada')}
        className="min-h-[44px] flex-row items-center gap-2 rounded-md border border-borda bg-superficie px-3 py-2"
      >
        <Ionicons name="calendar-outline" size={18} color={cores['marca-texto']} />
        <View className="flex-1">
          <Text className="text-corpo font-semibold text-texto-forte">{TITULO}</Text>
          <Text className="text-legenda text-texto-suave">{atual}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={cores['texto-suave']} />
      </Toque>
    </View>
  );
}
