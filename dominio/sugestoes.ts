// Sugestões para o Usuário (CONTEXT.md, Sugestão; spec `sugestoes`): o texto do motivo, o do
// leitor de tela do cartão e o pedido de GET /sugestoes que o `useSugestoes` do web e do app
// fazem (consulta, chave, quando pedir e o que a faixa mostra enquanto isso). A API (GET /sugestoes) já devolve as Sugestões em ordem, com o motivo
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

/**
 * Prefixo das Sugestões no cache: toda escrita da Lista as refaz. Fica sob ['midias'], como tudo
 * que mostra a Nota média, para uma Avaliação gravada alcançá-las.
 */
export const CHAVE_SUGESTOES = ['midias', 'sugestoes'] as const;

/**
 * O pedido de GET /sugestoes para os Tipos da tela: a consulta, a chave do cache e se a tela pede
 * (só com sessão e com anime ou mangá; no Recorte de jogos, não).
 */
export function pedidoDasSugestoes(tipos: readonly TipoMidia[], autenticada: boolean) {
  const consulta = consultaDasSugestoes(tipos);
  return {
    ativa: consulta !== null && autenticada,
    chave: [...CHAVE_SUGESTOES, consulta?.tipo ?? null] as const,
    consulta: consulta ?? {},
  };
}

/**
 * O que a faixa mostra a partir da consulta: desligada, a consulta fica "pending" para sempre, e
 * aqui ela conta como pronta e vazia. Com erro, a faixa só some, sem derrubar a tela.
 */
export function faixaDasSugestoes<T>(
  ativa: boolean,
  resultado: { data?: T[]; isError: boolean; isPending: boolean },
): { sugestoes: T[] | undefined; pendente: boolean } {
  if (!ativa) return { sugestoes: [], pendente: false };
  return { sugestoes: resultado.data ?? (resultado.isError ? [] : undefined), pendente: resultado.isPending };
}
