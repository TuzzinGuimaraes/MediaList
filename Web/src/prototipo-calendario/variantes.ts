// PROTÓTIPO (ticket 50): as variantes da barra (2ª rodada: base Agenda + faixa e "A seguir" da C).
export const VARIANTES = [
  { chave: '1', nome: 'Proposta final' },
  { chave: '2', nome: 'Final sem a faixa de dias' },
] as const;
export type Chave = (typeof VARIANTES)[number]['chave'];
export type Tela = 'desktop' | 'celular';
export type Vista = 'agenda' | 'semana';
