// Sugestões para o Usuário (CONTEXT.md, Sugestão; spec `sugestoes`): o texto do motivo e o do
// leitor de tela do cartão. A API (GET /sugestoes) já devolve as Sugestões em ordem, com o motivo
// estruturado; os pontos e as exclusões são do backend (`Backend/dominio/sugestoes.py`).

import { nomeDoTipo, type TipoMidia } from './estadoConsumo';
import { tituloDaMidia, type TitulosDaMidia } from './midia';
import type { MotivoDaSugestao, Sugestao } from './tipos';

/** Os textos que o web e o app mostram iguais. */
export const TEXTOS_DAS_SUGESTOES = {
  faixa: 'Sugestões para você',
  emAlta: 'Em alta',
} as const;

/** A Nota pessoal no motivo, como a Lista a mostra: sem casa decimal quando inteira ("9", "8,5"). */
export function formatarNotaDoMotivo(nota: number): string {
  return Number.isInteger(nota) ? String(nota) : nota.toFixed(1).replace('.', ',');
}

/** "porque você deu 9 a Frieren", "porque Frieren é Favorito" ou "Em alta". Motivo incompleto vale "Em alta". */
export function textoDoMotivo(motivo: MotivoDaSugestao): string {
  if (motivo.porque === 'nota' && motivo.titulo && motivo.nota != null) {
    return `porque você deu ${formatarNotaDoMotivo(motivo.nota)} a ${motivo.titulo}`;
  }
  if (motivo.porque === 'favorito' && motivo.titulo) return `porque ${motivo.titulo} é Favorito`;
  return TEXTOS_DAS_SUGESTOES.emAlta;
}

/** O que o cartão diz ao leitor de tela: título exibido, Tipo e motivo. */
export function descricaoDaSugestao(sugestao: TitulosDaMidia & Pick<Sugestao, 'tipo' | 'motivo'>): string {
  return [tituloDaMidia(sugestao), nomeDoTipo(sugestao.tipo), textoDoMotivo(sugestao.motivo)].join(', ');
}


/** O Tipo que GET /sugestoes aceita: as Sugestões são só de anime e mangá (jogo fica de fora). */
export type TipoDaSugestao = Extract<TipoMidia, 'anime' | 'manga'>;

/**
 * A consulta de GET /sugestoes para os Tipos da tela, numa requisição só: com anime e mangá,
 * sem `tipo` (os dois); com um deles, esse `tipo`; sem nenhum (o Recorte de jogos), null: a
 * tela não pede e a faixa não aparece.
 */
export function consultaDasSugestoes(tipos: readonly TipoMidia[]): { tipo?: TipoDaSugestao } | null {
  const pedidos = (['anime', 'manga'] as const).filter((t) => tipos.includes(t));
  if (!pedidos.length) return null;
  return pedidos.length === 1 ? { tipo: pedidos[0] } : {};
}
