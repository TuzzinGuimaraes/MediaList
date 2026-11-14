// Filtros, Ordem e busca da aba Lista. Valem para todas as páginas de Status, e as
// contagens das abas saem dos Itens já filtrados.
import type { TipoMidia } from './estadoConsumo';
import { tituloDaMidia } from './midia';

/** Alfabética (padrão), Nota pessoal, adicionado recentemente, atualizado recentemente. */
export type OrdemLista = 'titulo' | 'nota' | 'adicao' | 'atualizacao';

export type FiltrosLista = {
  /** Nome do gênero; null para todos. */
  genero: string | null;
  /** Status de lançamento ("finalizado", "em_exibicao"...); null para todos. */
  situacao: string | null;
  ordem: OrdemLista;
};

export const FILTROS_PADRAO: FiltrosLista = { genero: null, situacao: null, ordem: 'titulo' };

type ItemFiltravel = {
  id_lista: string;
  tipo: TipoMidia;
  titulo_portugues: string | null;
  titulo_original: string;
  generos_lista: string[];
  status_anime: string | null;
  status_manga: string | null;
  status_jogo: string | null;
  nota_usuario: number | null;
  /** ISO 8601, como vem de GET /lista. */
  data_adicao?: string | null;
  data_atualizacao?: string | null;
};

/** Status de lançamento do Item, lido do campo do seu Tipo. */
export function situacaoDe(item: Pick<ItemFiltravel, 'tipo' | 'status_anime' | 'status_manga' | 'status_jogo'>): string | null {
  const porTipo: Record<TipoMidia, string | null> = {
    anime: item.status_anime,
    manga: item.status_manga,
    jogo: item.status_jogo,
  };
  return porTipo[item.tipo] ?? null;
}

const colacao = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/** Alfabética pelo título exibido, sem caixa nem acento; o id_lista desempata, como no backend. */
function alfabetica(a: ItemFiltravel, b: ItemFiltravel): number {
  return colacao.compare(tituloDaMidia(a), tituloDaMidia(b)) || (a.id_lista < b.id_lista ? -1 : a.id_lista > b.id_lista ? 1 : 0);
}

/** Maior primeiro; sem valor vai para o fim. */
function decrescente(valor: (i: ItemFiltravel) => number | null) {
  return (a: ItemFiltravel, b: ItemFiltravel) => (valor(b) ?? -Infinity) - (valor(a) ?? -Infinity);
}

const momento = (data: string | null | undefined) => (data ? Date.parse(data) : null);

const COMPARAR: Record<OrdemLista, (a: ItemFiltravel, b: ItemFiltravel) => number> = {
  titulo: alfabetica,
  nota: decrescente((i) => i.nota_usuario),
  adicao: decrescente((i) => momento(i.data_adicao)),
  atualizacao: decrescente((i) => momento(i.data_atualizacao)),
};

/** Os Itens que passam nos filtros, na Ordem escolhida (alfabética no empate). */
export function organizarLista<T extends ItemFiltravel>(itens: readonly T[], filtros: FiltrosLista): T[] {
  const comparar = COMPARAR[filtros.ordem];
  return itens
    .filter(
      (i) =>
        (filtros.genero === null || i.generos_lista.includes(filtros.genero)) &&
        (filtros.situacao === null || situacaoDe(i) === filtros.situacao),
    )
    .sort((a, b) => comparar(a, b) || alfabetica(a, b));
}


/** Sem caixa e sem acentos latinos ("Pokémon" → "pokemon"). */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Busca da Lista: os Itens com o termo em algum dos títulos (português, original ou inglês),
 * na ordem recebida. O termo é aparado; vazio acha tudo.
 */
export function buscarNaLista<T extends ItemFiltravel & { titulo_ingles?: string | null }>(
  itens: readonly T[],
  termo: string,
): T[] {
  const busca = normalizar(termo.trim());
  if (!busca) return [...itens];
  return itens.filter((i) =>
    [i.titulo_portugues, i.titulo_original, i.titulo_ingles].some((t) => t && normalizar(t).includes(busca)),
  );
}


/** Nomes na tela dos status de lançamento (CHECKs de anime, mangá e jogo no banco). */
const NOMES_SITUACAO: Record<string, string> = {
  em_exibicao: 'Em exibição',
  em_publicacao: 'Em publicação',
  finalizado: 'Finalizado',
  aguardando: 'Aguardando',
  hiato: 'Em hiato',
  cancelado: 'Cancelado',
  lancado: 'Lançado',
  em_desenvolvimento: 'Em desenvolvimento',
  remasterizado: 'Remasterizado',
};

export type OpcoesDosFiltros = {
  generos: string[];
  situacoes: { valor: string; titulo: string }[];
};

/** Os gêneros e as Situações que existem nos Itens, para o sheet não oferecer filtro vazio. */
export function opcoesDosFiltros(itens: readonly ItemFiltravel[]): OpcoesDosFiltros {
  const generos = new Set(itens.flatMap((i) => i.generos_lista));
  const situacoes = new Set(itens.map(situacaoDe).filter((s): s is string => s !== null));
  return {
    generos: [...generos].sort(colacao.compare),
    situacoes: [...situacoes]
      .map((valor) => ({ valor, titulo: NOMES_SITUACAO[valor] ?? valor }))
      .sort((a, b) => colacao.compare(a.titulo, b.titulo)),
  };
}

/** Quantos filtros estão fora do padrão (o contador do botão de filtros). */
export function filtrosAtivos(filtros: FiltrosLista): number {
  return (Object.keys(FILTROS_PADRAO) as (keyof FiltrosLista)[]).filter((k) => filtros[k] !== FILTROS_PADRAO[k]).length;
}


/**
 * Subseções "Anime · N" e "Mangá · N" de uma página, na ordem do catálogo, sem as vazias.
 * Catálogo de um Tipo só (Jogos) devolve um grupo sem Tipo: a página não tem subseção.
 */
export function porTipo<T extends { tipo: TipoMidia }>(
  itens: readonly T[],
  tipos: readonly TipoMidia[],
): { tipo: TipoMidia | null; itens: T[] }[] {
  if (tipos.length < 2) return [{ tipo: null, itens: [...itens] }];
  return tipos.map((tipo) => ({ tipo, itens: itens.filter((i) => i.tipo === tipo) })).filter((s) => s.itens.length);
}
