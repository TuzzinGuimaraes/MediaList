import { Text } from 'react-native';

type Props = {
  tamanho?: number;
  /** Nome para o leitor de tela; null deixa o monograma só decorativo. */
  rotulo?: string | null;
};

/** Monograma "M" em carmesim: no topo do Início, nos estados vazios e no carregamento. */
export function Monograma({ tamanho = 28, rotulo = 'MediaList' }: Props) {
  const decorativo = rotulo === null;
  return (
    <Text
      accessibilityLabel={rotulo ?? undefined}
      accessibilityElementsHidden={decorativo}
      importantForAccessibility={decorativo ? 'no-hide-descendants' : 'auto'}
      maxFontSizeMultiplier={1}
      className="font-bold text-marca"
      style={{ fontSize: tamanho, lineHeight: tamanho * 1.15, letterSpacing: -tamanho * 0.04 }}
    >
      M
    </Text>
  );
}
