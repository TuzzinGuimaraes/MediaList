// Filtros, Ordem e busca da Lista. Valem para todos os Status, e as contagens dos Status
// saem dos Itens já filtrados. O web usa também o Tipo, a Ordem padrão da Q120 e a direção
// (ticket 39); o app, as quatro Ordens antigas com a alfabética como padrão.
import { type EstadoConsumo, TIPOS, type TipoMidia } from './estadoConsumo';
import { itensDoEstado } from './itemLista';
import { tituloDaMidia } from './midia';
import { nomeDaSituacao, situacaoDe } from './situacao';

/**
 * Padrão da Q120 (anime/mangá pela Nota pessoal, jogo pelas horas), Nota pessoal, horas
 * (no anime/mangá, o Progresso), alfabética, adicionado e atualizado recentemente.
 */
export type OrdemLista = 'padrao' | 'nota' | 'horas' | 'titulo' | 'adicao' | 'atualizacao';

export const ORDENS_DA_LISTA: readonly OrdemLista[] = ['padrao', 'nota', 'horas', 'titulo', 'adicao', 'atualizacao'];

export type FiltrosLista = {
  /** Nome do gênero; null para todos. */
  genero: string | null;
  /** Status de lançamento ("finalizado", "em_exibicao"...); null para todos. */
  situacao: string | null;
  ordem: OrdemLista;
  /** Direção contrária à natural da Ordem (o ↑/↓ do web); ausente é a natural. */
  inversa?: boolean;
};

export const FILTROS_PADRAO: FiltrosLista = { genero: null, situacao: null, ordem: 'titulo' };

type ItemFiltravel = {
  id_lista: string;
  tipo: TipoMidia;
  titulo_ingles: string | null;
  titulo_romaji: string | null;
  titulo_original: string;
  generos_lista: string[];
  status_anime: string | null;
  status_manga: string | null;
  status_jogo: string | null;
  nota_usuario: number | null;
  /** Episódios, capítulos ou, em jogo, horas jogadas. */
  progresso_atual?: number | null;
  /** ISO 8601, como vem de GET /lista. */
  data_adicao?: string | null;
  data_atualizacao?: string | null;
};

const colacao = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/** Alfabética pelo título exibido, sem caixa nem acento; o id_lista desempata, como no backend. */
function alfabetica(a: ItemFiltravel, b: ItemFiltravel): number {
  return colacao.compare(tituloDaMidia(a), tituloDaMidia(b)) || (a.id_lista < b.id_lista ? -1 : a.id_lista > b.id_lista ? 1 : 0);
}

/** Instante da data ISO, para comparar; ausente ou ilegível é null (vai para o fim). */
function momento(data: string | null | undefined): number | null {
  const instante = data ? Date.parse(data) : NaN;
  return Number.isNaN(instante) ? null : instante;
}

type Comparar = (a: ItemFiltravel, b: ItemFiltravel, inversa: boolean) => number;

/** Do maior para o menor (ou o contrário, se inversa); sem valor fica no fim nas duas direções. */
function porNumero(chave: (i: ItemFiltravel) => number | null): Comparar {
  return (a, b, inversa) => {
    const [va, vb] = [chave(a), chave(b)];
    if (va === vb) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return inversa ? va - vb : vb - va;
  };
}

const porNota = porNumero((i) => i.nota_usuario);
// 0 h (ou 0 episódios) não é consumo de verdade: vai para o fim junto com os sem valor.
const porHoras = porNumero((i) => i.progresso_atual || null);
const ehJogo = (i: ItemFiltravel) => i.tipo === 'jogo';

/** Q120: jogos pelas horas, anime/mangá pela nota; entre Tipos, a nota decide e as horas desempatam. */
const porPadrao: Comparar = (a, b, inversa) => {
  if (ehJogo(a) && ehJogo(b)) return porHoras(a, b, inversa);
  if (!ehJogo(a) && !ehJogo(b)) return porNota(a, b, inversa);
  return porNota(a, b, inversa) || porHoras(a, b, inversa);
};

const COMPARAR: Record<OrdemLista, Comparar> = {
  padrao: porPadrao,
  nota: porNota,
  horas: porHoras,
  titulo: (a, b, inversa) => (inversa ? -1 : 1) * alfabetica(a, b),
  adicao: porNumero((i) => momento(i.data_adicao)),
  atualizacao: porNumero((i) => momento(i.data_atualizacao)),
};

/** Se a Ordem aponta do menor para o maior: a alfabética sobe, as outras descem; inversa troca. */
export function crescente(ordem: OrdemLista, inversa = false): boolean {
  return (ordem === 'titulo') !== inversa;
}

