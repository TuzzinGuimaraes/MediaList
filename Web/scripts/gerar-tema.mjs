// Gera src/tema.gerado.css a partir de design/tokens.js (fonte única de cores e fonte).
// Cada cor vira `--color-<nome>` no @theme do Tailwind, apontando para `--cor-<nome>`, que
// muda por tema: escuro (Carmesim) no :root, claro (Rubi) na classe `.claro`.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { cores, fonte } = require(join(aqui, '../../design/tokens.js'));

const nomes = Object.keys(cores.escuro);
const variaveis = (tema) => nomes.map((n) => `  --cor-${n}: ${cores[tema][n]};`).join('\n');

const css = `/* GERADO por scripts/gerar-tema.mjs a partir de design/tokens.js. Não edite. */
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

writeFileSync(join(aqui, '../src/tema.gerado.css'), css);
console.log(`tema.gerado.css: ${nomes.length} cores, 2 temas`);
