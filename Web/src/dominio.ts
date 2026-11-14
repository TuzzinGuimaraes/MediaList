// PROTÓTIPO: recorte mínimo de Mobile/src/dominio (Q60 move essa pasta para `dominio/` na raiz).
// Só o que as telas do protótipo leem; o backend segue autoritativo.
import type { components } from '../../contrato/api';

type S = components['schemas'];
export type Midia = S['Midia'];
export type MidiaDetalhe = S['MidiaDetalhe'];
export type ItemLista = S['ItemLista'];
export type MidiaPopular = S['MidiaPopular'];
export type Avaliacao = S['AvaliacaoDaMidia'];
export type TipoMidia = Midia['tipo'];

/** O mínimo para um card: Populares traz menos campos que Em alta e a Lista. */
export type CartaoMidia = Pick<
  Midia,
  'id_midia' | 'tipo' | 'titulo_portugues' | 'titulo_original' | 'poster_url' | 'nota_media' | 'nota_fonte' | 'origem_nota'
> &
  Partial<Pick<Midia, 'banner_url' | 'status_anime' | 'status_manga' | 'status_jogo' | 'generos_lista' | 'sinopse'>>;

export type EstadoConsumo = 'planejado' | 'em_progresso' | 'pausado' | 'abandonado' | 'concluido' | 'platinado';

export const NOMES_TIPO: Record<TipoMidia, string> = { anime: 'Anime', manga: 'Mangá', jogo: 'Jogo' };
const RECONTAGEM: Record<TipoMidia, string> = { anime: 'Reassistido', manga: 'Relido', jogo: 'Rejogado' };
export const UNIDADE: Record<TipoMidia, string> = { anime: 'Episódios', manga: 'Capítulos', jogo: 'Horas jogadas' };
export const MAIS_CONCLUIDOS: Record<TipoMidia, string> = { anime: 'Mais assistidos', manga: 'Mais lidos', jogo: 'Mais jogados' };

export const NOMES_ESTADO: Record<EstadoConsumo, string> = {
  planejado: 'Planejado',
  em_progresso: 'Em progresso',
  pausado: 'Pausado',
  abandonado: 'Abandonado',
  concluido: 'Concluído',
  platinado: 'Platinado',
};

/** Rótulos curtos das abas. */
export const ABREVIADO: Record<EstadoConsumo, string> = {
  em_progresso: 'Em progr.',
  planejado: 'Planej.',
  pausado: 'Pausado',
  abandonado: 'Aband.',
  concluido: 'Concluído',
  platinado: 'Platin.',
};

export const COR_DO_ESTADO: Record<EstadoConsumo, string> = {
  em_progresso: 'var(--cor-status-progresso)',
  concluido: 'var(--cor-status-concluido)',
  pausado: 'var(--cor-status-pausado)',
  abandonado: 'var(--cor-status-abandonado)',
  planejado: 'var(--cor-status-planejado)',
  platinado: 'var(--cor-status-platinado)',
};

const ESTADOS: EstadoConsumo[] = ['planejado', 'em_progresso', 'pausado', 'abandonado', 'concluido', 'platinado'];
export const ORDEM_ABAS: EstadoConsumo[] = ['em_progresso', 'planejado', 'pausado', 'abandonado', 'concluido', 'platinado'];

export const ROTULOS: Record<TipoMidia, Partial<Record<EstadoConsumo, string>>> = {
  anime: { planejado: 'planejado', em_progresso: 'assistindo', pausado: 'pausado', abandonado: 'abandonado', concluido: 'completo' },
  manga: { planejado: 'planejado', em_progresso: 'lendo', pausado: 'pausado', abandonado: 'abandonado', concluido: 'lido' },
  jogo: {
    planejado: 'na_fila',
    em_progresso: 'jogando',
    pausado: 'pausado',
    abandonado: 'abandonado',
    concluido: 'zerado',
    platinado: 'platinado',
  },
};

export function estadoDe(rotulo: string | null | undefined, tipo: TipoMidia): EstadoConsumo | null {
  return ESTADOS.find((e) => ROTULOS[tipo][e] === rotulo) ?? null;
}

export function estadosDoTipo(tipo: TipoMidia): EstadoConsumo[] {
  return ESTADOS.filter((e) => ROTULOS[tipo][e]);
}

export const terminal = (e: EstadoConsumo | null) => e === 'concluido' || e === 'platinado';

