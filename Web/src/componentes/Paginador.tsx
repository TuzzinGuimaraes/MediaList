import type { Paginacao } from '../api/paginacao';
import { Icone } from './Icone';

const SETA =
  'flex h-11 w-11 items-center justify-center rounded-md border border-borda text-texto-forte outline-none hover:bg-superficie-alta focus-visible:ring-2 focus-visible:ring-marca-texto disabled:cursor-not-allowed disabled:opacity-40';

/** Anterior / "Página N de M" / Próxima, a partir do `paginacao()`; some com uma página só. */
export function Paginador({ paginacao, mudar }: { paginacao: Paginacao; mudar(pagina: number): void }) {
  const { pagina, totalDePaginas, temAnterior, temProxima } = paginacao;
  if (totalDePaginas <= 1) return null;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-center gap-4">
      <button type="button" aria-label="Página anterior" disabled={!temAnterior} onClick={() => mudar(pagina - 1)} className={SETA}>
        <Icone nome="esquerda" />
      </button>
      <span className="text-[14px] text-texto-suave">
        Página {pagina} de {totalDePaginas}
      </span>
      <button type="button" aria-label="Próxima página" disabled={!temProxima} onClick={() => mudar(pagina + 1)} className={SETA}>
        <Icone nome="direita" />
      </button>
    </nav>
  );
}
