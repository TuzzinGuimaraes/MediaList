// Situação: o status de lançamento da Mídia (CONTEXT.md). Na tela é "Situação", porque
// "Status" é o Estado de consumo do Item. Cada Tipo guarda o seu em `status_<tipo>`.

import type { TipoMidia } from './estadoConsumo';

/** O que basta para ler a Situação; os campos faltam em listagens resumidas (populares). */
export type ComSituacao = {
  tipo: TipoMidia;
  status_anime?: string | null;
  status_manga?: string | null;
  status_jogo?: string | null;
};

/** Valor cru da Situação ("em_exibicao", "finalizado"...), lido do campo do Tipo; null sem ele. */
export function situacaoDe(midia: ComSituacao): string | null {
  const porTipo: Record<TipoMidia, string | null | undefined> = {
    anime: midia.status_anime,
    manga: midia.status_manga,
    jogo: midia.status_jogo,
  };
  return porTipo[midia.tipo] ?? null;
}

/** Nomes na tela das Situações (CHECKs de anime, mangá e jogo no banco). */
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

/** Nome legível de uma Situação; valor desconhecido passa como veio. */
export function nomeDaSituacao(situacao: string): string {
  return NOMES_SITUACAO[situacao] ?? situacao;
}

/** Situações que ganham o selo de destaque sobre o pôster. */
const EM_LANCAMENTO = new Set(['em_exibicao', 'em_publicacao']);

/** Nome do selo de lançamento ("Em exibição", "Em publicação"), ou null se a Mídia não está saindo. */
export function emLancamento(midia: ComSituacao): string | null {
  const situacao = situacaoDe(midia);
  return situacao && EM_LANCAMENTO.has(situacao) ? nomeDaSituacao(situacao) : null;
}
