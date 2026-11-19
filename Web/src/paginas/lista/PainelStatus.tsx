import { type EstadoConsumo, NOMES_ESTADO, NOMES_TIPO, type TipoMidia } from '@dominio/estadoConsumo';
import { porTipo } from '@dominio/filtrosLista';

import { Vazio } from '../../componentes/Estados';
import { COR_DO_ESTADO } from '../../componentes/status';
import type { ItemLista } from './api';
import type { AcoesDoItem } from './CardItem';
import { GradeItens } from './GradeItens';
import { textos } from './textos';

type Props = {
  estado: EstadoConsumo;
  /** A contagem da aba, já com os filtros. */
  total: number;
  itens: ItemLista[];
  tipos: readonly TipoMidia[];
  acoes: AcoesDoItem;
  /** Os filtros escondem Itens: o vazio diz isso. */
  filtrado: boolean;
};

/** O painel da aba de Status: título na cor do Status e as subseções por Tipo (Anime, Mangá). */
export function PainelStatus({ estado, total, itens, tipos, acoes, filtrado }: Props) {
  return (
    <div role="tabpanel" id="painel-status" aria-labelledby={`aba-${estado}`} className="flex flex-col gap-6">
      <h2 className="text-[22px] font-bold" style={{ color: COR_DO_ESTADO[estado] }}>
        {`${NOMES_ESTADO[estado]} · ${total}`}
      </h2>
      {itens.length ? (
        porTipo(itens, tipos).map((s) => (
          <section key={s.tipo ?? 'todos'} aria-label={s.tipo ? NOMES_TIPO[s.tipo] : undefined} className="flex flex-col gap-2.5">
            {s.tipo ? (
              <h3 className="text-[15px] font-semibold text-texto-suave">{`${NOMES_TIPO[s.tipo]} · ${s.itens.length}`}</h3>
            ) : null}
            <GradeItens itens={s.itens} acoes={acoes} />
          </section>
        ))
      ) : (
        <Vazio texto={filtrado ? textos.vazioFiltrado(NOMES_ESTADO[estado]) : textos.vazio(NOMES_ESTADO[estado])} />
      )}
    </div>
  );
}
