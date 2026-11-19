// Consultas de catálogo usadas por mais de uma tela. Os endpoints filtram por um Tipo só:
// um Recorte com dois Tipos faz uma requisição por Tipo, e as respostas se juntam.
import { useQuery } from '@tanstack/react-query';

import type { TipoMidia } from '@dominio/estadoConsumo';
import { notaDeRanking } from '@dominio/midia';
import { decrescente } from '@dominio/ordenacao';
import { type Recorte, TIPOS_DO_RECORTE } from '@dominio/recorte';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { useApi } from '../sessao/SessaoContext';

/** Uma busca por Tipo do Recorte, em paralelo, na ordem dos Tipos. */
export function porTipo<T>(recorte: Recorte, buscar: (tipo: TipoMidia) => Promise<T[]>): Promise<T[][]> {
  return Promise.all(TIPOS_DO_RECORTE[recorte].map(buscar));
}

/**
 * Em alta (o backend chama de trending): as `limite` de maior nota de cada Tipo do Recorte,
 * juntas da maior nota para a menor. O Início e as Sugestões da Lista usam esta.
 */
export function useEmAlta(recorte: Recorte, limite: number) {
  const api = useApi();
  return useQuery({
    queryKey: chaves.midias.emAlta(recorte, limite),
    queryFn: async () =>
      (
        await porTipo(recorte, async (tipo) =>
          (await exigir(api.GET('/api/midias/trending', { params: { query: { tipo, limite } } }))).midias,
        )
      )
        .flat()
        .sort(decrescente(notaDeRanking)),
  });
}
