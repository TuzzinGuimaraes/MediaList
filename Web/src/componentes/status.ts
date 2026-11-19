// Cor de cada Status: apresentação do web. O Estado de consumo vem do dominio/.
import type { EstadoConsumo } from '@dominio/estadoConsumo';

/** Cor de cada Status (tons dessaturados de design/tokens.js; o carmesim fica com a marca). */
export const COR_DO_ESTADO: Record<EstadoConsumo, string> = {
  em_progresso: 'var(--cor-status-progresso)',
  concluido: 'var(--cor-status-concluido)',
  pausado: 'var(--cor-status-pausado)',
  abandonado: 'var(--cor-status-abandonado)',
  planejado: 'var(--cor-status-planejado)',
  platinado: 'var(--cor-status-platinado)',
};
