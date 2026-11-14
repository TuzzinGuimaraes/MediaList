import { View } from 'react-native';

import type { ItemLista } from '../api/tipos';
import { proporcaoDoFio } from '../dominio/itemLista';

/** Largura do traço quando não se conhece o total. */
const TRACO_CURTO = 14;

/**
 * Fio de progresso carmesim na base de um card com Item na Lista (a assinatura do app).
 * O pai precisa de `overflow-hidden` e posição relativa. Decorativo: o Progresso é lido
 * em outro lugar.
 */
export function FioProgresso({ item }: { item: ItemLista }) {
  const proporcao = proporcaoDoFio(item);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/45"
    >
      <View
        className="h-full bg-marca-forte"
        style={{ width: proporcao === null ? TRACO_CURTO : `${proporcao * 100}%` }}
      />
    </View>
  );
}
