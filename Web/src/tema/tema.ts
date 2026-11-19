// Tema do web (Resolution do 29): Sistema, Escuro ou Claro, com o escuro como padrão.
// O index.html repete esta regra num script inline, para aplicar antes do primeiro paint.

export type PreferenciaTema = 'sistema' | 'escuro' | 'claro';
export type Tema = 'escuro' | 'claro';

export const CHAVE_TEMA = 'medialist.tema';
export const PREFERENCIA_PADRAO: PreferenciaTema = 'escuro';
export const PREFERENCIAS: readonly { valor: PreferenciaTema; nome: string }[] = [
  { valor: 'sistema', nome: 'Sistema' },
  { valor: 'escuro', nome: 'Escuro' },
  { valor: 'claro', nome: 'Claro' },
];

export const CONSULTA_CLARO = '(prefers-color-scheme: light)';

export function resolverTema(preferencia: PreferenciaTema, sistemaClaro: boolean): Tema {
  if (preferencia === 'sistema') return sistemaClaro ? 'claro' : 'escuro';
  return preferencia;
}

export function lerPreferencia(): PreferenciaTema {
  try {
    const guardada = localStorage.getItem(CHAVE_TEMA);
    return PREFERENCIAS.find((p) => p.valor === guardada)?.valor ?? PREFERENCIA_PADRAO;
  } catch {
    return PREFERENCIA_PADRAO;
  }
}

export function guardarPreferencia(preferencia: PreferenciaTema): void {
  try {
    localStorage.setItem(CHAVE_TEMA, preferencia);
  } catch {
    // Sem armazenamento, a escolha vale até recarregar.
  }
}
