// PROTÓTIPO (ticket 11), descartável. Não promover para a integração.
// Quatro formas do seletor de Recorte nas telas Início, Explorar e Lista,
// alternáveis pela barra flutuante (só em __DEV__). A variante vive em memória
// e é a mesma nas três telas.
import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRecorte } from './RecorteContext';

export type VariantePrototipo = 'original' | 'a' | 'b' | 'c';

export const VARIANTES_PROTOTIPO: { chave: VariantePrototipo; nome: string }[] = [
  { chave: 'original', nome: 'original (segmentado)' },
  { chave: 'a', nome: 'A · pílula no cabeçalho' },
  { chave: 'b', nome: 'B · menu no título' },
  { chave: 'c', nome: 'C · ícones no cabeçalho' },
];

export const NOME_CURTO_RECORTE = { animanga: 'Anime & Mangá', jogos: 'Jogos' } as const;

type Valor = { variante: VariantePrototipo; escolher(v: VariantePrototipo): void };

const PrototipoContext = createContext<Valor>({ variante: 'original', escolher: () => {} });

export function PrototipoVarianteProvider({ children }: { children: React.ReactNode }) {
  const [variante, escolher] = useState<VariantePrototipo>('a');
  const valor = useMemo(() => ({ variante, escolher }), [variante]);
  if (!__DEV__) return <>{children}</>;
  return <PrototipoContext.Provider value={valor}>{children}</PrototipoContext.Provider>;
}

export function useVariantePrototipo(): VariantePrototipo {
  const { variante } = useContext(PrototipoContext);
  return __DEV__ ? variante : 'original';
}

/** PROTÓTIPO: barra flutuante acima da barra de abas. ‹ e › trocam a variante. */
export function PrototipoBarraVariantes() {
  const { variante, escolher } = useContext(PrototipoContext);
  const { recorte } = useRecorte();
  const insets = useSafeAreaInsets();
  if (!__DEV__) return null;

  const i = VARIANTES_PROTOTIPO.findIndex((v) => v.chave === variante);
  const n = VARIANTES_PROTOTIPO.length;
  const ir = (passo: number) => escolher(VARIANTES_PROTOTIPO[(i + passo + n) % n].chave);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 64, alignItems: 'center' }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f7c948',
          borderRadius: 999,
          paddingHorizontal: 4,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 6,
        }}
      >
        <Pressable accessibilityLabel="Variante anterior" onPress={() => ir(-1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={22} color="#000" />
        </Pressable>
        <View style={{ alignItems: 'center', minWidth: 170 }}>
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>{VARIANTES_PROTOTIPO[i].nome}</Text>
          <Text style={{ color: '#000', fontSize: 11 }}>Recorte: {NOME_CURTO_RECORTE[recorte]}</Text>
        </View>
        <Pressable accessibilityLabel="Próxima variante" onPress={() => ir(1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={22} color="#000" />
        </Pressable>
      </View>
    </View>
  );
}