export function recontagem(item: ItemLista): string | null {
  return item.total_rewatches ? `${RECONTAGEM[item.tipo]} ${item.total_rewatches}×` : null;
}

export const tituloDe = (m: Pick<Midia, 'titulo_portugues' | 'titulo_original'>) => m.titulo_portugues || m.titulo_original;

export function tituloAlternativo(m: Pick<Midia, 'titulo_portugues' | 'titulo_original' | 'titulo_ingles'>): string | null {
  const p = tituloDe(m);
  return [m.titulo_original, m.titulo_ingles].find((t) => t && t !== p) ?? null;
}

export type NotaExibida = { rotulo: string; curto: string; valor: string };

export function notasDe(m: Pick<Midia, 'nota_media' | 'nota_fonte' | 'origem_nota'>): NotaExibida[] {
  const notas: NotaExibida[] = [];
  if (m.nota_media != null) notas.push({ rotulo: 'Nota dos Usuários', curto: 'Usuários', valor: m.nota_media.toFixed(1) });
  if (m.nota_fonte != null) {
    const f = m.origem_nota;
    notas.push({ rotulo: f ? `Nota ${f}` : 'Nota da fonte', curto: f ?? 'Fonte', valor: m.nota_fonte.toFixed(1) });
  }
  return notas;
}

export const notaDeRanking = (m: Pick<Midia, 'nota_media' | 'nota_fonte'>) => m.nota_media ?? m.nota_fonte ?? null;

// ---------------------------------------------------------------- Situação

type ComSituacao = Pick<CartaoMidia, 'tipo' | 'status_anime' | 'status_manga' | 'status_jogo'>;

export function situacaoDe(m: ComSituacao): string | null {
  return { anime: m.status_anime, manga: m.status_manga, jogo: m.status_jogo }[m.tipo] ?? null;
}

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
export const nomeDaSituacao = (s: string) => NOMES_SITUACAO[s] ?? s;

export function emLancamento(m: ComSituacao): string | null {
  const s = situacaoDe(m);
  return s === 'em_exibicao' || s === 'em_publicacao' ? nomeDaSituacao(s) : null;
}

/** Atributos da ficha, por Tipo; "Situação" é o status de lançamento. */
export function atributosDe(m: Midia): [string, string][] {
  const s = situacaoDe(m);
  const situacao = s ? nomeDaSituacao(s) : null;
  const porTipo: Record<TipoMidia, [string, string | number | null][]> = {
    anime: [
      ['Episódios', m.numero_episodios],
      ['Duração', m.duracao_episodio ? `${m.duracao_episodio} min` : null],
      ['Situação', situacao],
      ['Estúdio', m.estudio],
      ['Fonte', m.fonte_original],
    ],
    manga: [
      ['Capítulos', m.numero_capitulos],
      ['Volumes', m.numero_volumes],
      ['Situação', situacao],
      ['Autor', m.autor],
      ['Demografia', m.demografia],
    ],
    jogo: [
      ['Plataformas', m.plataformas],
      ['Situação', situacao],
      ['Desenvolvedor', m.desenvolvedor],
      ['Publicadora', m.publicadora],
    ],
  };
  const comuns: [string, string | number | null][] = [['Lançamento', m.data_lancamento ? formatarData(m.data_lancamento) : null]];
  return [...porTipo[m.tipo], ...comuns]
    .filter(([, v]) => v != null && v !== '')
    .map(([r, v]) => [r, String(v)]);
}

export function formatarData(iso: string): string {
  const [a, mes, d] = iso.slice(0, 10).split('-');
  return `${d}/${mes}/${a}`;
}

// ---------------------------------------------------------------- Item de lista

export const temProgresso = (tipo: TipoMidia) => tipo !== 'jogo';

export function totalDoItem(i: Pick<ItemLista, 'tipo' | 'progresso_total' | 'numero_episodios' | 'numero_capitulos'>): number | null {
  if (!temProgresso(i.tipo)) return null;
  return i.progresso_total ?? (i.tipo === 'anime' ? i.numero_episodios : i.numero_capitulos) ?? null;
}

export function passo(i: ItemLista, delta: 1 | -1): number | null {
  if (!temProgresso(i.tipo)) return null;
  const novo = (i.progresso_atual ?? 0) + delta;
  const total = totalDoItem(i);
  return novo < 0 || (total !== null && novo > total) ? null : novo;
}

