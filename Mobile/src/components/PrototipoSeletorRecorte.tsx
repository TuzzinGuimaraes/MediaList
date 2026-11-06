// PROTÓTIPO (ticket 11), descartável. Variantes A, B e C do seletor de Recorte,
// todas no cabeçalho da aba. Lê e escreve o mesmo RecorteContext do app real.
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Recorte, useRecorte } from '../recorte/RecorteContext';
import { NOME_CURTO_RECORTE, type VariantePrototipo } from '../recorte/PrototipoVarianteRecorte';
import paleta from '../tema/paleta';

const RECORTES: Recorte[] = ['animanga', 'jogos'];
const outro = (r: Recorte): Recorte => (r === 'animanga' ? 'jogos' : 'animanga');

/** A: pílula pequena à direita do título; um toque alterna. */
function PrototipoPilula() {
  const { recorte, escolher } = useRecorte();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Recorte ${NOME_CURTO_RECORTE[recorte]}. Tocar para ${NOME_CURTO_RECORTE[outro(recorte)]}`}
      onPress={() => escolher(outro(recorte))}
      style={{ minHeight: 44, justifyContent: 'center', marginRight: 12 }}
    >
      <View className="flex-row items-center gap-1.5 rounded-full border border-dark-border bg-dark-tertiary px-3 py-1.5">
        <Text className="text-xs font-semibold text-accent-blue">{NOME_CURTO_RECORTE[recorte]}</Text>
        <Ionicons name="swap-horizontal" size={14} color={paleta.text.secondary} />
      </View>
    </Pressable>
  );
}

/** B: o título da tela é o Recorte; abre um menu com as duas opções. */
function PrototipoTituloMenu() {
  const { recorte, escolher } = useRecorte();
  const [aberto, setAberto] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Recorte ${NOME_CURTO_RECORTE[recorte]}, abrir menu`}
        onPress={() => setAberto(true)}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <Text className="text-xl font-bold text-text-bright">{NOME_CURTO_RECORTE[recorte]}</Text>
        <Ionicons name="chevron-down" size={20} color={paleta.text.secondary} />
      </Pressable>
      <Modal transparent statusBarTranslucent visible={aberto} animationType="fade" onRequestClose={() => setAberto(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setAberto(false)}>
          <View
            className="rounded-md border border-dark-border bg-dark-secondary py-1"
            style={{ position: 'absolute', top: insets.top + 52, left: 12, minWidth: 220, elevation: 8 }}
          >
            {RECORTES.map((r) => {
              const ativo = r === recorte;
              return (
                <Pressable
                  key={r}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: ativo }}
                  onPress={() => {
                    escolher(r);
                    setAberto(false);
                  }}
                  style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}
                >
                  <Text className={`text-base ${ativo ? 'font-semibold text-accent-blue' : 'text-text-primary'}`}>
                    {NOME_CURTO_RECORTE[r]}
                  </Text>
                  {ativo ? <Ionicons name="checkmark" size={18} color={paleta.accent.blue} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const ICONES: Record<Recorte, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  animanga: 'television-play',
  jogos: 'gamepad-variant',
};

/** C: dois ícones lado a lado na linha do título; o ativo fica destacado. */
function PrototipoIcones() {
  const { recorte, escolher } = useRecorte();
  return (
    <View style={{ flexDirection: 'row', marginRight: 8 }}>
      {RECORTES.map((r) => {
        const ativo = r === recorte;
        return (
          <Pressable
            key={r}
            accessibilityRole="button"
            accessibilityLabel={NOME_CURTO_RECORTE[r]}
            accessibilityState={{ selected: ativo }}
            onPress={() => escolher(r)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: ativo ? paleta.dark.tertiary : 'transparent',
                borderWidth: 1,
                borderColor: ativo ? paleta.accent.blue : 'transparent',
              }}
            >
              <MaterialCommunityIcons name={ICONES[r]} size={22} color={ativo ? paleta.accent.blue : paleta.text.secondary} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * PROTÓTIPO: põe a variante no cabeçalho nativo da aba. Sempre escreve
 * headerTitle e headerRight para que voltar a "original" limpe o cabeçalho.
 */
export function usePrototipoCabecalhoRecorte(variante: VariantePrototipo) {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: variante === 'b' ? () => <PrototipoTituloMenu /> : undefined,
      headerRight: variante === 'a' ? () => <PrototipoPilula /> : variante === 'c' ? () => <PrototipoIcones /> : undefined,
    });
  }, [navigation, variante]);
}
