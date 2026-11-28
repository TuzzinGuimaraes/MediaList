// Consultas do Início. Os endpoints de catálogo filtram por um Tipo só: um Recorte com dois
// Tipos faz uma requisição por Tipo, e as respostas se juntam na ordem do backend. O Em alta
// é o `useEmAlta` compartilhado (catalogo/consultas.ts).
import { useQueries, useQuery } from '@tanstack/react-query';

import { juntarCarrossel, type OrdemCarrossel } from '@dominio/carrossel';
import type { TipoMidia } from '@dominio/estadoConsumo';
import { decrescente } from '@dominio/ordenacao';
import type { Recorte } from '@dominio/recorte';
import { faixaDasSugestoes, pedidoDasSugestoes } from '@dominio/sugestoes';

import { chaves } from '../../api/chaves';
import { type Api, exigir } from '../../api/cliente';
import { porTipo } from '../../catalogo/consultas';
import { useApi, useSessao } from '../../sessao/SessaoContext';

/** Quantas Mídias cada Tipo manda para um carrossel. */
const POR_CARROSSEL = 20;

/** Populares: quantos Usuários têm a Mídia na Lista pessoal (acumulado, não do dia). */
export function usePopulares(recorte: Recorte) {
  const api = useApi();
  return useQuery({
    queryKey: chaves.midias.populares(recorte),
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
    queryKey: chaves.midias.carrossel(recorte, ordem, genero),
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
 * Sugestões para você (GET /sugestoes): uma requisição para os Tipos do catálogo, só com sessão.
 * O pedido e o que a faixa mostra são de `@dominio/sugestoes`; sem anime nem mangá (Jogos), não pede.
 */
export function useSugestoes(tipos: readonly TipoMidia[]) {
  const api = useApi();
  const { estado } = useSessao();
  const { ativa, chave, consulta } = pedidoDasSugestoes(tipos, estado.estado === 'autenticada');
  const sugestoes = useQuery({
    queryKey: chave,
    queryFn: async () => (await exigir(api.GET('/api/sugestoes', { params: { query: consulta } }))).sugestoes,
    enabled: ativa,
  });
  return faixaDasSugestoes(ativa, sugestoes);
}
