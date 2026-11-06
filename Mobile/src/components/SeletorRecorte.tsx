import { Pressable, Text, View } from 'react-native';

import { usePrototipoCabecalhoRecorte } from './PrototipoSeletorRecorte';
import { useVariantePrototipo } from '../recorte/PrototipoVarianteRecorte';
import { type Recorte, useRecorte } from '../recorte/RecorteContext';

const OPCOES: { recorte: Recorte; titulo: string }[] = [
  { recorte: 'animanga', titulo: 'Animes e mangás' },
  { recorte: 'jogos', titulo: 'Jogos' },
];

/**
 * Alterna o Recorte de catálogo; a escolha vale para Início e Explorar.
 * PROTÓTIPO (ticket 11): fora da variante "original" o seletor vai para o
 * cabeçalho da aba e aqui não renderiza nada (nem o `className` de moldura).
 */
export function SeletorRecorte({ className }: { className?: string }) {
  const variante = useVariantePrototipo();
  usePrototipoCabecalhoRecorte(variante);
  const { recorte, escolher } = useRecorte();
  if (variante !== 'original') return null;
  return (
    <View className={className}>
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
    </View>
  );
}
