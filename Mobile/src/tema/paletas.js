// PROTÓTIPO (ticket 29). Tokens semânticos de cor e os valores de cada paleta/tema.
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
 * Três carmesins escuros, cada um com um fundo levemente diferente
 * (neutro, quente, frio). O carmesim é o mesmo nos dois temas.
 */
const PALETAS = {
  carmesim: {
    nome: 'Carmesim',
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
      fundo: '#F6F5F5',
      superficie: '#FFFFFF',
      'superficie-alta': '#ECEAEA',
      nav: '#FFFFFF',
      borda: '#D9D5D6',
      texto: '#2A2627',
      'texto-suave': '#5F595B',
      'texto-forte': '#121011',
      marca: '#9B1B30',
      'marca-forte': '#7F1527',
      'marca-texto': '#9B1B30',
      ...STATUS_CLARO,
    },
  },
  bordo: {
    nome: 'Bordô',
    escuro: {
      fundo: '#100C0C',
      superficie: '#1B1515',
      'superficie-alta': '#261E1E',
      nav: '#0B0808',
      borda: '#382C2C',
      texto: '#DDD4D2',
      'texto-suave': '#A59894',
      'texto-forte': '#F7F2F1',
      marca: '#7A1424',
      'marca-forte': '#951A2E',
      'marca-texto': '#E06A7B',
      ...STATUS_ESCURO,
    },
    claro: {
      fundo: '#F8F4F2',
      superficie: '#FFFDFC',
      'superficie-alta': '#EFE8E6',
      nav: '#FFFDFC',
      borda: '#DDD2CF',
      texto: '#2C2322',
      'texto-suave': '#635755',
      'texto-forte': '#140E0D',
      marca: '#7A1424',
      'marca-forte': '#5F0F1B',
      'marca-texto': '#7A1424',
      ...STATUS_CLARO,
    },
  },
  rubi: {
    nome: 'Rubi',
    escuro: {
      fundo: '#0B0C10',
      superficie: '#15161C',
      'superficie-alta': '#1F2129',
      nav: '#08090C',
      borda: '#2D303B',
      texto: '#D4D7DF',
      'texto-suave': '#989DAB',
      'texto-forte': '#F3F5F9',
      marca: '#B3123A',
      'marca-forte': '#CC1A45',
      'marca-texto': '#F46685',
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

module.exports = { NOMES, PALETAS, canais, variaveis };
