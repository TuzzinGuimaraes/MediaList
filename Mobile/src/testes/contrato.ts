// Respostas da API nos envelopes do contrato (ADR 0011), tipadas pelo arquivo gerado.

import { AVALIACOES_POR_PAGINA } from '../api/avaliacoes';
import type { Avaliacao, CodigoErro, Erro, Pagina, RespostaNotas } from '../api/tipos';
import type { Resposta } from './fetchSimulado';

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

/** A rota da 1ª página de GET /avaliacoes/<id_midia>, a única que o detalhe pede. */
export function rotaAvaliacoes(idMidia: string): string {
  return `GET /avaliacoes/${idMidia}?por_pagina=${AVALIACOES_POR_PAGINA}`;
}

/** A 1ª página de Avaliações de uma Mídia; sem `total`, é a única. */
export function paginaAvaliacoes(itens: Avaliacao[], total?: number) {
  return pagina(itens, { pagina: 1, por_pagina: AVALIACOES_POR_PAGINA, total });
}

export function rotaNotas(idMidia: string): string {
  return `GET /midias/${idMidia}/notas`;
}

/** GET /midias/<id>/notas: as 10 faixas (as não informadas com 0) e a Avaliação do Usuário. */
export function respostaNotas(
  totais: Partial<Record<number, number>> = {},
  minha: Avaliacao | null = null,
): { status: 200; corpo: RespostaNotas } {
  const distribuicao = Array.from({ length: 10 }, (_, i) => ({ nota: i + 1, total: totais[i + 1] ?? 0 }));
  return { status: 200, corpo: { distribuicao, minha_avaliacao: minha } };
}

/** As rotas das Avaliações no detalhe: a 1ª página e as notas, sem nenhuma Avaliação. */
export function rotasSemAvaliacoes(idMidia: string): Record<string, Resposta> {
  return { [rotaAvaliacoes(idMidia)]: paginaAvaliacoes([]), [rotaNotas(idMidia)]: respostaNotas() };
}
