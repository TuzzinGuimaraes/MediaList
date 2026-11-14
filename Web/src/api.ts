// PROTÓTIPO: cliente da API real (/api via proxy do Vite) e as consultas do TanStack Query.
// O access token fica no localStorage só para o protótipo; sem refresh (o web real usa o rotativo, Q62).
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '../../contrato/api';
import {
  type Avaliacao,
  type ItemLista,
  type Midia,
  type MidiaDetalhe,
  type MidiaPopular,
  notaDeRanking,
  type TipoMidia,
} from './dominio';

type S = components['schemas'];
export type Usuario = S['UsuarioDaSessao'];
export type Recorte = 'animanga' | 'jogos';
export const TIPOS_DO_RECORTE: Record<Recorte, TipoMidia[]> = { animanga: ['anime', 'manga'], jogos: ['jogo'] };
export const NOMES_RECORTE: Record<Recorte, string> = { animanga: 'Anime & Mangá', jogos: 'Jogos' };

const CHAVE = 'prototipo-web:sessao';

export function lerSessao(): { token: string; usuario: Usuario } | null {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
  } catch {
    return null;
  }
}

export function sair() {
  localStorage.removeItem(CHAVE);
  window.location.assign('/entrar');
}

export async function entrar(email: string, senha: string): Promise<void> {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha } satisfies S['CorpoLogin']),
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error((corpo as S['Erro']).erro ?? 'Falha no login');
  const { access_token, usuario } = corpo as S['RespostaLogin'];
  localStorage.setItem(CHAVE, JSON.stringify({ token: access_token, usuario }));
}

