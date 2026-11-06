import { Pressable, Text, View } from 'react-native';

import { type Recorte, useRecorte } from '../recorte/RecorteContext';

const OPCOES: { recorte: Recorte; titulo: string }[] = [
  { recorte: 'animanga', titulo: 'Animes e mangás' },
  { recorte: 'jogos', titulo: 'Jogos' },
];

/** Alterna o Recorte de catálogo; a escolha vale para Início e Explorar. */
export function SeletorRecorte() {
  const { recorte, escolher } = useRecorte();
  return (
    <View className="flex-row rounded-md border border-dark-border bg-dark-secondary p-1">
      {OPCOES.map((opcao) => {
        const ativo = opcao.recorte === recorte;
        return (
          <Pressable
            key={opcao.recorte}
            accessibilityRole="button"
            accessibilityLabel={opcao.titulo}
            accessibilityState={{ selected: ativo }}
            onPress={() => escolher(opcao.recorte)}
            className={`flex-1 items-center rounded py-2 ${ativo ? 'bg-dark-tertiary' : ''}`}
          >
            <Text className={`text-sm font-semibold ${ativo ? 'text-accent-blue' : 'text-text-secondary'}`}>
              {opcao.titulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
