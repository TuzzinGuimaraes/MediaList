const tipografia = require('./src/tema/tipografia');

/** text-<nivel> com tamanho e altura de linha da escala única. */
const fontSize = Object.fromEntries(
  Object.entries(tipografia).map(([nivel, { tamanho, altura }]) => [
    nivel,
    altura ? [`${tamanho}px`, { lineHeight: `${altura}px` }] : `${tamanho}px`,
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: require('./src/tema/paleta'),
      fontSize,
    },
  },
  plugins: [],
};
