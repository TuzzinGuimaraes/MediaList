import type { Paginacao } from '../../api/paginacao';
import { Icone } from '../../componentes/Icone';

/** Números a mostrar: a primeira, a última e duas em volta da atual; null marca o salto ("…"). */
function numerosVisiveis(atual: number, total: number): (number | null)[] {
  const escolhidas = [...new Set([1, atual - 2, atual - 1, atual, atual + 1, atual + 2, total])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  return escolhidas.flatMap((p, i) => (i > 0 && p - escolhidas[i - 1]! > 1 ? [null, p] : [p]));
}

const BOTAO =
  'flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-marca-texto';

/** Paginação numerada pelo `total` da resposta. */
export function NavPaginas({ paginacao, ir }: { paginacao: Paginacao; ir(pagina: number): void }) {
  const { pagina, totalDePaginas, temAnterior, temProxima } = paginacao;
  if (totalDePaginas <= 1) return null;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-center gap-1.5">
      <button
        type="button"
        aria-label="Página anterior"
        disabled={!temAnterior}
        onClick={() => ir(pagina - 1)}
        className={`${BOTAO} text-texto-forte hover:bg-superficie-alta disabled:opacity-30`}
      >
        <Icone nome="esquerda" />
      </button>
      {numerosVisiveis(pagina, totalDePaginas).map((p, i) =>
        p === null ? (
          <span key={`salto-${i}`} aria-hidden className="text-texto-suave">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Página ${p}`}
            aria-current={p === pagina ? 'page' : undefined}
            onClick={() => ir(p)}
            className={`${BOTAO} ${p === pagina ? 'bg-marca font-bold text-sobre-marca' : 'text-texto hover:bg-superficie-alta'}`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Próxima página"
        disabled={!temProxima}
        onClick={() => ir(pagina + 1)}
        className={`${BOTAO} text-texto-forte hover:bg-superficie-alta disabled:opacity-30`}
      >
        <Icone nome="direita" />
      </button>
    </nav>
  );
}
