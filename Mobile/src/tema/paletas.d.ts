export type NomeCor =
  | 'fundo'
  | 'superficie'
  | 'superficie-alta'
  | 'nav'
  | 'borda'
  | 'texto'
  | 'texto-suave'
  | 'texto-forte'
  | 'marca'
  | 'marca-forte'
  | 'marca-texto'
  | 'sobre-marca'
  | 'erro'
  | 'nota'
  | 'status-progresso'
  | 'status-concluido'
  | 'status-pausado'
  | 'status-abandonado'
  | 'status-planejado'
  | 'status-platinado';

export type Cores = Record<NomeCor, string>;
export type ChavePaleta = 'carmesim' | 'bordo' | 'rubi';

export declare const NOMES: NomeCor[];
export declare const PALETAS: Record<ChavePaleta, { nome: string; escuro: Cores; claro: Cores }>;
export declare function canais(hex: string): string;
export declare function variaveis(cores: Cores): Record<string, string>;
