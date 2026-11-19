import { type ReactNode, useId, useState } from 'react';

import { Icone } from '../../../componentes/Icone';

/** Seção recolhível da coluna de filtros; fechada, mostra o valor escolhido ao lado do título. */
export function Secao({ titulo, resumo, children }: { titulo: string; resumo?: string | null; children: ReactNode }) {
  const [aberta, setAberta] = useState(true);
  const id = useId();
  return (
    <section aria-label={titulo} className="border-b border-borda py-3">
      <h2>
        <button
          type="button"
          aria-expanded={aberta}
          aria-controls={id}
          onClick={() => setAberta((a) => !a)}
          className="flex min-h-9 w-full items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-marca-texto"
        >
          <span className="text-[13px] font-semibold tracking-wide text-texto-suave uppercase">{titulo}</span>
          {!aberta && resumo ? <span className="truncate text-[13px] text-marca-texto">{resumo}</span> : null}
          <Icone
            nome="baixo"
            tamanho={16}
            className={`ml-auto text-texto-suave motion-safe:transition-transform ${aberta ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>
      <div id={id} hidden={!aberta} className="pt-2">
        {children}
      </div>
    </section>
  );
}
