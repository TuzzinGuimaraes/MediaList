// A Temporada e a ordem da página na URL (search params tipados da rota). Sem estação e ano, vale a
// Temporada atual; a ordem padrão (Mais esperados) também fica fora da URL. A leitura é a do
// domínio (`@dominio/temporada`), a mesma do app.
import { lerTemporada, ORDEM_PADRAO_DA_TEMPORADA, ordemDaTemporada, type OrdemTemporada, type Temporada } from '@dominio/temporada';

export type BuscaTemporada = { estacao?: Temporada['estacao']; ano?: number; ordem?: OrdemTemporada };

/** `validateSearch` da rota: estação e ano só juntos e válidos; a ordem padrão some da URL. */
export function validarBuscaTemporada(s: Record<string, unknown>): BuscaTemporada {
  const temporada = lerTemporada(s);
  const ordem = ordemDaTemporada(s.ordem);
  return {
    ...(temporada ?? {}),
    ...(ordem !== ORDEM_PADRAO_DA_TEMPORADA ? { ordem } : {}),
  };
}
