// Regras do Início que não dependem da tela.

import type { TipoMidia } from './estadoConsumo';

/** Quantos carrosséis "Porque você curte <gênero>" o Início mostra, no máximo. */
export const MAX_GENEROS_CURTIDOS = 2;

/** Gêneros em texto, como a API manda ("Ação, Drama"); null sem gênero. */
type ComGeneros = { generos: string | null };

/** Gêneros do mais frequente para o menos; no empate, ordem alfabética. */
function maisFrequentes(midias: ComGeneros[], limite: number): string[] {
  const contagem = new Map<string, number>();
  for (const { generos } of midias) {
    for (const genero of generos?.split(',') ?? []) {
      const nome = genero.trim();
      if (nome) contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    }
  }
  return [...contagem]
    .sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b, 'pt-BR'))
    .slice(0, limite)
    .map(([nome]) => nome);
}

/**
 * Gêneros dos carrosséis "Porque você curte <gênero>": os mais frequentes nos Itens da Lista;
 * sem Lista (ou sem gênero nela), os mais frequentes entre as Mídias populares.
 */
export function generosQueVoceCurte(
  lista: ComGeneros[],
  populares: ComGeneros[],
  limite = MAX_GENEROS_CURTIDOS,
): string[] {
  const daLista = maisFrequentes(lista, limite);
  return daLista.length ? daLista : maisFrequentes(populares, limite);
}

const VERBO_DO_TIPO: Record<TipoMidia, string> = {
  anime: 'Mais assistidos',
  manga: 'Mais lidos',
  jogo: 'Mais jogados',
};

/**
 * Título do carrossel de "mais concluídos" (ordem `mais_concluidos`). Com um Tipo só, o verbo
 * dele; com Anime e Mangá juntos, nenhum dos dois verbos serve e fica "Mais concluídos",
 * do Status Concluído.
 */
export function rotuloMaisConcluidos(tipos: readonly TipoMidia[]): string {
  return tipos.length === 1 ? VERBO_DO_TIPO[tipos[0]] : 'Mais concluídos';
}


const dois = (n: number) => String(n).padStart(2, '0');

/** As Mídias já lançadas até `hoje` (dia do aparelho); data futura ou ausente fica de fora. */
export function jaLancadas<M extends { data_lancamento: string | null }>(midias: M[], hoje = new Date()): M[] {
  const limite = `${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-${dois(hoje.getDate())}`;
  return midias.filter((m) => m.data_lancamento !== null && m.data_lancamento.slice(0, 10) <= limite);
}
