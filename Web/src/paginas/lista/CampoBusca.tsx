import { useEffect, useRef } from 'react';

import { Icone } from '../../componentes/Icone';
import { textos } from './textos';

/** Lupa que vira campo; Esc ou o X fecham e limpam a busca. */
export function CampoBusca({ valor, mudar }: { valor: string | null; mudar(v: string | null): void }) {
  const campo = useRef<HTMLInputElement>(null);
  const aberta = valor !== null;
  useEffect(() => {
    if (aberta) campo.current?.focus();
  }, [aberta]);
  if (!aberta) {
    return (
      <button
        type="button"
        onClick={() => mudar('')}
        aria-label={textos.buscar}
        className="flex h-11 w-11 items-center justify-center rounded-md text-texto-forte hover:bg-superficie-alta"
      >
        <Icone nome="busca" />
      </button>
    );
  }
  return (
    <div className="flex h-11 items-center gap-2 rounded-md border border-marca-texto bg-superficie-alta px-3">
      <Icone nome="busca" tamanho={16} className="text-texto-suave" />
      <input
        ref={campo}
        type="search"
        aria-label={textos.buscar}
        value={valor}
        onChange={(e) => mudar(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && mudar(null)}
        placeholder={textos.campoBusca}
        className="w-64 bg-transparent text-[14px] text-texto-forte outline-none placeholder:text-texto-suave"
      />
      <button type="button" onClick={() => mudar(null)} aria-label={textos.fecharBusca} className="text-texto-suave hover:text-texto-forte">
        <Icone nome="fechar" tamanho={16} />
      </button>
    </div>
  );
}
