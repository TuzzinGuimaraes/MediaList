const plugin = require('tailwindcss/plugin');

const tipografia = require('./src/tema/tipografia');
const { FONTES, NOMES, variaveis } = require('./src/tema/cores');

/** text-<nivel> com tamanho e altura de linha da escala única. */
const fontSize = Object.fromEntries(
  Object.entries(tipografia).map(([nivel, { tamanho, altura }]) => [
    nivel,
    altura ? [`${tamanho}px`, { lineHeight: `${altura}px` }] : `${tamanho}px`,
  ]),
);

// Cada cor é um token de design/tokens.js lido de variável CSS: o TemaProvider troca os
// valores com vars() do NativeWind (Escuro/Claro) e o <alpha-value> mantém bg-marca/20 etc.
const colors = Object.fromEntries(NOMES.map((nome) => [nome, `rgb(var(--cor-${nome}) / <alpha-value>)`]));

// Outfit: o peso escolhe a família carregada, porque no Android uma família customizada não
// ganha negrito por fontWeight. Os tamanhos da escala põem o peso normal; font-semibold e
// font-bold vêm depois no CSS gerado e prevalecem.
const fonte = plugin(({ addBase, addUtilities }) => {
  // Valores do tema Escuro na raiz: o que renderiza fora do TemaProvider já sai com cor.
  addBase({ ':root': variaveis('escuro') });
  addUtilities(
    Object.fromEntries(Object.keys(tipografia).map((nivel) => [`.text-${nivel}`, { fontFamily: FONTES.normal }])),
  );
  addUtilities({
    '.font-normal': { fontFamily: FONTES.normal },
    '.font-semibold': { fontFamily: FONTES.semi },
    '.font-bold': { fontFamily: FONTES.negrito },
  });
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  corePlugins: { fontWeight: false },
  theme: {
    extend: { colors, fontSize },
  },
  plugins: [fonte],
};
