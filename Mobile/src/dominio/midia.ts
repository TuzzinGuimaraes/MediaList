import type { MidiaResumo } from '../api/tipos';

export function tituloDaMidia(midia: Pick<MidiaResumo, 'titulo_portugues' | 'titulo_original'>): string {
  return midia.titulo_portugues || midia.titulo_original;
}
