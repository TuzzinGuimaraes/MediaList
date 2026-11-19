import type { ReactNode } from 'react';

import { Monograma } from '../componentes/Monograma';

/** Moldura das telas sem sessão (Entrar, Criar conta). */
export function TelaDeAcesso({ titulo, children, rodape }: { titulo: string; children: ReactNode; rodape: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <Monograma tamanho={40} rotulo={null} />
          <span className="text-[22px] font-bold text-texto-forte">MediaList</span>
        </div>
        <h1 className="text-[28px] font-bold text-texto-forte">{titulo}</h1>
        {children}
        <p className="text-[14px] text-texto-suave">{rodape}</p>
      </div>
    </main>
  );
}
