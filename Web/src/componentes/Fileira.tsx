import { type ReactNode, useRef } from 'react';

import { useReduzirMovimento } from '../tema/movimento';
import { Icone } from './Icone';

export function TituloSecao({ children, cor, direita }: { children: ReactNode; cor?: string; direita?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="text-[20px] font-bold text-texto-forte" style={cor ? { color: cor } : undefined}>
        {children}
      </h2>
      {direita}
    </div>
  );
}

type Props = {
  titulo: string;
  children: ReactNode;
  /** Fileira vazia some (Resolution do 29). */
  vazia?: boolean;
  /** Ação à direita do título ("Ver tudo"). */
  acao?: ReactNode;
  /** Recuo lateral, alinhado com o conteúdo da página. */
  recuo?: string;
};

/** Fileira rolável na horizontal, com setas que aparecem no hover ou no foco. */
export function Fileira({ titulo, children, vazia = false, acao, recuo = 'px-6 lg:px-12' }: Props) {
  const trilho = useRef<HTMLDivElement>(null);
  const reduzir = useReduzirMovimento();
  if (vazia) return null;
  const rolar = (sentido: 1 | -1) =>
    trilho.current?.scrollBy({
      left: sentido * trilho.current.clientWidth * 0.85,
      behavior: reduzir ? 'auto' : 'smooth',
    });
  const seta =
    'absolute inset-y-0 z-10 hidden w-12 items-center justify-center bg-fundo/70 text-texto-forte group-hover:flex group-focus-within:flex hover:bg-fundo/90 focus-visible:flex';
  return (
    <section aria-label={titulo} className="group relative">
      <div className={recuo}>
        <TituloSecao direita={acao}>{titulo}</TituloSecao>
      </div>
      <div className="relative">
        <button type="button" className={`${seta} left-0`} onClick={() => rolar(-1)} aria-label={`Anterior em ${titulo}`}>
          <Icone nome="esquerda" tamanho={28} />
        </button>
        <div ref={trilho} className={`sem-barra flex gap-3 overflow-x-auto ${recuo}`}>
          {children}
        </div>
        <button type="button" className={`${seta} right-0`} onClick={() => rolar(1)} aria-label={`Seguinte em ${titulo}`}>
          <Icone nome="direita" tamanho={28} />
        </button>
      </div>
    </section>
  );
}
