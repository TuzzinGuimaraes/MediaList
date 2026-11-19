import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primario: carmesim (a ação principal da tela); secundario: contorno; fantasma: só texto. */
  variante?: 'primario' | 'secundario' | 'fantasma';
  tamanho?: 'normal' | 'grande';
  /** Desabilita e avisa o leitor de tela enquanto a ação roda. */
  carregando?: boolean;
  icone?: ReactNode;
};

const VARIANTES = {
  primario: 'bg-marca text-sobre-marca hover:bg-marca-forte',
  secundario: 'border border-borda text-texto-forte hover:bg-superficie-alta',
  fantasma: 'text-texto-suave hover:bg-superficie-alta hover:text-texto-forte',
};

export function Botao({
  variante = 'primario',
  tamanho = 'normal',
  carregando = false,
  icone,
  type = 'button',
  disabled,
  className = '',
  children,
  ...resto
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-marca-texto disabled:cursor-not-allowed disabled:opacity-60 ${
        tamanho === 'grande' ? 'min-h-12 px-6 text-[16px]' : 'min-h-11 px-4 text-[14px]'
      } ${VARIANTES[variante]} ${className}`}
      {...resto}
    >
      {icone}
      {children}
    </button>
  );
}
