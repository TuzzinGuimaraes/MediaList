// Estado de consumo e Rótulos de estado (CONTEXT.md). Cópia de
// Backend/schemas/estado_consumo.py: o backend continua autoritativo (ADR 0002).

export type TipoMidia = 'anime' | 'manga' | 'jogo';

export const TIPOS: readonly TipoMidia[] = ['anime', 'manga', 'jogo'];

export type EstadoConsumo =
  | 'planejado'
  | 'em_progresso'
  | 'pausado'
  | 'abandonado'
  | 'concluido'
  | 'platinado';

export const ESTADOS: readonly EstadoConsumo[] = [
  'planejado',
  'em_progresso',
  'pausado',
  'abandonado',
  'concluido',
  'platinado',
];

export const NOMES_ESTADO: Record<EstadoConsumo, string> = {
  planejado: 'Planejado',
  em_progresso: 'Em progresso',
  pausado: 'Pausado',
  abandonado: 'Abandonado',
  concluido: 'Concluído',
  platinado: 'Platinado',
};

/** Rótulo de cada estado, por Tipo. Estado ausente não se aplica ao Tipo (só jogo tem Platinado). */
export const ROTULOS_POR_TIPO: Record<TipoMidia, Partial<Record<EstadoConsumo, string>>> = {
  anime: {
    planejado: 'planejado',
    em_progresso: 'assistindo',
    pausado: 'pausado',
    abandonado: 'abandonado',
    concluido: 'completo',
  },
  manga: {
    planejado: 'planejado',
    em_progresso: 'lendo',
    pausado: 'pausado',
    abandonado: 'abandonado',
    concluido: 'lido',
  },
  jogo: {
    planejado: 'na_fila',
    em_progresso: 'jogando',
    pausado: 'pausado',
    abandonado: 'abandonado',
    concluido: 'zerado',
    platinado: 'platinado',
  },
};

/** Rótulos válidos para o Tipo, na ordem dos estados. */
export function rotulosDoTipo(tipo: TipoMidia): string[] {
  return ESTADOS.flatMap((estado) => ROTULOS_POR_TIPO[tipo][estado] ?? []);
}

export function rotuloPara(estado: EstadoConsumo, tipo: TipoMidia): string | null {
  return ROTULOS_POR_TIPO[tipo][estado] ?? null;
}

/** Estado de consumo por trás do rótulo, ou null se o rótulo não vale para o Tipo. */
export function estadoDe(rotulo: string | null | undefined, tipo: string): EstadoConsumo | null {
  const rotulos = ROTULOS_POR_TIPO[tipo as TipoMidia];
  if (!rotulo || !rotulos) return null;
  return ESTADOS.find((estado) => rotulos[estado] === rotulo) ?? null;
}

export type ContagemPorEstado = Record<EstadoConsumo, number>;

/**
 * Conta Itens por Estado de consumo. Platinado é refinamento de Concluído:
 * cada Item platinado soma em `platinado` e também em `concluido`.
 */
export function contarPorEstado(
  itens: readonly { tipo: string; status_consumo: string | null }[],
): ContagemPorEstado {
  const contagem = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as ContagemPorEstado;
  for (const item of itens) {
    const estado = estadoDe(item.status_consumo, item.tipo);
    if (!estado) continue;
    contagem[estado] += 1;
    if (estado === 'platinado') contagem.concluido += 1;
  }
  return contagem;
}

/** Média das Notas pessoais dadas; null se nenhum Item tem nota. */
export function mediaNotasPessoais(
  itens: readonly { nota_usuario: number | string | null }[],
): number | null {
  const notas = itens
    .filter((i) => i.nota_usuario !== null && i.nota_usuario !== '')
    .map((i) => Number(i.nota_usuario))
    .filter((n) => Number.isFinite(n));
  if (notas.length === 0) return null;
  return notas.reduce((soma, n) => soma + n, 0) / notas.length;
}
