type Props = {
  tamanho?: number;
  /** Nome para o leitor de tela; null deixa o monograma só decorativo. */
  rotulo?: string | null;
  className?: string;
};

/** Monograma "M" em carmesim: na nav, nos estados vazios e no carregamento (Resolution do 29). */
export function Monograma({ tamanho = 28, rotulo = 'MediaList', className = '' }: Props) {
  return (
    <span
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo ?? undefined}
      aria-hidden={rotulo ? undefined : true}
      className={`inline-block font-bold leading-none text-marca select-none ${className}`}
      style={{ fontSize: tamanho, letterSpacing: -tamanho * 0.04 }}
    >
      M
    </span>
  );
}
