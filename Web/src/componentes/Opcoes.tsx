import { type ReactNode, useId } from 'react';

type Props<T extends string> = {
  /** Nome do grupo, para o leitor de tela e como legenda visível. */
  rotulo: string;
  opcoes: readonly { valor: T; nome: string }[];
  /** A opção marcada; ausente, nenhuma. */
  valor: T | undefined;
  mudar(valor: T): void;
  /** Esconde a legenda (o contexto já diz o que é), mantendo o nome acessível. */
  semLegenda?: boolean;
  /** Algo na mesma linha das pílulas, depois delas (ex.: o "+N" que mostra o resto). */
  depois?: ReactNode;
};

/** Escolha única em pílulas (tema, filtros), com rádios nativos por baixo. */
export function Opcoes<T extends string>({ rotulo, opcoes, valor, mudar, semLegenda = false, depois }: Props<T>) {
  const nome = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={semLegenda ? 'sr-only' : 'mb-2 text-[13px] font-semibold text-texto-suave'}>{rotulo}</legend>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map((o) => (
          <label key={o.valor} className="cursor-pointer">
            <input
              type="radio"
              name={nome}
              value={o.valor}
              checked={o.valor === valor}
              onChange={() => mudar(o.valor)}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-9 items-center rounded-full border border-borda px-3.5 text-[14px] text-texto transition hover:border-texto-suave peer-checked:border-marca peer-checked:bg-marca peer-checked:text-sobre-marca peer-focus-visible:ring-2 peer-focus-visible:ring-marca-texto">
              {o.nome}
            </span>
          </label>
        ))}
        {depois}
      </div>
    </fieldset>
  );
}
