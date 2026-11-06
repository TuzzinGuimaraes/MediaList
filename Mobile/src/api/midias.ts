import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import { type Recorte, TIPOS_DO_RECORTE } from '../recorte/RecorteContext';
import type { Cliente } from './cliente';
import type {
  Midia,
  MidiaResumo,
  RespostaDistribuicao,
  RespostaMidias,
} from './tipos';

const LIMITE_EM_ALTA = 10;

/** Os endpoints filtram por um Tipo só: um Recorte com dois Tipos vira duas requisições. */
async function porTipo<M>(
  cliente: Cliente,
  recorte: Recorte,
  caminho: (tipo: string) => string,
): Promise<M[]> {
  const respostas = await Promise.all(
    TIPOS_DO_RECORTE[recorte].map((tipo) => cliente.requisitar<RespostaMidias<M>>(caminho(tipo))),
  );
  return respostas.flatMap((r) => r.midias);
}

const decrescente =
  <M,>(valor: (m: M) => number | null) =>
  (a: M, b: M) =>
    (valor(b) ?? -1) - (valor(a) ?? -1);

/** O backend chama de trending as Mídias de maior nota de cada Tipo. */
export function useEmAlta(recorte: Recorte) {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['midias', 'em-alta', recorte],
    queryFn: async () =>
      (
        await porTipo<Midia>(cliente, recorte, (t) => `/midias/trending?tipo=${t}&limite=${LIMITE_EM_ALTA}`)
      ).sort(decrescente((m) => m.nota_media)),
  });
}

/** Popularidade: quantos Usuários têm a Mídia na Lista pessoal. */
export function usePopulares(recorte: Recorte) {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['midias', 'populares', recorte],
    queryFn: async () =>
      (await porTipo<MidiaResumo>(cliente, recorte, (t) => `/midias/populares?tipo=${t}`)).sort(
        decrescente((m) => m.total_usuarios),
      ),
  });
}

export function useMidia(id: string) {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['midias', id],
    queryFn: () => cliente.requisitar<Midia>(`/midias/${encodeURIComponent(id)}`),
  });
}

export function useDistribuicao(id: string) {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['midias', id, 'distribuicao'],
    queryFn: () =>
      cliente.requisitar<RespostaDistribuicao>(`/midias/${encodeURIComponent(id)}/distribuicao`),
    select: (r) => r.distribuicao,
  });
}
