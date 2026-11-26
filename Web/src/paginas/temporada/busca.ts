// A Temporada, a ordem e a aba da página na URL (search params tipados da rota). Sem estação e
// ano, vale a Temporada atual; a ordem padrão (Mais esperados) e a aba padrão (Animes) também
// ficam fora da URL. A leitura da Temporada é a do domínio (`@dominio/temporada`), a mesma do app.
import { lerTemporada, ORDEM_PADRAO_DA_TEMPORADA, ordemDaTemporada, type OrdemTemporada, type Temporada } from '@dominio/temporada';

/** As abas da página; o Calendário só existe na Temporada atual (quem mostra decide). */
export type AbaTemporada = 'animes' | 'calendario';

export type BuscaTemporada = { estacao?: Temporada['estacao']; ano?: number; ordem?: OrdemTemporada; aba?: 'calendario' };

/** `validateSearch` da rota: estação e ano só juntos e válidos; a ordem e a aba padrão somem da URL. */
export function validarBuscaTemporada(s: Record<string, unknown>): BuscaTemporada {
  const temporada = lerTemporada(s);
  const ordem = ordemDaTemporada(s.ordem);
  return {
    ...(temporada ?? {}),
    ...(ordem !== ORDEM_PADRAO_DA_TEMPORADA ? { ordem } : {}),
    ...(s.aba === 'calendario' ? { aba: 'calendario' as const } : {}),
  };
}
