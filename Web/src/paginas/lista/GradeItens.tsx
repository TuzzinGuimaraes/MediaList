import type { ItemLista } from './api';
import { type AcoesDoItem, CardItem } from './CardItem';

/** Grade compacta: cards de ~300px, tantas colunas quanto couberem. */
export function GradeItens({ itens, acoes, comStatus }: { itens: ItemLista[]; acoes: AcoesDoItem; comStatus?: boolean }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
      {itens.map((i) => (
        <CardItem key={i.id_lista} item={i} acoes={acoes} comStatus={comStatus} />
      ))}
    </div>
  );
}
