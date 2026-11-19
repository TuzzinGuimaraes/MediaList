// TODO(web-novo 01): importar EstadoConsumo de `dominio/estadoConsumo` quando o domínio
// compartilhado chegar; aqui fica só a cor de cada Status, que é apresentação do web.
export type EstadoConsumo = 'planejado' | 'em_progresso' | 'pausado' | 'abandonado' | 'concluido' | 'platinado';

/** Cor de cada Status (tons dessaturados de design/tokens.js; o carmesim fica com a marca). */
export const COR_DO_ESTADO: Record<EstadoConsumo, string> = {
  em_progresso: 'var(--cor-status-progresso)',
  concluido: 'var(--cor-status-concluido)',
  pausado: 'var(--cor-status-pausado)',
  abandonado: 'var(--cor-status-abandonado)',
  planejado: 'var(--cor-status-planejado)',
  platinado: 'var(--cor-status-platinado)',
};
