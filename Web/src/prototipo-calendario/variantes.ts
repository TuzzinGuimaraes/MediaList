// PROTÓTIPO (ticket 50): as variantes da barra.
export const VARIANTES = [
  { chave: 'A', nome: 'Agenda' },
  { chave: 'B', nome: 'Semana em colunas' },
  { chave: 'C', nome: 'Dia em foco' },
  { chave: 'D', nome: 'Pôsteres' },
] as const;
export type Chave = (typeof VARIANTES)[number]['chave'];
export type Tela = 'desktop' | 'celular';
