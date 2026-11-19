// O que o jsdom não tem e as telas usam: `matchMedia` (tema do sistema, reduzir movimento).
type Ouvinte = (e: MediaQueryListEvent) => void;

let esquema: 'escuro' | 'claro' = 'escuro';
const ouvintes = new Set<{ consulta: string; ouvinte: Ouvinte }>();

function corresponde(consulta: string): boolean {
  if (consulta.includes('prefers-color-scheme: light')) return esquema === 'claro';
  if (consulta.includes('prefers-color-scheme: dark')) return esquema === 'escuro';
  return false;
}

/** Esquema de cor do sistema operacional; troca avisa quem ouve o `matchMedia`. */
export function simularEsquemaDeCor(novo: 'escuro' | 'claro') {
  esquema = novo;
  for (const { consulta, ouvinte } of ouvintes) {
    ouvinte({ matches: corresponde(consulta), media: consulta } as MediaQueryListEvent);
  }
}

window.matchMedia = (consulta: string) =>
  ({
    media: consulta,
    get matches() {
      return corresponde(consulta);
    },
    onchange: null,
    addEventListener: (_: string, ouvinte: Ouvinte) => ouvintes.add({ consulta, ouvinte }),
    removeEventListener: (_: string, ouvinte: Ouvinte) => {
      for (const o of ouvintes) if (o.ouvinte === ouvinte) ouvintes.delete(o);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
