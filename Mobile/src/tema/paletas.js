// PROTÓTIPO (ticket 29). Tokens semânticos de cor e os valores de cada tema.
// O tailwind.config.js gera as classes a partir de NOMES (rgb(var(--cor-x) / <alpha-value>));
// o PrototipoContext aplica os valores com vars() num View raiz e o usePaleta() os devolve em JS.
// CommonJS porque o Tailwind lê este arquivo no Node.

/** Nome de cada token; vira a classe (bg-fundo, text-texto-suave...) e a variável --cor-<nome>. */
const NOMES = [
  'fundo',
  'superficie',
  'superficie-alta',
  'nav',
  'borda',
  'texto',
  'texto-suave',
  'texto-forte',
  /** Carmesim de preenchimento (botão primário, selo Top 10). Texto em cima: sobre-marca. */
  'marca',
  'marca-forte',
  /** Carmesim para texto, ícone e borda sobre o fundo (contraste AA). */
  'marca-texto',
  'sobre-marca',
  'erro',
  'nota',
  'status-progresso',
  'status-concluido',
  'status-pausado',
  'status-abandonado',
  'status-planejado',
  'status-platinado',
];

const STATUS_ESCURO = {
  'status-progresso': '#7C9CC8',
  'status-concluido': '#78AE8B',
  'status-pausado': '#CDA866',
  'status-abandonado': '#8F9096',
  'status-planejado': '#A895CB',
  'status-platinado': '#D8BA62',
  nota: '#E3C15A',
  erro: '#F08080',
  'sobre-marca': '#FFFFFF',
};

const STATUS_CLARO = {
  'status-progresso': '#3D6394',
  'status-concluido': '#3B7650',
  'status-pausado': '#8A6420',
  'status-abandonado': '#62636A',
  'status-planejado': '#6A549C',
  'status-platinado': '#86691C',
  nota: '#8A6A0E',
  erro: '#B3261E',
  'sobre-marca': '#FFFFFF',
};

/**
 * Os dois temas escolhidos na 1ª rodada: Carmesim (#9B1B30, fundo neutro) no escuro e
 * Rubi (#B3123A, fundo frio) no claro.
 */
const TEMAS = {
  escuro: {
    fundo: '#0E0E10',
    superficie: '#18181B',
    'superficie-alta': '#232327',
    nav: '#0A0A0C',
    borda: '#303036',
    texto: '#D7D7DC',
    'texto-suave': '#9C9CA5',
    'texto-forte': '#F5F5F7',
    marca: '#9B1B30',
    'marca-forte': '#B52640',
    'marca-texto': '#EA6A7E',
    ...STATUS_ESCURO,
  },
  claro: {
    fundo: '#F4F5F8',
    superficie: '#FFFFFF',
    'superficie-alta': '#E9EBF0',
    nav: '#FFFFFF',
    borda: '#D3D6DE',
    texto: '#23252C',
    'texto-suave': '#575B66',
    'texto-forte': '#0E0F13',
    marca: '#B3123A',
    'marca-forte': '#920E2F',
    'marca-texto': '#A8102F',
    ...STATUS_CLARO,
  },
};

/** "#9B1B30" -> "155 27 48", o formato que rgb(var(--cor-x) / <alpha-value>) espera. */
function canais(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Variáveis CSS de um conjunto de cores: { '--cor-fundo': '14 14 16', ... }. */
function variaveis(cores) {
  return Object.fromEntries(NOMES.map((nome) => [`--cor-${nome}`, canais(cores[nome])]));
}

module.exports = { NOMES, TEMAS, canais, variaveis };
