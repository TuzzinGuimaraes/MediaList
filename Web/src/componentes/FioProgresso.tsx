/** Largura do traço quando não se conhece o total. */
const TRACO_CURTO = 14;

type Props = {
  /**
   * Fração consumida, de 0 a 1; null quando o Item não tem total conhecido (traço curto).
   * TODO(web-novo 01): a fração sai de `proporcaoDoFio` em `dominio/itemLista`.
   */
  proporcao: number | null;
  grosso?: boolean;
};

/**
 * Fio de progresso carmesim na base de um card com Item na Lista (a assinatura do
 * MediaList). O pai precisa de `relative` e `overflow-hidden`. Decorativo: o Progresso é
 * lido em outro lugar.
 */
export function FioProgresso({ proporcao, grosso = false }: Props) {
  const largura = proporcao === null ? `${TRACO_CURTO}px` : `${Math.min(1, Math.max(0, proporcao)) * 100}%`;
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 ${grosso ? 'h-1' : 'h-[3px]'}`}>
      <div className="h-full bg-marca-forte" style={{ width: largura }} />
    </div>
  );
}
