const plugin = require('tailwindcss/plugin');

const tipografia = require('./src/tema/tipografia');
const { NOMES, PALETAS, variaveis } = require('./src/tema/paletas');

/** text-<nivel> com tamanho e altura de linha da escala única. */
const fontSize = Object.fromEntries(
  Object.entries(tipografia).map(([nivel, { tamanho, altura }]) => [
    nivel,
    altura ? [`${tamanho}px`, { lineHeight: `${altura}px` }] : `${tamanho}px`,
  ]),
);

// PROTÓTIPO (ticket 29): cada cor é um token semântico lido de variável CSS; o
// PrototipoContext troca os valores em runtime com vars() (paleta e tema claro/escuro).
const cor = (nome) => `rgb(var(--cor-${nome}) / <alpha-value>)`;
const tokens = Object.fromEntries(NOMES.map((nome) => [nome, cor(nome)]));

// Nomes antigos (copiados do web) apontando para os tokens: as telas não precisam ser reescritas.
const legado = {
  dark: {
    primary: cor('fundo'),
    secondary: cor('superficie'),
    tertiary: cor('superficie-alta'),
    nav: cor('nav'),
    border: cor('borda'),
  },
  accent: {
    blue: cor('marca-texto'),
    'blue-hover': cor('marca-forte'),
    red: cor('erro'),
    green: cor('status-concluido'),
    orange: cor('status-pausado'),
    yellow: cor('nota'),
  },
  text: {
    primary: cor('texto'),
    secondary: cor('texto-suave'),
    bright: cor('texto-forte'),
  },
};

// Fonte em runtime: o peso escolhe a família carregada (Inter_700Bold...), porque no
// Android uma família customizada não ganha negrito por fontWeight. Os tamanhos da
// escala põem o peso regular; font-semibold/font-bold vêm depois e prevalecem.
const fonte = plugin(({ addBase, addUtilities }) => {
  addBase({
    ':root': {
      ...variaveis(PALETAS.carmesim.escuro),
      '--fonte-400': 'Overpass_400Regular',
      '--fonte-500': 'Overpass_500Medium',
      '--fonte-600': 'Overpass_600SemiBold',
      '--fonte-700': 'Overpass_700Bold',
    },
  });
  addUtilities(
    Object.fromEntries(Object.keys(tipografia).map((nivel) => [`.text-${nivel}`, { fontFamily: 'var(--fonte-400)' }])),
  );
  addUtilities({
    '.font-normal': { fontFamily: 'var(--fonte-400)' },
    '.font-medium': { fontFamily: 'var(--fonte-500)' },
    '.font-semibold': { fontFamily: 'var(--fonte-600)' },
    '.font-bold': { fontFamily: 'var(--fonte-700)' },
  });
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  corePlugins: { fontWeight: false },
  theme: {
    extend: {
      colors: { ...tokens, ...legado },
      fontSize,
    },
  },
  plugins: [fonte],
};
