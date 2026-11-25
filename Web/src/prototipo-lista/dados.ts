// PROTÓTIPO (ticket 39): Itens de Lista fixos (dados.json, de gerar_dados.py) e as regras
// de Ordem, filtros e agrupamento que as variantes compartilham. Nada persiste.
import { type EstadoConsumo, estadoDe, eTerminal, NOMES_ESTADO, type TipoMidia } from '@dominio/estadoConsumo';
import { estadosDaLista, proporcaoDoFio, totalDoItem } from '@dominio/itemLista';
import { tituloDaMidia } from '@dominio/midia';
import { nomeDaSituacao, situacaoDe } from '@dominio/situacao';

import bruto from './dados.json';

export type Item = {
  id_lista: string;
  id_midia: string;
  tipo: TipoMidia;
  titulo_original: string;
  titulo_ingles: string | null;
  titulo_portugues: string | null;
  poster_url: string | null;
  banner_url: string | null;
  generos_lista: string[];
  status_anime: string | null;
  status_manga: string | null;
  status_jogo: string | null;
  numero_episodios: number | null;
  numero_capitulos: number | null;
  data_lancamento: string | null;
  nota_fonte: number | null;
  estudio: string | null;
  autor: string | null;
  desenvolvedor: string | null;
  status_consumo: string;
  /** Episódios, capítulos ou, em jogo, horas jogadas. */
  progresso_atual: number | null;
  nota_usuario: number | null;
  favorito: boolean;
  recontagem: number;
  data_adicao: string;
  data_atualizacao: string;
};

export const ITENS = bruto as Item[];

export const titulo = (i: Item) => tituloDaMidia(i);
export const estado = (i: Item) => estadoDe(i.status_consumo, i.tipo) ?? 'planejado';
export const total = (i: Item) => totalDoItem(i);
export const fio = (i: Item) => proporcaoDoFio(i);
export const situacao = (i: Item) => situacaoDe(i);
export const ehJogo = (i: Item) => i.tipo === 'jogo';
export const autoria = (i: Item) => i.desenvolvedor ?? i.estudio ?? i.autor ?? null;
export const ano = (i: Item) => (i.data_lancamento ? i.data_lancamento.slice(0, 4) : null);

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
/** "2,5", "142", "1.020". */
export const formatarNumero = (n: number) => numero.format(n);
export const formatarHoras = (h: number | null) => (h === null ? '—' : `${formatarNumero(h)} h`);
export const formatarNota = (n: number | null) => (n === null ? '—' : formatarNumero(n));

const relativo = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto', style: 'short' });
/** Referência fixa: a data em que os dados foram gerados. */
const AGORA = Date.parse('2026-11-24T20:00:00Z');
export function haQuanto(iso: string): string {
  const dias = Math.round((Date.parse(iso) - AGORA) / 86_400_000);
  if (dias > -1) return 'hoje';
  if (dias > -30) return relativo.format(dias, 'day');
  if (dias > -365) return relativo.format(Math.round(dias / 30), 'month');
  return relativo.format(Math.round(dias / 365), 'year');
}

export function textoConsumo(i: Item): string {
  if (ehJogo(i)) return formatarHoras(i.progresso_atual);
  const t = total(i);
  return t !== null ? `${i.progresso_atual ?? 0}/${t}` : `${i.progresso_atual ?? 0}`;
}

export const UNIDADE: Record<TipoMidia, string> = { anime: 'ep', manga: 'cap', jogo: 'h' };

// ---------------------------------------------------------------- Ordem

export type Ordem = 'padrao' | 'nota' | 'consumo' | 'titulo' | 'adicao' | 'atualizacao';
export type TipoFiltro = 'todos' | TipoMidia;

export function nomeDaOrdem(o: Ordem, tipo: TipoFiltro): string {
  const consumo = tipo === 'jogo' ? 'Mais horas' : tipo === 'todos' ? 'Mais horas / Progresso' : 'Mais Progresso';
  const padrao = tipo === 'jogo' ? 'Padrão (mais horas)' : tipo === 'todos' ? 'Padrão (nota; horas nos jogos)' : 'Padrão (maior nota)';
  return { padrao, nota: 'Maior nota pessoal', consumo, titulo: 'Título (A–Z)', adicao: 'Adicionado recentemente', atualizacao: 'Atualizado recentemente' }[o];
}
export const ORDENS: Ordem[] = ['padrao', 'nota', 'consumo', 'titulo', 'adicao', 'atualizacao'];

const colacao = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const alfabetica = (a: Item, b: Item) => colacao.compare(titulo(a), titulo(b));

function decrescente(chave: (i: Item) => number | null) {
  return (a: Item, b: Item) => {
    const [va, vb] = [chave(a), chave(b)];
    if (va === vb) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va;
  };
}
const porNota = decrescente((i) => i.nota_usuario);
// Planejado com 0 h ou 0 episódios não tem horas/Progresso de verdade: vai para o fim.
const porConsumo = decrescente((i) => (i.progresso_atual ? i.progresso_atual : null));
/**
 * Padrão da Q120: anime e mangá pela maior Nota pessoal, jogos pelas mais horas; empate
 * alfabético; sem nota/horas no fim. Num grupo que mistura Tipos, a nota decide e as horas
 * desempatam entre jogos.
 */
