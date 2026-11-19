import { useId } from 'react';

import { Icone } from '../../../componentes/Icone';
import { isoParaTexto, textoParaIso } from './datas';
import { textos } from './textos';

type PropsData = { rotulo: string; valor: string; minimo?: string; maximo: string; mudar(texto: string): void };

/** Data pelo calendário do navegador, com "Limpar". */
export function CampoData({ rotulo, valor, minimo, maximo, mudar }: PropsData) {
  const id = useId();
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-texto-suave">
        {rotulo}
      </label>
      <div className="flex items-center gap-1">
        <input
          id={id}
          type="date"
          value={textoParaIso(valor)}
          min={minimo || undefined}
          max={maximo}
          onChange={(e) => mudar(isoParaTexto(e.target.value))}
          className="w-full rounded-md border border-borda bg-superficie-alta px-3 py-2.5 text-[15px] text-texto-forte outline-none focus:border-marca-texto [color-scheme:light_dark]"
        />
        {valor ? (
          <button
            type="button"
            onClick={() => mudar('')}
            aria-label={textos.limpar(rotulo)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-alta hover:text-texto-forte"
          >
            <Icone nome="fechar" tamanho={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
