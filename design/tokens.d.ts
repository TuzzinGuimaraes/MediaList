type NomeCor =
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

declare const tokens: {
  cores: Record<'escuro' | 'claro', Record<NomeCor, string>>;
  fonte: { familia: string; pesos: Record<'normal' | 'semi' | 'negrito', number> };
};
export = tokens;
