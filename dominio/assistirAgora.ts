// "Para assistir agora" (ticket 48 da revisão): a faixa do Início e o destaque do Detalhe do
// anime. Os episódios lançados e a data do próximo vêm do job de episódios pela API;
// `agora` entra de fora para a contagem ser testável.

import { estadoDe } from './estadoConsumo';
import type { ItemLista } from './tipos';

/** O que a regra lê de um Item de lista (GET /lista). */
export type ItemAssistirAgora = Pick<
  ItemLista,
  'tipo' | 'status_consumo' | 'status_anime' | 'progresso_atual' | 'episodios_lancados' | 'proximo_episodio_em'
>;

/**
 * Um cartão da faixa: o Item, o Atraso (0: em dia), se está atrasado e os textos. `texto` é a
 * primeira linha (o atraso, ou no em dia a contagem ou "Em dia"); `proximo`, a contagem do
 * atrasado, que as telas mostram numa linha só dela.
 */
export type CartaoDaFaixa<T> = { item: T; atraso: number; atrasado: boolean; texto: string; proximo: string | null };

/** O destaque do Detalhe de um anime atrasado. */
export type DestaqueDeEpisodio = { atraso: number; texto: string };

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/**
 * Episódios atrás, ou null se o Item não entra: só anime em exibição, no Estado Em progresso e
 * com os episódios lançados já conhecidos. Progresso à frente do que o job viu conta como em dia.
 */
function atrasoDe(item: ItemAssistirAgora): number | null {
  if (item.tipo !== 'anime' || item.status_anime !== 'em_exibicao' || item.episodios_lancados == null) return null;
  if (estadoDe(item.status_consumo, item.tipo) !== 'em_progresso') return null;
  return Math.max(0, item.episodios_lancados - (item.progresso_atual ?? 0));
}

function instante(texto: string | null): number | null {
  if (!texto) return null;
  const ms = Date.parse(texto);
  return Number.isNaN(ms) ? null : ms;
}

/** "1 episódio atrás", "3 episódios atrás". */
export function textoDoAtraso(atraso: number): string {
  return `${atraso} ${atraso === 1 ? 'episódio' : 'episódios'} atrás`;
}

/**
 * Contagem até o próximo episódio em dias, horas e minutos, arredondando para baixo: as unidades
 * zero à esquerda somem ("4 h 10 min"), as do meio ficam ("2 d 0 h 5 min"). Abaixo de 1 min,
 * "próximo em instantes". Data já passada é episódio que saiu e o job ainda não viu. Sem data legível, null.
 */
export function textoDoProximo(proximoEm: string | null, agora: Date): string | null {
  const quando = instante(proximoEm);
  if (quando === null) return null;
  const falta = quando - agora.getTime();
  if (falta <= 0) return 'saindo agora';
  if (falta < MINUTO) return 'próximo em instantes';
  const partes = [
    [Math.floor(falta / DIA), 'd'],
    [Math.floor((falta % DIA) / HORA), 'h'],
    [Math.floor((falta % HORA) / MINUTO), 'min'],
  ] as const;
  const primeira = partes.findIndex(([n]) => n > 0);
  return `próximo em ${partes
    .slice(primeira)
    .map(([n, unidade]) => `${n} ${unidade}`)
    .join(' ')}`;
}

/** Atrasado: a contagem até o próximo episódio, só com ele no futuro. */
function proximoDoAtrasado(proximoEm: string | null, agora: Date): string | null {
  const quando = instante(proximoEm);
  return quando !== null && quando > agora.getTime() ? textoDoProximo(proximoEm, agora) : null;
}

/**
 * A faixa "Para assistir agora": os atrasados, do mais atrasado ao menos, depois os em dia, do
 * próximo episódio mais perto ao mais longe (sem data, no fim). Vazia: a faixa some.
 */
export function paraAssistirAgora<T extends ItemAssistirAgora>(itens: readonly T[], agora: Date): CartaoDaFaixa<T>[] {
  const cartoes = itens.flatMap((item) => {
    const atraso = atrasoDe(item);
    if (atraso === null) return [];
    const [texto, proximo] =
      atraso > 0
        ? [textoDoAtraso(atraso), proximoDoAtrasado(item.proximo_episodio_em, agora)]
        : [textoDoProximo(item.proximo_episodio_em, agora) ?? 'Em dia', null];
    return [{ item, atraso, texto, proximo, quando: instante(item.proximo_episodio_em) ?? Number.POSITIVE_INFINITY }];
  });
  const ordemDoProximo = (a: { quando: number }, b: { quando: number }) =>
    a.quando === b.quando ? 0 : a.quando < b.quando ? -1 : 1;
  return cartoes
    .sort((a, b) => b.atraso - a.atraso || (a.atraso === 0 ? ordemDoProximo(a, b) : 0))
    .map(({ item, atraso, texto, proximo }) => ({ item, atraso, atrasado: atraso > 0, texto, proximo }));
}

/**
 * O destaque do Detalhe ("Você parou no ep. 5; saiu o 7"): o Item de anime em exibição, Em
 * progresso e atrasado, venha o Usuário do push ou de qualquer outro caminho. Senão, null.
 */
export function destaqueDoItem(item: ItemAssistirAgora | null | undefined): DestaqueDeEpisodio | null {
  if (!item) return null;
  const atraso = atrasoDe(item);
  if (!atraso || item.episodios_lancados == null) return null;
  const parouNo = item.progresso_atual ?? 0;
  const onde = parouNo > 0 ? `Você parou no ep. ${parouNo}` : 'Você ainda não começou';
  return { atraso, texto: `${onde}; saiu o ${item.episodios_lancados}` };
}
