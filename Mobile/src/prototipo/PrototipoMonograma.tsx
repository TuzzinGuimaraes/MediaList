// PROTÓTIPO (ticket 29), descartável. Monograma "M" fixo (sem variante): Outfit no peso
// mais forte, em carmesim. Vai no topo do Início, nos estados vazios e no carregamento.
import { Text } from 'react-native';

/** `rotulo` null: decorativo, escondido do leitor de tela. */
export function Monograma({ tamanho = 28, rotulo = 'MediaList' }: { tamanho?: number; rotulo?: string | null }) {
  return (
    <Text
      accessibilityLabel={rotulo ?? undefined}
      accessibilityElementsHidden={rotulo === null}
      importantForAccessibility={rotulo === null ? 'no-hide-descendants' : 'auto'}
      maxFontSizeMultiplier={1}
      className="font-bold text-marca"
      style={{ fontSize: tamanho, lineHeight: tamanho * 1.15, letterSpacing: -tamanho * 0.04 }}
    >
      M
    </Text>
  );
}
