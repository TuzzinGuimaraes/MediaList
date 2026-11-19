// Carrosséis de catálogo do Início: GET /midias filtra por um Tipo só, então um Recorte com
// dois Tipos (Anime & Mangá) faz uma requisição por Tipo, e as respostas se juntam aqui na
// mesma ordem que o backend usou em cada uma.

import { notaDeRanking } from './midia';
import { decrescente } from './ordenacao';

/** As ordens de GET /midias que viram carrossel (a alfabética não). */
export type OrdemCarrossel = 'nota_media' | 'data_lancamento' | 'mais_adicionados' | 'mais_concluidos';

type ComChaves = {
  nota_media: number | null;
  nota_fonte: number | null;
  data_lancamento: string | null;
  total_usuarios: number;
  total_concluidos: number;
};

/** A chave decrescente de cada ordem, como o backend ordena (null no fim). */
const CHAVE_DA_ORDEM: Record<OrdemCarrossel, (m: ComChaves) => number | string | null> = {
  nota_media: notaDeRanking,
  data_lancamento: (m) => m.data_lancamento,
  mais_adicionados: (m) => m.total_usuarios,
  mais_concluidos: (m) => m.total_concluidos,
};

/** Junta as respostas dos Tipos (uma lista por Tipo) na `ordem` e corta em `limite`. */
export function juntarCarrossel<M extends ComChaves>(
  porTipo: readonly (readonly M[])[],
  ordem: OrdemCarrossel,
  limite = Infinity,
): M[] {
  return porTipo
    .flat()
    .sort(decrescente(CHAVE_DA_ORDEM[ordem]))
    .slice(0, limite);
}
