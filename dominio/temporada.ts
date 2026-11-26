// Temporada de anime (ticket 49 da revisão): a atual, a anterior e a próxima, o seletor, o rótulo,
// a busca (ordens, paginação e a Temporada dos parâmetros da URL), as seções da página e o selo de
// estimativa. A divisão é a do AniList (inverno é janeiro–março,
// primavera abril–junho, verão julho–setembro, outono outubro–dezembro); `agora` entra de fora.

import type { ConsultaMidias, Midia } from './tipos';

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

/** As ordens da página da Temporada (valores de `ordem` em GET /midias). */
export type OrdemTemporada = Extract<NonNullable<ConsultaMidias['ordem']>, 'popularidade_fonte' | 'estreia' | 'nota_fonte'>;

/** As ordens da página, com o nome na tela; a primeira é a padrão. */
export const ORDENS_DA_TEMPORADA: readonly { valor: OrdemTemporada; rotulo: string }[] = [
  { valor: 'popularidade_fonte', rotulo: 'Mais esperados' },
  { valor: 'estreia', rotulo: 'Estreia' },
  { valor: 'nota_fonte', rotulo: 'Nota da fonte' },
];

export const ORDEM_PADRAO_DA_TEMPORADA: OrdemTemporada = 'popularidade_fonte';

/** A ordem de um parâmetro da URL; desconhecida ou ausente, a padrão. */
export function ordemDaTemporada(valor: unknown): OrdemTemporada {
  return ORDENS_DA_TEMPORADA.find((o) => o.valor === valor)?.valor ?? ORDEM_PADRAO_DA_TEMPORADA;
}

/** Faixa de ano aceita nos parâmetros da URL (o primeiro anime é de 1917). */
const ANO_MINIMO = 1900;
const ANO_MAXIMO = 9999;

/** Número ou texto de 4 dígitos, dentro da faixa; senão, null. */
function anoDoParametro(valor: unknown): number | null {
  const ano = typeof valor === 'number' ? valor : typeof valor === 'string' && /^\d{4}$/.test(valor) ? Number(valor) : NaN;
  return Number.isInteger(ano) && ano >= ANO_MINIMO && ano <= ANO_MAXIMO ? ano : null;
}

/** A Temporada dos parâmetros da URL, se a estação e o ano vierem juntos e válidos; senão, null. */
export function lerTemporada(parametros: { estacao?: unknown; ano?: unknown }): Temporada | null {
  const estacao = ESTACOES.find((e) => e === parametros.estacao);
  const ano = anoDoParametro(parametros.ano);
  return estacao && ano !== null ? { estacao, ano } : null;
}

/** A Temporada dos parâmetros da URL; inválida ou ausente, a atual. */
export function temporadaDosParametros(parametros: { estacao?: unknown; ano?: unknown }, agora: Date): Temporada {
  return lerTemporada(parametros) ?? temporadaDe(agora);
}

/** O máximo da API por página: a Temporada vem inteira, página por página. */
export const POR_PAGINA_DA_TEMPORADA = 50;
/** Teto de páginas por Temporada (as maiores têm ~150 animes): protege de um `total` errado. */
export const MAX_PAGINAS_DA_TEMPORADA = 10;

/** A query de uma página de GET /midias para a Temporada. */
export function consultaDaTemporada(temporada: Temporada, ordem: OrdemTemporada, pagina: number) {
  return {
    tipo: 'anime',
    temporada_estacao: temporada.estacao,
    temporada_ano: temporada.ano,
    ordem,
    pagina,
    por_pagina: POR_PAGINA_DA_TEMPORADA,
  } satisfies ConsultaMidias;
}

type PaginaDaApi<T> = { itens: readonly T[]; pagina: number; por_pagina: number; total: number };

/**
 * Todos os animes de uma Temporada, juntando as páginas que `buscar` traz (`buscar(n)` pede a página
 * `n` com `consultaDaTemporada`). Para na página vazia, na que alcança o `total` ou no teto de
 * páginas. As seções (séries e "Filmes e especiais") só saem certas com a Temporada inteira.
 */
export async function animesDaTemporada<T>(buscar: (pagina: number) => Promise<PaginaDaApi<T>>): Promise<T[]> {
  const animes: T[] = [];
  for (let numero = 1; numero <= MAX_PAGINAS_DA_TEMPORADA; numero++) {
    const pagina = await buscar(numero);
    animes.push(...pagina.itens);
    if (!pagina.itens.length || pagina.pagina * pagina.por_pagina >= pagina.total) break;
  }
  return animes;
}
