import { type KeyboardEvent, useRef } from 'react';

import { type EstadoConsumo, NOMES_ESTADO } from '@dominio/estadoConsumo';

import { COR_DO_ESTADO } from '../../componentes/status';
import { textos } from './textos';

type PropsAbas = {
  estados: EstadoConsumo[];
  contagem: Record<EstadoConsumo, number>;
  ativa: EstadoConsumo;
  escolher(estado: EstadoConsumo): void;
};

/** Abas por Status (padrão ARIA de abas: setas, Home e End movem entre elas). */
export function AbasStatus({ estados, contagem, ativa, escolher }: PropsAbas) {
  const lista = useRef<HTMLDivElement>(null);
  const mover = (e: KeyboardEvent) => {
    const i = estados.indexOf(ativa);
    const alvo =
      e.key === 'ArrowRight' ? (i + 1) % estados.length
      : e.key === 'ArrowLeft' ? (i - 1 + estados.length) % estados.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? estados.length - 1
      : null;
    const destino = alvo === null ? undefined : estados[alvo];
    if (alvo === null || !destino) return;
    e.preventDefault();
    escolher(destino);
    lista.current?.querySelectorAll<HTMLElement>('[role="tab"]')[alvo]?.focus();
  };
  return (
    <div ref={lista} role="tablist" aria-label={textos.abas} onKeyDown={mover} className="mt-4 flex gap-6">
      {estados.map((e) => {
        const selecionada = e === ativa;
        return (
          <button
            key={e}
            type="button"
            role="tab"
            id={`aba-${e}`}
            aria-selected={selecionada}
            aria-controls="painel-status"
            tabIndex={selecionada ? 0 : -1}
            onClick={() => escolher(e)}
            className={`relative pb-3 text-[15px] font-semibold outline-none focus-visible:text-texto-forte focus-visible:underline ${
              selecionada ? 'text-texto-forte' : 'text-texto-suave hover:text-texto'
            }`}
          >
            {NOMES_ESTADO[e]} <span className="font-normal opacity-70">{contagem[e]}</span>
            {selecionada ? (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] rounded-t" style={{ background: COR_DO_ESTADO[e] }} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
