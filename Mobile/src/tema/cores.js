// Ponte entre design/tokens.js e o NativeWind. O tailwind.config.js gera as classes a
// partir dos NOMES (bg-fundo, text-texto-suave...), lidas de variáveis CSS; o TemaProvider
// troca os valores em runtime com vars(). CommonJS porque o Tailwind lê este arquivo no Node.
const { cores, fonte } = require('../../../design/tokens');

/** Nome de cada token de cor; vira a classe e a variável --cor-<nome>. */
const NOMES = Object.keys(cores.escuro);

/** "#9B1B30" -> "155 27 48", o formato que rgb(var(--cor-x) / <alpha-value>) espera. */
function canais(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Variáveis CSS de um tema: { '--cor-fundo': '14 14 16', ... }. */
function variaveis(tema) {
  return Object.fromEntries(NOMES.map((nome) => [`--cor-${nome}`, canais(cores[tema][nome])]));
}

/**
 * Família carregada para cada peso (@expo-google-fonts/outfit). No Android uma família
 * customizada não ganha negrito por fontWeight: o peso escolhe a família.
 */
const FONTES = {
  normal: `${fonte.familia}_${fonte.pesos.normal}Regular`,
  semi: `${fonte.familia}_${fonte.pesos.semi}SemiBold`,
  negrito: `${fonte.familia}_${fonte.pesos.negrito}Bold`,
};

module.exports = { CORES: cores, NOMES, FONTES, canais, variaveis };