/** Os Itens que passam nos filtros, na Ordem e direção escolhidas (alfabética no empate). */
export function organizarLista<T extends ItemFiltravel>(itens: readonly T[], filtros: FiltrosLista): T[] {
  const comparar = COMPARAR[filtros.ordem];
  const inversa = filtros.inversa ?? false;
  return itens
    .filter(
      (i) =>
        (filtros.genero === null || i.generos_lista.includes(filtros.genero)) &&
        (filtros.situacao === null || situacaoDe(i) === filtros.situacao),
    )
    .sort((a, b) => comparar(a, b, inversa) || alfabetica(a, b));
}


/** Sem caixa e sem acentos latinos ("Pokémon" → "pokemon"). */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Busca da Lista: os Itens com o termo em algum dos títulos (inglês, romanizado ou original),
 * na ordem recebida. O termo é aparado; vazio acha tudo.
 */
export function buscarNaLista<T extends ItemFiltravel>(
  itens: readonly T[],
  termo: string,
): T[] {
  const busca = normalizar(termo.trim());
  if (!busca) return [...itens];
  return itens.filter((i) =>
    [i.titulo_ingles, i.titulo_romaji, i.titulo_original].some((t) => t && normalizar(t).includes(busca)),
  );
}


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
      .map((valor) => ({ valor, titulo: nomeDaSituacao(valor) }))
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

/** Gênero ou Situação que não existe no catálogo atual (ex.: depois de trocá-lo) volta a "todos". */
export function filtrosEfetivos(filtros: FiltrosLista, opcoes: OpcoesDosFiltros): FiltrosLista {
  return {
    ...filtros,
    genero: filtros.genero !== null && opcoes.generos.includes(filtros.genero) ? filtros.genero : null,
    situacao: opcoes.situacoes.some((s) => s.valor === filtros.situacao) ? filtros.situacao : null,
  };
}

/** Se os filtros tiram Itens (Gênero ou Situação escolhidos); a Ordem só reordena. */
export function filtrosRestringem(filtros: FiltrosLista): boolean {
  return filtros.genero !== null || filtros.situacao !== null;
}



// ---------------------------------------------------------------- Tipo e "Todos" (web, ticket 39)

/** O Tipo escolhido na coluna da Lista do web; "todos" junta os três. */
export type TipoDaLista = 'todos' | TipoMidia;

export function tiposDoFiltro(tipo: TipoDaLista): readonly TipoMidia[] {
  return tipo === 'todos' ? TIPOS : [tipo];
}

/** Os Itens do Tipo escolhido, na ordem recebida. */
export function doTipo<T extends { tipo: TipoMidia }>(itens: readonly T[], tipo: TipoDaLista): T[] {
  return tipo === 'todos' ? [...itens] : itens.filter((i) => i.tipo === tipo);
}

/** Quantos Itens há de cada Tipo e no total (as contagens do seletor de Tipo). */
export function contagemPorTipo(itens: readonly { tipo: TipoMidia }[]): Record<TipoDaLista, number> {
  const contagem: Record<TipoDaLista, number> = { todos: itens.length, anime: 0, manga: 0, jogo: 0 };
  for (const i of itens) contagem[i.tipo] += 1;
  return contagem;
}

/**
 * "Todos" separado por Status: uma seção por Status de `estados`, na ordem dada e sem as
 * vazias. Como nas contagens, o Concluído inclui os platinados, que por isso não têm seção
 * própria: cada Item aparece uma vez, e a soma das seções é o total.
 */
export function secoesPorStatus<T extends { tipo: TipoMidia; status_consumo: string }>(
  itens: readonly T[],
  estados: readonly EstadoConsumo[],
): { estado: EstadoConsumo; itens: T[] }[] {
  return estados
    .filter((estado) => estado !== 'platinado')
    .map((estado) => ({ estado, itens: itensDoEstado(itens, estado) }))
    .filter((s) => s.itens.length);
}

/** Os gêneros dos Itens, os mais frequentes primeiro (alfabética no empate): os chips mostram os primeiros. */
export function generosPorFrequencia(itens: readonly { generos_lista: string[] }[]): string[] {
  const contagem = new Map<string, number>();
  for (const i of itens) for (const g of i.generos_lista) contagem.set(g, (contagem.get(g) ?? 0) + 1);
  return [...contagem].sort((a, b) => b[1] - a[1] || colacao.compare(a[0], b[0])).map(([g]) => g);
}
