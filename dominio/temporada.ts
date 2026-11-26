// Temporada de anime (ticket 49 da revisão): a atual, a anterior e a próxima, o seletor, o rótulo,
// as seções da página e o selo de estimativa. A divisão é a do AniList (inverno é janeiro–março,
// primavera abril–junho, verão julho–setembro, outono outubro–dezembro); `agora` entra de fora.

import type { Midia } from './tipos';

export type Estacao = NonNullable<Midia['temporada_estacao']>;
export type Temporada = { estacao: Estacao; ano: number };

/** As estações na ordem do ano. */
export const ESTACOES: readonly Estacao[] = ['inverno', 'primavera', 'verao', 'outono'];

/** Até quantas Temporadas depois da atual o seletor vai (as que a Importação traz inteiras: `TEMPORADAS` de
 * `Backend/importacao/anilist.py`, que conta também a atual). */
export const TEMPORADAS_A_FRENTE = 4;

/** O nome de cada estação na tela. */
export const NOMES_DA_ESTACAO: Record<Estacao, string> = { inverno: 'Inverno', primavera: 'Primavera', verao: 'Verão', outono: 'Outono' };

/** Formatos que vão para "Filmes e especiais"; os outros (TV, TV curto, ONA, desconhecido), na grade. */
const FORA_DA_GRADE = new Set<Midia['formato']>(['MOVIE', 'SPECIAL', 'OVA', 'MUSIC']);

export const TITULO_FILMES_E_ESPECIAIS = 'Filmes e especiais';

/** O selo do cartão de anime com Temporada estimada e a explicação (ao passar o mouse ou tocar). */
export const SELO_DE_ESTIMATIVA = { texto: 'temporada estimada', explicacao: 'pela data de estreia; pode estar errada' };

/** A estação na posição `i` do ano; `i` é sempre de 0 a 3. */
function estacaoNa(i: number): Estacao {
  return ESTACOES[i] as Estacao;
}

/** A Temporada de uma data (no fuso de quem chama). */
export function temporadaDe(data: Date): Temporada {
  return { estacao: estacaoNa(Math.floor(data.getMonth() / 3)), ano: data.getFullYear() };
}

/** A posição da Temporada numa contagem corrida (4 por ano), para andar e comparar. */
function indice(temporada: Temporada): number {
  return temporada.ano * ESTACOES.length + ESTACOES.indexOf(temporada.estacao);
}

function deIndice(i: number): Temporada {
  const n = ESTACOES.length;
  return { estacao: estacaoNa(((i % n) + n) % n), ano: Math.floor(i / n) };
}

/** A Temporada `passos` à frente (negativo: para trás). */
export function andar(temporada: Temporada, passos: number): Temporada {
  return deIndice(indice(temporada) + passos);
}

export function anterior(temporada: Temporada): Temporada {
  return andar(temporada, -1);
}

export function proxima(temporada: Temporada): Temporada {
  return andar(temporada, 1);
}

export function mesmaTemporada(a: Temporada, b: Temporada): boolean {
  return indice(a) === indice(b);
}

/**
 * As Temporadas do seletor, da mais antiga do Catálogo até 4 depois da atual, em ordem. Sem a mais
 * antiga (Catálogo sem Temporada) ou com ela depois da atual, começa na atual.
 */
export function temporadasDoSeletor(maisAntiga: Temporada | null, agora: Date): Temporada[] {
  const atual = indice(temporadaDe(agora));
  const inicio = maisAntiga ? Math.min(indice(maisAntiga), atual) : atual;
  const fim = atual + TEMPORADAS_A_FRENTE;
  return Array.from({ length: fim - inicio + 1 }, (_, i) => deIndice(inicio + i));
}

/** "Inverno 2027": o nome da Temporada e o ano, sem os meses. */
export function rotuloDaTemporada(temporada: Temporada): string {
  return `${NOMES_DA_ESTACAO[temporada.estacao]} ${temporada.ano}`;
}

/**
 * As seções da página, na ordem em que os animes vieram: a grade principal (séries: TV, TV curto,
 * ONA e formato desconhecido) e "Filmes e especiais" (filmes, especiais, OVAs e clipes).
 */
export function secoesDaTemporada<T extends Pick<Midia, 'formato'>>(
  animes: readonly T[],
): { principal: T[]; filmesEEspeciais: T[] } {
  const principal: T[] = [];
  const filmesEEspeciais: T[] = [];
  for (const anime of animes) (FORA_DA_GRADE.has(anime.formato) ? filmesEEspeciais : principal).push(anime);
  return { principal, filmesEEspeciais };
}

/** O selo de estimativa do cartão, ou null quando a Temporada veio do AniList. */
export function seloDeEstimativa(anime: Pick<Midia, 'temporada_estimada'>): typeof SELO_DE_ESTIMATIVA | null {
  return anime.temporada_estimada ? SELO_DE_ESTIMATIVA : null;
}
