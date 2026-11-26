// Calendário da semana (ticket 50 da revisão): a janela de GET /midias/calendario, os 7 dias de
// Hoje em diante no fuso de quem vê, com os rótulos, a hora local, a contagem e o "foi ao ar", o
// filtro "Só os meus" e o padrão dele, e o "A seguir dos seus". `agora` e o fuso (IANA, ex.
// "America/Sao_Paulo") entram de fora; as contas de fuso usam só `Intl.DateTimeFormat`.

import { estadoDe } from './estadoConsumo';
import type { EpisodioDoCalendario, ItemLista } from './tipos';

export type { EpisodioDoCalendario };

/** O que o filtro lê de um Item de lista (GET /lista). */
export type ItemDoCalendario = Pick<ItemLista, 'id_midia' | 'tipo' | 'status_consumo' | 'favorito'>;

/** Um episódio num dia: a hora local ("22:30") e se já foi ao ar. */
export type EpisodioNoDia<T> = { episodio: T; hora: string; foiAoAr: boolean };

/** Um dia do Calendário. `chave` é o dia local ("2026-11-26"); `total`, quantos episódios ele tem. */
export type DiaDoCalendario<T> = {
  chave: string;
  /** "Hoje", "Amanhã", depois o dia da semana ("Sábado", "Segunda-feira"). */
  rotulo: string;
  /** Para a faixa de dias: "Hoje", "Amanhã", "Sáb". */
  curto: string;
  /** "28/11". */
  data: string;
  hoje: boolean;
  episodios: EpisodioNoDia<T>[];
  total: number;
};

/** O "A seguir dos seus": o episódio, o rótulo do dia e a hora local. */
export type ASeguir<T> = { episodio: T; dia: string; hora: string };

export type OpcoesDoCalendario = {
  agora: Date;
  fuso: string;
  /** Os Itens da Lista do Usuário; sem eles, nenhum episódio é "dos meus". */
  itens?: readonly ItemDoCalendario[];
  soOsMeus?: boolean;
};

export const DIAS_DO_CALENDARIO = 7;

/** A nota discreta ao lado do horário. */
export const NOTA_DO_HORARIO = 'horário da exibição no Japão';

const DIAS_DA_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MINUTO = 60_000;

const formatos = new Map<string, Intl.DateTimeFormat>();

/** Ano, mês, dia, hora e minuto do instante no fuso (os números, sem depender do idioma). */
function partes(instante: Date, fuso: string) {
  let formato = formatos.get(fuso);
  if (!formato) {
    formato = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    formatos.set(fuso, formato);
  }
  const lidas = formato.formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => Number(lidas.find((p) => p.type === tipo)?.value);
  // Alguns motores escrevem a meia-noite como "24".
  return { ano: valor('year'), mes: valor('month'), dia: valor('day'), hora: valor('hour') % 24, minuto: valor('minute') };
}

const dois = (n: number) => String(n).padStart(2, '0');

/** O dia local ("2026-11-26") do instante no fuso. */
function chaveDoDia(instante: Date, fuso: string): string {
  const { ano, mes, dia } = partes(instante, fuso);
  return `${ano}-${dois(mes)}-${dois(dia)}`;
}

function horaLocal(instante: Date, fuso: string): string {
  const { hora, minuto } = partes(instante, fuso);
  return `${dois(hora)}:${dois(minuto)}`;
}

/** Quanto o fuso está à frente do UTC no instante, em ms. */
function deslocamento(instante: Date, fuso: string): number {
  const p = partes(instante, fuso);
  const local = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
  return local - Math.floor(instante.getTime() / MINUTO) * MINUTO;
}

/** O instante da meia-noite local do dia `chave` + `dias` no fuso. */
function inicioDoDia(chave: string, dias: number, fuso: string): Date {
  const [ano, mes, dia] = chave.split('-').map(Number) as [number, number, number];
  const meiaNoite = Date.UTC(ano, mes - 1, dia + dias);
  // Duas passadas: o deslocamento da meia-noite pode ser outro que o do palpite (mudança de horário).
  const palpite = meiaNoite - deslocamento(new Date(meiaNoite), fuso);
  return new Date(meiaNoite - deslocamento(new Date(palpite), fuso));
}

