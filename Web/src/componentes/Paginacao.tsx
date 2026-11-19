import type { Paginacao as DadosPaginacao } from '../api/paginacao';
import { Icone } from './Icone';

/** Números a mostrar: a primeira, a última e duas em volta da atual; null marca o salto ("…"). */
function numerosVisiveis(atual: number, total: number): (number | null)[] {
  const escolhidas = [...new Set([1, atual - 2, atual - 1, atual, atual + 1, atual + 2, total])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  return escolhidas.flatMap((p, i) => (i > 0 && p - escolhidas[i - 1]! > 1 ? [null, p] : [p]));
}

const BOTAO =
  'flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-marca-texto';
const SETA = `${BOTAO} text-texto-forte hover:bg-superficie-alta disabled:cursor-not-allowed disabled:opacity-30`;

type Props = {
  /** De `paginacao()` (api/paginacao.ts), pelo `total` da resposta. */
  paginacao: DadosPaginacao;
  ir(pagina: number): void;
  /** Botões numerados entre as setas; sem eles, "Página N de M". */
  numeros?: boolean;
};

/** Anterior e Próxima, com os números das páginas ou "Página N de M"; some com uma página só. */
export function Paginacao({ paginacao, ir, numeros = false }: Props) {
  const { pagina, totalDePaginas, temAnterior, temProxima } = paginacao;
  if (totalDePaginas <= 1) return null;
  return (
    <nav aria-label="Paginação" className={`flex items-center justify-center ${numeros ? 'gap-1.5' : 'gap-4'}`}>
      <button type="button" aria-label="Página anterior" disabled={!temAnterior} onClick={() => ir(pagina - 1)} className={SETA}>
        <Icone nome="esquerda" />
      </button>
      {numeros ? (
        numerosVisiveis(pagina, totalDePaginas).map((p, i) =>
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
        )
      ) : (
        <span className="text-[14px] text-texto-suave">
          Página {pagina} de {totalDePaginas}
        </span>
      )}
      <button type="button" aria-label="Próxima página" disabled={!temProxima} onClick={() => ir(pagina + 1)} className={SETA}>
        <Icone nome="direita" />
      </button>
    </nav>
  );
}
