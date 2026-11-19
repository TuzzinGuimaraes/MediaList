// Gera src/estilo/tema.gerado.css a partir de design/tokens.js (fonte única de cores e fonte).
// Cada cor vira `--color-<nome>` no @theme do Tailwind, apontando para `--cor-<nome>`, que
// muda por tema: escuro (Carmesim) no :root e claro (Rubi) na classe `.claro` do <html>.
// Roda ao carregar o vite.config.ts, então dev, build e testes sempre usam os tokens atuais.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Tokens = typeof import('../../design/tokens');

const aqui = dirname(fileURLToPath(import.meta.url));
const DESTINO = join(aqui, '../src/estilo/tema.gerado.css');

export function cssDoTema({ cores, fonte }: Tokens): string {
  const nomes = Object.keys(cores.escuro) as (keyof Tokens['cores']['escuro'])[];
  const variaveis = (tema: 'escuro' | 'claro') => nomes.map((n) => `  --cor-${n}: ${cores[tema][n]};`).join('\n');
  return `/* GERADO por scripts/tema.ts a partir de design/tokens.js. Não edite. */
@theme inline {
${nomes.map((n) => `  --color-${n}: var(--cor-${n});`).join('\n')}
  --font-sans: '${fonte.familia}', system-ui, sans-serif;
}

:root {
  color-scheme: dark;
${variaveis('escuro')}
}

.claro {
  color-scheme: light;
${variaveis('claro')}
}
`;
}

/** Grava o CSS só se mudou, para não disparar o HMR à toa. */
export function gerarTema(): void {
  const require = createRequire(import.meta.url);
  const caminho = require.resolve('../../design/tokens.js');
  delete require.cache[caminho];
  const css = cssDoTema(require(caminho) as Tokens);
  let atual = '';
  try {
    atual = readFileSync(DESTINO, 'utf8');
  } catch {
    // Primeira geração.
  }
  if (atual !== css) writeFileSync(DESTINO, css);
}
