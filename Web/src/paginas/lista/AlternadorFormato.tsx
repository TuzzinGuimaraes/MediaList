// Alternador de formato no cabeçalho fixo da Lista: grade de capas, linhas compactas e só
// texto. Botões de alternância (aria-pressed) num grupo com nome.
import type { ReactNode } from 'react';

import { FOCO } from './MenuStatus';
import { FORMATOS, type FormatoLista } from './preferencias';
import { NOMES_FORMATO, textos } from './textos';

const ICONES: Record<FormatoLista, ReactNode> = {
  grade: (
    <>
      <rect x="3" y="3" width="7.5" height="11" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="11" rx="1.5" />
      <path d="M3 18h7.5M13.5 18h7.5M3 21h5M13.5 21h5" />
    </>
  ),
  compacta: (
    <>
      <rect x="3" y="4" width="4" height="6" rx="1" />
      <rect x="3" y="14" width="4" height="6" rx="1" />
      <path d="M10 6h11M10 9h6M10 16h11M10 19h6" />
    </>
  ),
  texto: <path d="M3 5h18M3 9.5h18M3 14h18M3 18.5h18" />,
};

export function AlternadorFormato({ formato, mudar }: { formato: FormatoLista; mudar(f: FormatoLista): void }) {
  return (
    <div role="group" aria-label={textos.formato} className="inline-flex h-10 shrink-0 rounded-lg bg-superficie p-1">
      {FORMATOS.map((f) => {
        const marcado = formato === f;
        return (
          <button
            key={f}
            type="button"
            aria-pressed={marcado}
            aria-label={NOMES_FORMATO[f]}
            title={NOMES_FORMATO[f]}
            onClick={() => mudar(f)}
            className={`flex w-9 items-center justify-center rounded-md transition-colors ${FOCO} ${
              marcado ? 'bg-superficie-alta text-texto-forte shadow-sm' : 'text-texto-suave hover:text-texto-forte'
            }`}
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {ICONES[f]}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
