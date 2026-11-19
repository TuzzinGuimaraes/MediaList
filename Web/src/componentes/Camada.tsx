// Sheet (painel da direita, o "sheet" do app no desktop: filtros) e Modal (centrado:
// editor do Item, confirmações). Os dois são diálogos modais: Esc e o fundo fecham, o foco
// fica preso dentro e volta para quem abriu, e a página atrás não rola.
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Icone } from './Icone';

type Props = {
  titulo: string;
  aberto: boolean;
  fechar(): void;
  children: ReactNode;
  /** Rodapé fixo (Aplicar, Salvar). */
  rodape?: ReactNode;
};

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function useDialogoModal(aberto: boolean, fechar: () => void) {
  const painel = useRef<HTMLDivElement>(null);
  const fecharAtual = useRef(fechar);
  useEffect(() => {
    fecharAtual.current = fechar;
  });

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    painel.current?.focus();

    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        fecharAtual.current();
        return;
      }
      if (e.key !== 'Tab' || !painel.current) return;
      const focaveis = [...painel.current.querySelectorAll<HTMLElement>(FOCAVEIS)];
      const primeiro = focaveis[0];
      const ultimo = focaveis.at(-1);
      if (!primeiro || !ultimo) return;
      if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === painel.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', teclado);
    return () => {
      document.removeEventListener('keydown', teclado);
      document.body.style.overflow = overflow;
      anterior?.focus();
    };
  }, [aberto]);

  return painel;
}

function Camada({ titulo, aberto, fechar, children, rodape, forma }: Props & { forma: 'sheet' | 'modal' }) {
  const painel = useDialogoModal(aberto, fechar);
  const idTitulo = useId();
  if (!aberto) return null;
  const sheet = forma === 'sheet';
  return createPortal(
    <div className={`fixed inset-0 z-50 flex ${sheet ? 'justify-end' : 'items-center justify-center p-6'}`}>
      <div aria-hidden className="absolute inset-0 bg-black/55 motion-safe:animate-[aparecer_150ms_ease-out]" onClick={fechar} />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`relative flex flex-col bg-superficie shadow-2xl outline-none ${
          sheet
            ? 'h-full w-[min(420px,100vw)] motion-safe:animate-[deslizar_200ms_ease-out]'
            : 'max-h-[calc(100vh-3rem)] w-[min(560px,100%)] rounded-xl motion-safe:animate-[surgir_160ms_ease-out]'
        }`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-borda px-5 py-4">
          <h2 id={idTitulo} className="text-[18px] font-bold text-texto-forte">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="flex h-11 w-11 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-alta hover:text-texto-forte"
          >
            <Icone nome="fechar" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {rodape ? <div className="flex justify-end gap-3 border-t border-borda px-5 py-4">{rodape}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Sheet(props: Props) {
  return <Camada {...props} forma="sheet" />;
}

export function Modal(props: Props) {
  return <Camada {...props} forma="modal" />;
}
