/** Erro da API em destaque, dentro da aba ou do Modal. */
export function Aviso({ texto }: { texto: string | null }) {
  return texto ? (
    <p role="alert" className="rounded-md border border-erro/40 bg-erro/10 p-3 text-[14px] text-erro">
      {texto}
    </p>
  ) : null;
}