const porPadrao = (a: Item, b: Item) => {
  if (ehJogo(a) && ehJogo(b)) return porConsumo(a, b);
  if (!ehJogo(a) && !ehJogo(b)) return porNota(a, b);
  return porNota(a, b) || porConsumo(a, b);
};
const COMPARAR: Record<Ordem, (a: Item, b: Item) => number> = {
  padrao: porPadrao,
  nota: porNota,
  consumo: porConsumo,
  titulo: () => 0,
  adicao: (a, b) => Date.parse(b.data_adicao) - Date.parse(a.data_adicao),
  atualizacao: (a, b) => Date.parse(b.data_atualizacao) - Date.parse(a.data_atualizacao),
};

// ---------------------------------------------------------------- filtros

export type Filtros = {
  busca: string;
  tipo: TipoFiltro;
  genero: string | null;
  situacao: string | null;
  ordem: Ordem;
  /** Variante F: Status marcados nos chips (vazio = todos). */
  status: EstadoConsumo[];
  /** Índice A–Z: inicial escolhida. */
  letra: string | null;
};

/** Quantos filtros restringem (Gênero, Situação): o contador do botão. */
export const ativos = (f: Filtros) => Number(f.genero !== null) + Number(f.situacao !== null);

function normalizar(t: string) {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Inicial para o índice A–Z: letra sem acento ou "#". */
export function inicial(i: Item): string {
  const c = normalizar(titulo(i).trim()).charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
}

/** Tudo menos a letra (para o índice saber quais iniciais existem) e menos os chips de Status. */
export function filtrarBase(itens: readonly Item[], f: Filtros): Item[] {
  const busca = normalizar(f.busca.trim());
  return itens.filter(
    (i) =>
      (f.tipo === 'todos' || i.tipo === f.tipo) &&
      (f.genero === null || i.generos_lista.includes(f.genero)) &&
      (f.situacao === null || situacao(i) === f.situacao) &&
      (!busca || [i.titulo_portugues, i.titulo_original, i.titulo_ingles].some((t) => t && normalizar(t).includes(busca))),
  );
}

export function organizar(itens: readonly Item[], f: Filtros): Item[] {
  const comparar = COMPARAR[f.ordem];
  return filtrarBase(itens, f)
    .filter((i) => f.letra === null || inicial(i) === f.letra)
    .sort((a, b) => comparar(a, b) || alfabetica(a, b) || (a.id_lista < b.id_lista ? -1 : 1));
}

export function opcoes(itens: readonly Item[], tipo: TipoFiltro) {
  const doTipo = itens.filter((i) => tipo === 'todos' || i.tipo === tipo);
  const contagem = new Map<string, number>();
  for (const i of doTipo) for (const g of i.generos_lista) contagem.set(g, (contagem.get(g) ?? 0) + 1);
  const situacoes = new Set(doTipo.map(situacao).filter((s): s is string => s !== null));
  return {
    /** Mais frequentes primeiro: os chips mostram os primeiros. */
    generos: [...contagem].sort((a, b) => b[1] - a[1] || colacao.compare(a[0], b[0])).map(([g]) => g),
    situacoes: [...situacoes].map((valor) => ({ valor, titulo: nomeDaSituacao(valor) })),
  };
}

// ---------------------------------------------------------------- agrupamento

export const TIPOS_DO_FILTRO = (t: TipoFiltro): TipoMidia[] => (t === 'todos' ? ['anime', 'manga', 'jogo'] : [t]);
export const estadosDe = (t: TipoFiltro) => estadosDaLista(TIPOS_DO_FILTRO(t));

/** O Item está na seção do Status? Concluído inclui os platinados (regra de hoje). */
export function noEstado(i: Item, e: EstadoConsumo): boolean {
  const doItem = estado(i);
  return doItem === e || (e === 'concluido' && eTerminal(doItem));
}

export function contar(itens: readonly Item[]): Record<EstadoConsumo, number> {
  const c = { planejado: 0, em_progresso: 0, pausado: 0, abandonado: 0, concluido: 0, platinado: 0 };
  for (const i of itens) {
    const e = estado(i);
    c[e] += 1;
    if (e === 'platinado') c.concluido += 1;
  }
  return c;
}

export const NOME_SUBSECAO: Record<TipoMidia, string> = { anime: 'Anime', manga: 'Mangá', jogo: 'Jogos' };

/** Subseções por Tipo, só com "Todos" (Q120); um Tipo escolhido dá um grupo sem título. */
export function porTipo(itens: Item[], t: TipoFiltro): { tipo: TipoMidia | null; itens: Item[] }[] {
  if (t !== 'todos') return [{ tipo: null, itens }];
  return (['anime', 'manga', 'jogo'] as const)
    .map((tipo) => ({ tipo, itens: itens.filter((i) => i.tipo === tipo) }))
    .filter((g) => g.itens.length);
}

export { NOMES_ESTADO };
