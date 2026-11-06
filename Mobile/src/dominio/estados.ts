// Estados de consumo e seus Rótulos por Tipo de mídia (CONTEXT.md). O backend é
// autoritativo sobre quais Rótulos valem para cada Tipo (ADR 0002).

export type EstadoConsumo =
  | 'Planejado'
  | 'Em progresso'
  | 'Pausado'
  | 'Abandonado'
  | 'Concluído'
  | 'Platinado';

const ORDEM: EstadoConsumo[] = ['Planejado', 'Em progresso', 'Pausado', 'Abandonado', 'Concluído', 'Platinado'];

const ESTADO_DO_ROTULO: Record<string, EstadoConsumo> = {
  planejado: 'Planejado',
  na_fila: 'Planejado',
  assistindo: 'Em progresso',
  lendo: 'Em progresso',
  jogando: 'Em progresso',
  pausado: 'Pausado',
  abandonado: 'Abandonado',
  completo: 'Concluído',
  lido: 'Concluído',
  zerado: 'Concluído',
  platinado: 'Platinado',
};

export function estadoDoRotulo(rotulo: string): string {
  return ESTADO_DO_ROTULO[rotulo] ?? rotulo;
}

/** Platinado é um refinamento de Concluído: entra nas duas contagens. */
export function contarPorEstado(
  linhas: { status_consumo: string; total: number }[],
): { estado: EstadoConsumo; total: number }[] {
  const totais = new Map<EstadoConsumo, number>();
  const somar = (estado: EstadoConsumo, n: number) => totais.set(estado, (totais.get(estado) ?? 0) + n);
  for (const { status_consumo, total } of linhas) {
    const estado = ESTADO_DO_ROTULO[status_consumo];
    if (!estado) continue;
    somar(estado, total);
    if (estado === 'Platinado') somar('Concluído', total);
  }
  return ORDEM.filter((e) => totais.has(e)).map((estado) => ({ estado, total: totais.get(estado)! }));
}
