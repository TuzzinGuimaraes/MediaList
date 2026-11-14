// Tokens de design do MediaList (ticket 29): fonte única para o app (Mobile/) e, no
// ticket 31, para o web (Frontend/). Só dados, sem lógica de nenhum dos dois.
//
// Formato pensado para o `@theme` do Tailwind 4: cada cor vira `--color-<nome>` e cada
// tema é um bloco de variáveis. Ex.: `@theme { --color-fundo: var(--cor-fundo); }` e
// `:root { --cor-fundo: #0E0E10; }` / `.claro { --cor-fundo: #F4F5F8; }`.
// CommonJS porque os `tailwind.config.js` leem este arquivo no Node.

/**
 * Cores por tema, com nomes semânticos (o papel, não o tom). O carmesim é da marca e das
 * ações principais; os Status usam tons dessaturados, para não competir com ele.
 */
const cores = {
  /** Carmesim (#9B1B30) sobre fundo neutro. */
  escuro: {
    fundo: '#0E0E10',
    superficie: '#18181B',
    'superficie-alta': '#232327',
    nav: '#0A0A0C',
    borda: '#303036',
    texto: '#D7D7DC',
    'texto-suave': '#9C9CA5',
    'texto-forte': '#F5F5F7',
    /** Carmesim de preenchimento (botão primário, selos de destaque). Texto em cima: sobre-marca. */
    marca: '#9B1B30',
    'marca-forte': '#B52640',
    /** Carmesim para texto, ícone e borda sobre o fundo (contraste AA). */
    'marca-texto': '#EA6A7E',
    'sobre-marca': '#FFFFFF',
    erro: '#F08080',
    nota: '#E3C15A',
    'status-progresso': '#7C9CC8',
    'status-concluido': '#78AE8B',
    'status-pausado': '#CDA866',
    'status-abandonado': '#8F9096',
    'status-planejado': '#A895CB',
    'status-platinado': '#D8BA62',
  },
  /** Rubi (#B3123A) sobre fundo frio. */
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
    'sobre-marca': '#FFFFFF',
    erro: '#B3261E',
    nota: '#8A6A0E',
    'status-progresso': '#3D6394',
    'status-concluido': '#3B7650',
    'status-pausado': '#8A6420',
    'status-abandonado': '#62636A',
    'status-planejado': '#6A549C',
    'status-platinado': '#86691C',
  },
};

/** Família e pesos usados. No app, cada peso é uma família carregada à parte. */
const fonte = {
  familia: 'Outfit',
  pesos: { normal: 400, semi: 600, negrito: 700 },
};

module.exports = { cores, fonte };
