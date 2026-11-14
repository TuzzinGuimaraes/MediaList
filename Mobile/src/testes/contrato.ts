// Respostas da API nos envelopes do contrato (ADR 0011), tipadas pelo arquivo gerado.

import type { Avaliacao, CodigoErro, Erro, PaginaMidias } from '../api/tipos';
import type { Resposta } from './fetchSimulado';

/** O envelope `Pagina[T]` de GET /midias, avaliações e notícias. */
export type Pagina<T> = Omit<PaginaMidias, 'itens'> & { itens: T[] };

/**
 * Uma página com `itens`. Sem `total`, a página é a última: `total` conta as anteriores
 * (cheias) mais estas.
 */
export function pagina<T>(
  itens: T[],
  { pagina: numero = 1, por_pagina = 20, total }: { pagina?: number; por_pagina?: number; total?: number } = {},
): { status: 200; corpo: Pagina<T> } {
  return {
    status: 200,
    corpo: { itens, pagina: numero, por_pagina, total: total ?? (numero - 1) * por_pagina + itens.length },
  };
}

/** Resposta de erro no envelope `{erro, codigo, detalhes?}`. */
export function erro(status: number, codigo: CodigoErro, mensagem: string, detalhes?: Erro['detalhes']): Resposta {
  const corpo: Erro = { erro: mensagem, codigo, ...(detalhes ? { detalhes } : {}) };
  return { status, corpo };
}

/** Avaliações por página que o detalhe pede (o teto da API). */
export const AVALIACOES_POR_PAGINA = 50;

/** A rota de uma página de GET /avaliacoes/<id_midia>, como o detalhe a monta. */
export function rotaAvaliacoes(idMidia: string, numero = 1): string {
  return `GET /avaliacoes/${idMidia}?pagina=${numero}&por_pagina=${AVALIACOES_POR_PAGINA}`;
}

/** Uma página de Avaliações de uma Mídia; sem `total`, é a última. */
export function paginaAvaliacoes(itens: Avaliacao[], numero = 1, total?: number) {
  return pagina(itens, { pagina: numero, por_pagina: AVALIACOES_POR_PAGINA, total });
}
