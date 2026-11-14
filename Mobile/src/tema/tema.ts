/** Preferência de tema do Usuário, escolhida no Perfil. O padrão é Escuro. */
export type PreferenciaTema = 'sistema' | 'escuro' | 'claro';
export type Tema = 'escuro' | 'claro';

export const PREFERENCIA_PADRAO: PreferenciaTema = 'escuro';

/** Tema aplicado: Sistema segue o esquema do aparelho (`useColorScheme`). */
export function resolverTema(preferencia: PreferenciaTema, esquema: string | null | undefined): Tema {
  if (preferencia !== 'sistema') return preferencia;
  return esquema === 'light' ? 'claro' : 'escuro';
}