/** Os 7 dias locais de Hoje em diante: a chave, o dia da semana e a data. */
function diasDaJanela(agora: Date, fuso: string) {
  const hoje = chaveDoDia(agora, fuso);
  const [ano, mes, dia] = hoje.split('-').map(Number) as [number, number, number];
  return Array.from({ length: DIAS_DO_CALENDARIO }, (_, i) => {
    const data = new Date(Date.UTC(ano, mes - 1, dia + i));
    const semana = data.getUTCDay();
    const especial = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : null;
    return {
      chave: data.toISOString().slice(0, 10),
      rotulo: especial ?? (DIAS_DA_SEMANA[semana] as string),
      curto: especial ?? (DIAS_CURTOS[semana] as string),
      data: `${dois(data.getUTCDate())}/${dois(data.getUTCMonth() + 1)}`,
      hoje: i === 0,
    };
  });
}

/**
 * A query de GET /midias/calendario: do início de Hoje ao fim do 7º dia, no fuso (com mudança de
 * horário no meio, a janela tem uma hora a mais ou a menos).
 */
export function consultaDoCalendario(agora: Date, fuso: string): { de: string; ate: string } {
  const hoje = chaveDoDia(agora, fuso);
  return {
    de: inicioDoDia(hoje, 0, fuso).toISOString(),
    ate: inicioDoDia(hoje, DIAS_DO_CALENDARIO, fuso).toISOString(),
  };
}

/** "Só os meus": o Item em Em progresso ou Planejado, ou favorito (Pausado e Abandonado só se favoritos). */
export function ehDosMeus(item: ItemDoCalendario | undefined): boolean {
  if (!item) return false;
  if (item.favorito) return true;
  const estado = estadoDe(item.status_consumo, item.tipo);
  return estado === 'em_progresso' || estado === 'planejado';
}

function meus(itens: readonly ItemDoCalendario[] | undefined): Set<string> {
  return new Set((itens ?? []).filter(ehDosMeus).map((i) => i.id_midia));
}

/** O filtro "Só os meus" começa ligado quando algum episódio da janela é dos meus. */
export function soOsMeusPorPadrao(
  episodios: readonly Pick<EpisodioDoCalendario, 'id_midia'>[],
  itens: readonly ItemDoCalendario[],
): boolean {
  const ids = meus(itens);
  return episodios.some((e) => ids.has(e.id_midia));
}

/**
 * Os 7 dias, de Hoje em diante, com os episódios de cada um na ordem do instante e a hora local.
 * "Foi ao ar": o exibido e o próximo cuja hora já passou (o job de episódios ainda não o viu).
 * Com `soOsMeus`, só os episódios dos meus; fora dos 7 dias, nada.
 */
export function diasDoCalendario<T extends EpisodioDoCalendario>(
  episodios: readonly T[],
  opcoes: OpcoesDoCalendario,
): DiaDoCalendario<T>[] {
  const { agora, fuso } = opcoes;
  const ids = opcoes.soOsMeus ? meus(opcoes.itens) : null;
  const porDia = new Map<string, { quando: number; noDia: EpisodioNoDia<T> }[]>();
  for (const episodio of episodios) {
    if (ids && !ids.has(episodio.id_midia)) continue;
    const quando = Date.parse(episodio.instante);
    if (Number.isNaN(quando)) continue;
    const instante = new Date(quando);
    const chave = chaveDoDia(instante, fuso);
    const noDia = { episodio, hora: horaLocal(instante, fuso), foiAoAr: episodio.exibido || quando <= agora.getTime() };
    porDia.set(chave, [...(porDia.get(chave) ?? []), { quando, noDia }]);
  }
  return diasDaJanela(agora, fuso).map((dia) => {
    const doDia = (porDia.get(dia.chave) ?? []).sort((a, b) => a.quando - b.quando).map((e) => e.noDia);
    return { ...dia, episodios: doDia, total: doDia.length };
  });
}

/**
 * O "A seguir dos seus": o primeiro episódio dos 7 dias que ainda não foi ao ar, de um dos meus,
 * com o filtro ligado ou não. Null se não há: o bloco some.
 */
export function aSeguirDosSeus<T extends EpisodioDoCalendario>(
  episodios: readonly T[],
  opcoes: Omit<OpcoesDoCalendario, 'soOsMeus'>,
): ASeguir<T> | null {
  for (const dia of diasDoCalendario(episodios, { ...opcoes, soOsMeus: true })) {
    const proximo = dia.episodios.find((e) => !e.foiAoAr);
    if (proximo) return { episodio: proximo.episodio, dia: dia.rotulo, hora: proximo.hora };
  }
  return null;
}
