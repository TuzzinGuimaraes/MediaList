import { useId } from 'react';

import { estadoDe, NOMES_ESTADO, rotulosDoTipo, type TipoMidia } from '@dominio/estadoConsumo';

import { COR_DO_ESTADO } from '../../../componentes/status';
import { textos } from './textos';

/** Status em pílulas, só os Rótulos válidos para o Tipo (ADR 0002); o escolhido na cor dele. */
export function EscolhaStatus({ tipo, valor, mudar }: { tipo: TipoMidia; valor: string; mudar(rotulo: string): void }) {
  const nome = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-semibold text-texto-suave">{textos.status}</legend>
      <div className="flex flex-wrap gap-1.5">
        {rotulosDoTipo(tipo).map((rotulo) => {
          const estado = estadoDe(rotulo, tipo);
          const ativo = rotulo === valor;
          const cor = estado ? COR_DO_ESTADO[estado] : 'var(--cor-marca-texto)';
          return (
            <label key={rotulo} className="cursor-pointer">
              <input type="radio" name={nome} value={rotulo} checked={ativo} onChange={() => mudar(rotulo)} className="peer sr-only" />
              <span
                className="inline-flex min-h-9 items-center rounded-full border border-borda px-3.5 text-[14px] font-semibold text-texto-suave transition hover:text-texto-forte peer-focus-visible:ring-2 peer-focus-visible:ring-marca-texto"
                style={ativo ? { borderColor: cor, color: cor, background: `color-mix(in srgb, ${cor} 15%, transparent)` } : undefined}
              >
                {estado ? NOMES_ESTADO[estado] : rotulo}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
