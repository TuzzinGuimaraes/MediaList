import type tokens from '../../../design/tokens';

import type { Tema } from './tema';

export type Cores = (typeof tokens)['cores']['escuro'];
export type NomeCor = keyof Cores;

export const CORES: Record<Tema, Cores>;
export const NOMES: NomeCor[];
export const FONTES: Record<'normal' | 'semi' | 'negrito', string>;
export function canais(hex: string): string;
export function variaveis(tema: Tema): Record<string, string>;
