// Consultas do Início. Os endpoints de catálogo filtram por um Tipo só: um Recorte com dois
// Tipos faz uma requisição por Tipo, e as respostas se juntam na ordem do backend.
import { useQueries, useQuery } from '@tanstack/react-query';

import { juntarCarrossel, type OrdemCarrossel } from '@dominio/carrossel';
import { notaDeRanking } from '@dominio/midia';
import { decrescente } from '@dominio/ordenacao';
import { type Recorte, TIPOS_DO_RECORTE } from '@dominio/recorte';

import { type Api, exigir } from '../../api/cliente';
import { useApi } from '../../sessao/SessaoContext';

/** Quantas Mídias cada Tipo manda para Em alta e para um carrossel. */
const LIMITE_EM_ALTA = 10;
const POR_CARROSSEL = 20;

function porTipo<T>(recorte: Recorte, buscar: (tipo: (typeof TIPOS_DO_RECORTE)[Recorte][number]) => Promise<T[]>) {
  return Promise.all(TIPOS_DO_RECORTE[recorte].map(buscar));
}

/** Em alta: as de maior nota de cada Tipo (o backend chama de trending). */
export function useEmAlta(recorte: Recorte) {
  const api = useApi();
  return useQuery({
    queryKey: ['inicio', 'em-alta', recorte],
    queryFn: async () =>
      (
        await porTipo(recorte, async (tipo) =>
          (await exigir(api.GET('/api/midias/trending', { params: { query: { tipo, limite: LIMITE_EM_ALTA } } })))
            .midias,
        )
      )
        .flat()
        .sort(decrescente(notaDeRanking)),
  });
}

/** Populares: quantos Usuários têm a Mídia na Lista pessoal (acumulado, não do dia). */
export function usePopulares(recorte: Recorte) {
  const api = useApi();
  return useQuery({
    queryKey: ['inicio', 'populares', recorte],
    queryFn: async () =>
      (
        await porTipo(recorte, async (tipo) =>
          (await exigir(api.GET('/api/midias/populares', { params: { query: { tipo } } }))).midias,
        )
      )
        .flat()
        .sort(decrescente((m) => m.total_usuarios)),
  });
}

function consultaCarrossel(api: Api, recorte: Recorte, ordem: OrdemCarrossel, genero: string | null = null) {
  return {
    queryKey: ['inicio', 'carrossel', recorte, ordem, genero],
    queryFn: async () =>
      juntarCarrossel(
        await porTipo(recorte, async (tipo) => {
          const query = { tipo, ordem, por_pagina: POR_CARROSSEL, ...(genero ? { genero } : {}) };
          return (await exigir(api.GET('/api/midias', { params: { query } }))).itens;
        }),
        ordem,
        POR_CARROSSEL,
      ),
  };
}

/** Um carrossel de catálogo: GET /midias numa ordem, com os Tipos do Recorte juntos. */
export function useCarrossel(recorte: Recorte, ordem: OrdemCarrossel) {
  return useQuery(consultaCarrossel(useApi(), recorte, ordem));
}

/** Um carrossel por gênero ("Porque você curte <gênero>"), pelas maiores notas. */
export function useCarrosseisPorGenero(recorte: Recorte, generos: string[]) {
  const api = useApi();
  return useQueries({ queries: generos.map((g) => consultaCarrossel(api, recorte, 'nota_media', g)) });
}

/**
 * A Lista pessoal. A chave ['lista'] guarda a resposta inteira de GET /lista, a mesma do app,
 * para a tela da Lista e o editor do Item (ticket 07) dividirem o cache e invalidarem juntos.
 */
export function useLista() {
  const api = useApi();
  return useQuery({
    queryKey: ['lista'],
    queryFn: () => exigir(api.GET('/api/lista')),
    select: (r) => r.lista,
  });
}
