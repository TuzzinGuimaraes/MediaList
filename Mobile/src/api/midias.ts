import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import { notaDeRanking } from '../dominio/midia';
import { type Recorte, TIPOS_DO_RECORTE, useRecorte } from '../recorte/RecorteContext';
import type { Cliente } from './cliente';
import { useCache } from './consulta';
import type {
  MidiaDetalhe,
  MidiaPopular,
  RespostaDistribuicao,
  RespostaPopulares,
  RespostaTrending,
} from './tipos';

const LIMITE_EM_ALTA = 10;

/** Os endpoints filtram por um Tipo só: um Recorte com dois Tipos vira duas requisições. */
async function porTipo<R extends RespostaTrending | RespostaPopulares>(
  cliente: Cliente,
  recorte: Recorte,
  caminho: (tipo: string) => string,
): Promise<R['midias']> {
  const respostas = await Promise.all(
    TIPOS_DO_RECORTE[recorte].map((tipo) => cliente.requisitar<R>(caminho(tipo))),
  );
  return respostas.flatMap((r) => r.midias);
}

const decrescente =
  <M,>(valor: (m: M) => number | null) =>
  (a: M, b: M) =>
    (valor(b) ?? -1) - (valor(a) ?? -1);

/** O backend chama de trending as Mídias de maior nota de cada Tipo. */
export function useEmAlta(recorte: Recorte) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['midias', 'em-alta', recorte],
    queryFn: async () =>
      (
        await porTipo<RespostaTrending>(cliente, recorte, (t) => `/midias/trending?tipo=${t}&limite=${LIMITE_EM_ALTA}`)
      ).sort(decrescente(notaDeRanking)),
  });
}

/** Popularidade: quantos Usuários têm a Mídia na Lista pessoal. */
export function usePopulares(recorte: Recorte) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['midias', 'populares', recorte],
    queryFn: async () =>
      (await porTipo<RespostaPopulares>(cliente, recorte, (t) => `/midias/populares?tipo=${t}`)).sort(
        decrescente((m) => m.total_usuarios),
      ),
  });
}

/** Posição (1 a 10) da Mídia em Populares do Recorte, se já em cache; null fora do Top 10. */
export function usePosicaoTop10(idMidia: string): number | null {
  const { recorte } = useRecorte();
  const posicao = useCache<MidiaPopular[]>(['midias', 'populares', recorte])
    ?.slice(0, 10)
    .findIndex((m) => m.id_midia === idMidia);
  return posicao !== undefined && posicao >= 0 ? posicao + 1 : null;
}

export function useMidia(id: string) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['midias', id],
    queryFn: () => cliente.requisitar<MidiaDetalhe>(`/midias/${encodeURIComponent(id)}`),
  });
}

export function useDistribuicao(id: string) {
  const { cliente, sessao } = useSessao();
  return useQuery({
    enabled: sessao.estado === 'autenticada',
    queryKey: ['midias', id, 'distribuicao'],
    queryFn: () =>
      cliente.requisitar<RespostaDistribuicao>(`/midias/${encodeURIComponent(id)}/distribuicao`),
    select: (r) => r.distribuicao,
  });
}