/** Proporção do fio de progresso; null sem total (traço curto). */
export function proporcaoDoFio(i: ItemLista): number | null {
  if (terminal(estadoDe(i.status_consumo, i.tipo))) return 1;
  const total = totalDoItem(i);
  return total ? Math.min(1, (i.progresso_atual ?? 0) / total) : null;
}

export function itensDoEstado(itens: ItemLista[], estado: EstadoConsumo): ItemLista[] {
  return itens.filter((i) => {
    const e = estadoDe(i.status_consumo, i.tipo);
    return e === estado || (estado === 'concluido' && e === 'platinado');
  });
}

// ---------------------------------------------------------------- filtros da Lista (Resolution do 34)

export type OrdemLista = 'titulo' | 'nota' | 'adicao' | 'atualizacao';
export const NOMES_ORDEM: Record<OrdemLista, string> = {
  titulo: 'Alfabética',
  nota: 'Nota pessoal',
  adicao: 'Adicionado recentemente',
  atualizacao: 'Atualizado recentemente',
};
export type FiltrosLista = { genero: string | null; situacao: string | null; ordem: OrdemLista };
export const FILTROS_PADRAO: FiltrosLista = { genero: null, situacao: null, ordem: 'titulo' };

const colacao = new Intl.Collator('pt-BR', { sensitivity: 'base' });
const desc = (a: number | null, b: number | null) => (b ?? -Infinity) - (a ?? -Infinity);

export function organizarLista(itens: ItemLista[], f: FiltrosLista): ItemLista[] {
  const cmp: Record<OrdemLista, (a: ItemLista, b: ItemLista) => number> = {
    titulo: () => 0,
    nota: (a, b) => desc(a.nota_usuario, b.nota_usuario),
    adicao: (a, b) => desc(Date.parse(a.data_adicao), Date.parse(b.data_adicao)),
    atualizacao: (a, b) => desc(Date.parse(a.data_atualizacao), Date.parse(b.data_atualizacao)),
  };
  return itens
    .filter((i) => (f.genero === null || i.generos_lista.includes(f.genero)) && (f.situacao === null || situacaoDe(i) === f.situacao))
    .sort((a, b) => cmp[f.ordem](a, b) || colacao.compare(tituloDe(a), tituloDe(b)));
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function buscarNaLista(itens: ItemLista[], termo: string): ItemLista[] {
  const b = normalizar(termo.trim());
  if (!b) return itens;
  return itens.filter((i) => [i.titulo_portugues, i.titulo_original, i.titulo_ingles].some((t) => t && normalizar(t).includes(b)));
}

export function opcoesDosFiltros(itens: ItemLista[]) {
  const generos = [...new Set(itens.flatMap((i) => i.generos_lista))].sort(colacao.compare);
  const situacoes = [...new Set(itens.map(situacaoDe).filter((s): s is string => s !== null))].map((valor) => ({
    valor,
    titulo: nomeDaSituacao(valor),
  }));
  return { generos, situacoes };
}

export const filtrosAtivos = (f: FiltrosLista) =>
  (Object.keys(FILTROS_PADRAO) as (keyof FiltrosLista)[]).filter((k) => f[k] !== FILTROS_PADRAO[k]).length;

// ---------------------------------------------------------------- Início

export function generosQueVoceCurte(lista: { generos: string | null }[], populares: { generos: string | null }[]): string[] {
  const contar = (ms: { generos: string | null }[]) => {
    const c = new Map<string, number>();
    for (const { generos } of ms) for (const g of generos?.split(',') ?? []) if (g.trim()) c.set(g.trim(), (c.get(g.trim()) ?? 0) + 1);
    return [...c].sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b, 'pt-BR')).slice(0, 2).map(([n]) => n);
  };
  const daLista = contar(lista);
  return daLista.length ? daLista : contar(populares);
}

export function foraDe<M extends { id_midia: string }>(ms: M[] | undefined, ja: { id_midia: string }[] | undefined): M[] {
  const ids = new Set(ja?.map((m) => m.id_midia));
  return (ms ?? []).filter((m) => !ids.has(m.id_midia));
}

export function jaLancadas<M extends { data_lancamento: string | null }>(ms: M[]): M[] {
  const hoje = new Date().toISOString().slice(0, 10);
  return ms.filter((m) => m.data_lancamento !== null && m.data_lancamento.slice(0, 10) <= hoje);
}
