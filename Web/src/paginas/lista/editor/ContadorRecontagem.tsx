import type { TipoMidia } from '@dominio/estadoConsumo';
import { nomeDaRecontagem } from '@dominio/itemLista';

import { Icone } from '../../../componentes/Icone';

/** Recontagem com − e + (mínimo 0); na tela, "Reassistido 2×". */
export function ContadorRecontagem({ tipo, valor, mudar }: { tipo: TipoMidia; valor: number; mudar(n: number): void }) {
  const nome = nomeDaRecontagem(tipo);
  const botao =
    'flex h-10 w-10 items-center justify-center rounded-full text-texto-forte outline-none hover:bg-superficie focus-visible:ring-2 focus-visible:ring-marca-texto disabled:text-borda';
  return (
    <div role="group" aria-label={nome} className="flex flex-col gap-1.5">
      <span aria-hidden className="text-[13px] font-semibold text-texto-suave">
        {nome}
      </span>
      <div className="flex items-center justify-between rounded-full border border-borda bg-superficie-alta">
        <button type="button" aria-label={`Diminuir ${nome}`} disabled={valor <= 0} onClick={() => mudar(valor - 1)} className={botao}>
          <Icone nome="menos" tamanho={16} />
        </button>
        <span aria-live="polite" aria-label={`${nome}: ${valor}×`} className="font-semibold tabular-nums text-texto-forte">
          {`${valor}×`}
        </span>
        <button type="button" aria-label={`Aumentar ${nome}`} onClick={() => mudar(valor + 1)} className={botao}>
          <Icone nome="mais" tamanho={16} />
        </button>
      </div>
    </div>
  );
}
