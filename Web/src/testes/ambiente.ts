// O que o jsdom não tem e as telas usam: `matchMedia` (tema do sistema, reduzir movimento,
// largura da tela).
type Ouvinte = (e: MediaQueryListEvent) => void;

/** Largura padrão dos testes: desktop. */
export const LARGURA_DESKTOP = 1280;

let esquema: 'escuro' | 'claro' = 'escuro';
let largura = LARGURA_DESKTOP;
const ouvintes = new Set<{ consulta: string; ouvinte: Ouvinte }>();

function corresponde(consulta: string): boolean {
  if (consulta.includes('prefers-color-scheme: light')) return esquema === 'claro';
  if (consulta.includes('prefers-color-scheme: dark')) return esquema === 'escuro';
  const minima = /min-width:\s*(\d+)px/.exec(consulta);
  if (minima) return largura >= Number(minima[1]);
  return false;
}

function avisar() {
  for (const { consulta, ouvinte } of ouvintes) {
    ouvinte({ matches: corresponde(consulta), media: consulta } as MediaQueryListEvent);
  }
}

/** Esquema de cor do sistema operacional; troca avisa quem ouve o `matchMedia`. */
export function simularEsquemaDeCor(novo: 'escuro' | 'claro') {
  esquema = novo;
  avisar();
}

/** Largura da janela, para as consultas `min-width`; troca avisa quem ouve. */
export function simularLargura(nova: number) {
  largura = nova;
  avisar();
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
