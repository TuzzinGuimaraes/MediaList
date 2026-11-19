import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, useId } from 'react';

const ESTILO_CAMPO =
  'w-full rounded-md border border-borda bg-superficie-alta px-3 py-2.5 text-[15px] text-texto-forte outline-none placeholder:text-texto-suave focus:border-marca-texto aria-invalid:border-erro';

type Envoltorio = { rotulo: string; erro?: string | null; dica?: ReactNode };

function Moldura({ id, rotulo, erro, dica, children }: Envoltorio & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-texto-suave">
        {rotulo}
      </label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} className="text-[13px] text-erro">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${id}-dica`} className="text-[13px] text-texto-suave">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

function descricao(id: string, { erro, dica }: Envoltorio) {
  return erro ? `${id}-erro` : dica ? `${id}-dica` : undefined;
}

/** Campo de texto com rótulo, dica e erro (ex.: o `detalhes[campo]` de um 400 da API). */
export function Campo({ rotulo, erro, dica, ...input }: Envoltorio & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Moldura id={id} rotulo={rotulo} erro={erro} dica={dica}>
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, { rotulo, erro, dica })}
        className={ESTILO_CAMPO}
        {...input}
      />
    </Moldura>
  );
}

export function AreaTexto({ rotulo, erro, dica, ...area }: Envoltorio & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Moldura id={id} rotulo={rotulo} erro={erro} dica={dica}>
      <textarea
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, { rotulo, erro, dica })}
        className={`${ESTILO_CAMPO} min-h-28 resize-y`}
        {...area}
      />
    </Moldura>
  );
}
