// Contagens das estatísticas da Lista pessoal (Perfil), que não dependem da tela.

import { NOTA_MAXIMA } from './nota';

export type Contagem = { nome: string; total: number };

/** Quantos Itens têm cada Nota pessoal, de 1 a 10 (arredondada); Itens sem nota ficam de fora. */
export function distribuicaoDeNotas(itens: readonly { nota_usuario: number | null }[]): { nota: number; total: number }[] {
  const faixas = Array.from({ length: NOTA_MAXIMA }, (_, i) => ({ nota: i + 1, total: 0 }));
  for (const { nota_usuario } of itens) {
    if (nota_usuario === null) continue;
    const faixa = faixas[Math.round(nota_usuario) - 1];
    if (faixa) faixa.total += 1;
  }
  return faixas;
}

/**
 * Termos (Gêneros, plataformas) do mais frequente para o menos; no empate, ordem alfabética.
 * Cada Item conta uma vez por termo.
 */
export function maisFrequentes(termosPorItem: readonly (readonly string[])[], limite = Infinity): Contagem[] {
  const contagem = new Map<string, number>();
  for (const termos of termosPorItem) {
    for (const nome of new Set(termos.map((t) => t.trim()).filter(Boolean))) {
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    }
  }
  return [...contagem]
    .sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b, 'pt-BR'))
    .slice(0, limite)
    .map(([nome, total]) => ({ nome, total }));
}

/** Plataformas de um jogo, que a API manda em texto separado por vírgula ("PC, Switch"). */
export function plataformasDoItem({ plataformas }: { plataformas: string | null }): string[] {
  return (plataformas ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}