async function requisitar<T>(caminho: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = lerSessao()?.token;
  const r = await fetch(`/api${caminho}`, {
    method: init?.method ?? 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (r.status === 401) {
    sair();
    throw new Error('Sessão expirada');
  }
  const corpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error((corpo as S['Erro'] | null)?.erro ?? `HTTP ${r.status}`);
  return corpo as T;
}

/**
 * Página do contrato (`itens` + `total`). O backend do stack docker em :5000 ainda é anterior
 * ao contrato e manda `midias`/`avaliacoes` sem `total`; o protótipo aceita os dois.
 */
type PaginaCrua<T> = { itens?: T[]; midias?: T[]; avaliacoes?: T[]; pagina: number; por_pagina: number; total?: number };
export type Pagina<T> = { itens: T[]; pagina: number; porPagina: number; total: number | null };

function lerPagina<T>(r: PaginaCrua<T>): Pagina<T> {
  return { itens: r.itens ?? r.midias ?? r.avaliacoes ?? [], pagina: r.pagina, porPagina: r.por_pagina, total: r.total ?? null };
}

const decrescente =
  <M>(v: (m: M) => number | string | null | undefined) =>
  (a: M, b: M) => {
    const [x, y] = [v(a) ?? null, v(b) ?? null];
    return x === y ? 0 : x === null ? 1 : y === null ? -1 : x < y ? 1 : -1;
  };

async function porTipo<T>(recorte: Recorte, caminho: (tipo: TipoMidia) => string, ler: (r: never) => T[]): Promise<T[]> {
  const rs = await Promise.all(TIPOS_DO_RECORTE[recorte].map((t) => requisitar<never>(caminho(t))));
  return rs.flatMap(ler);
}

// ---------------------------------------------------------------- catálogo

export function useEmAlta(recorte: Recorte) {
  return useQuery({
    queryKey: ['midias', 'em-alta', recorte],
    queryFn: async () =>
      (await porTipo(recorte, (t) => `/midias/trending?tipo=${t}&limite=10`, (r: S['RespostaTrending']) => r.midias)).sort(
        decrescente(notaDeRanking),
      ),
  });
}

export function usePopulares(recorte: Recorte) {
  return useQuery({
    queryKey: ['midias', 'populares', recorte],
    queryFn: async () =>
      (await porTipo(recorte, (t) => `/midias/populares?tipo=${t}`, (r: S['RespostaPopulares']) => r.midias)).sort(
        decrescente((m: MidiaPopular) => m.total_usuarios),
      ),
  });
}

export type OrdemCatalogo = NonNullable<S['ConsultaMidias']['ordem']>;

const CHAVE_DA_ORDEM: Partial<Record<OrdemCatalogo, (m: Midia) => number | string | null>> = {
  nota_media: notaDeRanking,
  data_lancamento: (m) => m.data_lancamento,
  mais_adicionados: (m) => m.total_usuarios,
  mais_concluidos: (m) => m.total_concluidos,
};

function consultaCarrossel(recorte: Recorte, ordem: OrdemCatalogo, genero: string | null = null) {
  return {
    queryKey: ['midias', 'carrossel', recorte, ordem, genero],
    queryFn: async () => {
      const ms = await porTipo(
        recorte,
        (tipo) => {
          const p = new URLSearchParams({ tipo, ordem, por_pagina: '20' });
          if (genero) p.set('genero', genero);
          return `/midias?${p}`;
        },
        (r: PaginaCrua<Midia>) => lerPagina(r).itens,
      );
      const chave = CHAVE_DA_ORDEM[ordem];
      return (chave ? ms.sort(decrescente(chave)) : ms).slice(0, 20);
    },
  };
}

export const useCarrossel = (recorte: Recorte, ordem: OrdemCatalogo) => useQuery(consultaCarrossel(recorte, ordem));

export const useCarrosseisPorGenero = (recorte: Recorte, generos: string[]) =>
  useQueries({ queries: generos.map((g) => consultaCarrossel(recorte, 'nota_media', g)) });

export type FiltrosExplorar = {
  tipo: TipoMidia;
  busca: string;
  genero: string | null;
  status: string | null;
  ordem: OrdemCatalogo;
  pagina: number;
};

export const POR_PAGINA_EXPLORAR = 30;

export function useExplorar(f: FiltrosExplorar) {
  return useQuery({
    queryKey: ['midias', 'explorar', f],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const p = new URLSearchParams({ tipo: f.tipo, ordem: f.ordem, pagina: String(f.pagina), por_pagina: String(POR_PAGINA_EXPLORAR) });
      if (f.busca.trim()) p.set('busca', f.busca.trim());
      if (f.genero) p.set('genero', f.genero);
      if (f.status) p.set('status', f.status);
      return lerPagina(await requisitar<PaginaCrua<Midia>>(`/midias?${p}`));
    },
  });
}

export function useGeneros(tipo: TipoMidia) {
  return useQuery({
    queryKey: ['generos', tipo],
    queryFn: async () => (await requisitar<S['RespostaGeneros']>(`/generos?tipo=${tipo}`)).generos,
    staleTime: Infinity,
  });
}

export function useMidia(id: string) {
  return useQuery({ queryKey: ['midias', id], queryFn: () => requisitar<MidiaDetalhe>(`/midias/${encodeURIComponent(id)}`) });
}

export function useAvaliacoes(id: string) {
  return useQuery({
    queryKey: ['avaliacoes', id],
    queryFn: async () => lerPagina(await requisitar<PaginaCrua<Avaliacao>>(`/avaliacoes/${encodeURIComponent(id)}?por_pagina=10`)),
  });
}

export function useNotas(id: string) {
  return useQuery({
    queryKey: ['midias', id, 'notas'],
    queryFn: () => requisitar<S['RespostaNotas']>(`/midias/${encodeURIComponent(id)}/notas`),
  });
}

// ---------------------------------------------------------------- Lista pessoal

export function useLista() {
  return useQuery({ queryKey: ['lista'], queryFn: async () => (await requisitar<S['RespostaLista']>('/lista')).lista });
}

/** O Item da Mídia na Lista, se a Lista já está em cache; undefined enquanto carrega. */
export function useItemDe(idMidia: string): ItemLista | null | undefined {
  const { data } = useLista();
  return data ? (data.find((i) => i.id_midia === idMidia) ?? null) : undefined;
}

/** Stepper: grava o Progresso de verdade (PUT /lista/<id>/progresso) e recarrega a Lista. */
export function useMudarProgresso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ item, progresso }: { item: ItemLista; progresso: number }) =>
      requisitar(`/lista/${item.id_lista}/progresso`, { method: 'PUT', body: { progresso_atual: progresso } satisfies S['ProgressoItemLista'] }),
    onMutate: ({ item, progresso }) => {
      qc.setQueryData<ItemLista[]>(['lista'], (l) => l?.map((i) => (i.id_lista === item.id_lista ? { ...i, progresso_atual: progresso } : i)));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['lista'] }),
  });
}

/** Editor: PUT no Item existente ou POST /lista/adicionar. */
export function useGravarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ item, idMidia, dados }: { item: ItemLista | null; idMidia: string; dados: S['EdicaoItemLista'] }) =>
      item
        ? requisitar(`/lista/${item.id_lista}`, { method: 'PUT', body: dados })
        : requisitar('/lista/adicionar', { method: 'POST', body: { ...dados, id_midia: idMidia } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['lista'] }),
  });
}

export function useRemoverItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ItemLista) => requisitar(`/lista/${item.id_lista}`, { method: 'DELETE' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['lista'] }),
  });
}
