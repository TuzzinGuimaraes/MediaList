// Filtros do Explorar na URL (search params tipados da rota), para o link ser compartilhável.
// Valor que não passa na validação some da URL em vez de quebrar a tela. Os nomes seguem os
// da API, menos `situacao`, que na API é `status` (na tela, "Status" é o Estado de consumo).
import { TIPOS, type TipoMidia } from '@dominio/estadoConsumo';
import { DEMOGRAFIAS, type Demografia, MODOS_DE_JOGO, type ModoDeJogo } from '@dominio/filtrosCatalogo';

import type { Caminhos } from '../../api/tipos';

export type ConsultaMidias = NonNullable<Caminhos['/api/midias']['get']['parameters']['query']>;
export type OrdemExplorar = NonNullable<ConsultaMidias['ordem']>;

export const POR_PAGINA = 30;
export const ORDEM_PADRAO: OrdemExplorar = 'nota_media';
export const ANO_MINIMO = 1;
export const ANO_MAXIMO = 9999;

export type BuscaExplorar = {
  busca?: string;
  tipo?: TipoMidia;
  genero?: string;
  situacao?: string;
  ano_min?: number;
  ano_max?: number;
  ordem?: OrdemExplorar;
  plataforma?: string;
  modo_jogo?: ModoDeJogo;
  estudio?: string;
  demografia?: Demografia;
  pagina?: number;
};

/** Filtros que só valem para um Tipo: trocar de Tipo os descarta. */
export const FILTROS_DO_TIPO = ['genero', 'situacao', 'plataforma', 'modo_jogo', 'estudio', 'demografia'] as const;

const ORDENS: readonly OrdemExplorar[] = [
  'nota_media',
  'data_lancamento',
  'titulo',
  'mais_adicionados',
  'popularidade',
  'mais_concluidos',
];

function texto(v: unknown): string | undefined {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const t = String(v).trim();
  return t || undefined;
}

function inteiro(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

function umDe<T extends string>(v: unknown, valores: readonly T[]): T | undefined {
  return valores.find((valor) => valor === v);
}

/** `validateSearch` da rota: só os valores válidos ficam; os padrões não vão para a URL. */
export function validarBuscaExplorar(s: Record<string, unknown>): BuscaExplorar {
  const ordem = umDe(s.ordem, ORDENS);
  const pagina = inteiro(s.pagina, 1, Number.MAX_SAFE_INTEGER);
  const busca: BuscaExplorar = {
    busca: texto(s.busca),
    tipo: umDe(s.tipo, TIPOS),
    genero: texto(s.genero),
    situacao: texto(s.situacao),
    ano_min: inteiro(s.ano_min, ANO_MINIMO, ANO_MAXIMO),
    ano_max: inteiro(s.ano_max, ANO_MINIMO, ANO_MAXIMO),
    ordem: ordem === ORDEM_PADRAO ? undefined : ordem,
    plataforma: texto(s.plataforma),
    modo_jogo: umDe(s.modo_jogo, MODOS_DE_JOGO.map((m) => m.valor)),
    estudio: texto(s.estudio),
    demografia: umDe(s.demografia, DEMOGRAFIAS.map((d) => d.valor)),
    pagina: pagina === 1 ? undefined : pagina,
  };
  return Object.fromEntries(Object.entries(busca).filter(([, v]) => v !== undefined)) as BuscaExplorar;
}

/** Os filtros da URL que valem para o `tipo` (os de outro Tipo ficam de fora). */
function doTipo(b: BuscaExplorar, tipo: TipoMidia) {
  return {
    plataforma: tipo === 'jogo' ? b.plataforma : undefined,
    modo_jogo: tipo === 'jogo' ? b.modo_jogo : undefined,
    estudio: tipo === 'anime' ? b.estudio : undefined,
    demografia: tipo === 'manga' ? b.demografia : undefined,
  };
}

/** Ano inicial depois do final: a tela avisa e a busca ignora o Ano. */
export function anosInvertidos(b: BuscaExplorar): boolean {
  return b.ano_min !== undefined && b.ano_max !== undefined && b.ano_min > b.ano_max;
}

/** Query de `GET /midias` para a URL, já com o Tipo efetivo do catálogo. */
export function consultaDaBusca(b: BuscaExplorar, tipo: TipoMidia): ConsultaMidias {
  const consulta: ConsultaMidias = {
    tipo,
    busca: b.busca,
    genero: b.genero,
    status: b.situacao,
    ...(anosInvertidos(b) ? {} : { ano_min: b.ano_min, ano_max: b.ano_max }),
    ...doTipo(b, tipo),
    ordem: b.ordem ?? ORDEM_PADRAO,
    pagina: b.pagina ?? 1,
    por_pagina: POR_PAGINA,
  };
  return Object.fromEntries(Object.entries(consulta).filter(([, v]) => v !== undefined)) as ConsultaMidias;
}

/** Quantos filtros estão fora do padrão (o Tipo inicial do catálogo não conta). */
export function filtrosAtivos(b: BuscaExplorar, tipo: TipoMidia, tipoPadrao: TipoMidia): number {
  const extras = Object.values(doTipo(b, tipo)).filter(Boolean).length;
  const anos = b.ano_min !== undefined || b.ano_max !== undefined ? 1 : 0;
  return (tipo !== tipoPadrao ? 1 : 0) + (b.genero ? 1 : 0) + (b.situacao ? 1 : 0) + (b.ordem ? 1 : 0) + anos + extras;
}
