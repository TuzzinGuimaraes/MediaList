// A Temporada e a ordem da página na URL (search params tipados da rota). Sem estação e ano, vale a
// Temporada atual; a ordem padrão (Mais esperados) também fica fora da URL.
import { ESTACOES, type Temporada, temporadaDe } from '@dominio/temporada';

import type { ConsultaMidias } from '../explorar/busca';

export type OrdemTemporada = Extract<NonNullable<ConsultaMidias['ordem']>, 'popularidade_fonte' | 'estreia' | 'nota_media'>;

export const ORDEM_PADRAO: OrdemTemporada = 'popularidade_fonte';

/** As ordens da página; "Nota da fonte" é a `nota_media` da API (que cai na Nota da fonte sem Avaliações). */
export const ORDENS: readonly { valor: OrdemTemporada; nome: string }[] = [
  { valor: 'popularidade_fonte', nome: 'Mais esperados' },
  { valor: 'estreia', nome: 'Estreia' },
  { valor: 'nota_media', nome: 'Nota da fonte' },
];

/** O máximo da API por página: a Temporada vem inteira, página por página. */
export const POR_PAGINA = 50;

export type BuscaTemporada = { estacao?: Temporada['estacao']; ano?: number; ordem?: OrdemTemporada };

/** `validateSearch` da rota: estação e ano só juntos e válidos; a ordem padrão some da URL. */
export function validarBuscaTemporada(s: Record<string, unknown>): BuscaTemporada {
  const estacao = ESTACOES.find((e) => e === s.estacao);
  const ano = typeof s.ano === 'number' ? s.ano : typeof s.ano === 'string' && /^\d{4}$/.test(s.ano) ? Number(s.ano) : NaN;
  const ordem = ORDENS.find((o) => o.valor === s.ordem && o.valor !== ORDEM_PADRAO)?.valor;
  return {
    ...(estacao && Number.isInteger(ano) && ano >= 1900 && ano <= 9999 ? { estacao, ano } : {}),
    ...(ordem ? { ordem } : {}),
  };
}

/** A Temporada da URL, ou a atual. */
export function temporadaDaBusca(busca: BuscaTemporada, agora: Date): Temporada {
  return busca.estacao && busca.ano ? { estacao: busca.estacao, ano: busca.ano } : temporadaDe(agora);
}

/** Query de uma página de `GET /midias` para a Temporada. */
export function consultaDaTemporada(temporada: Temporada, ordem: OrdemTemporada, pagina: number): ConsultaMidias {
  return {
    tipo: 'anime',
    temporada_estacao: temporada.estacao,
    temporada_ano: temporada.ano,
    ordem,
    pagina,
    por_pagina: POR_PAGINA,
  };
}
