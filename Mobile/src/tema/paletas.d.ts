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

export declare const NOMES: NomeCor[];
export declare const TEMAS: Record<'escuro' | 'claro', Cores>;
export declare function canais(hex: string): string;
export declare function variaveis(cores: Cores): Record<string, string>;
