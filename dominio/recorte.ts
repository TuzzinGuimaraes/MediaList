// Recorte de catálogo (CONTEXT.md): estado de interface, não de domínio. Aqui ficam só os
// valores e os Tipos de cada um; guardar e trocar o Recorte é de cada app.

import type { TipoMidia } from './estadoConsumo';

export type Recorte = 'animanga' | 'jogos';

export const RECORTES: readonly Recorte[] = ['animanga', 'jogos'];

export const TIPOS_DO_RECORTE: Record<Recorte, TipoMidia[]> = {
  animanga: ['anime', 'manga'],
  jogos: ['jogo'],
};

/** Como o Recorte aparece na tela; o leitor de tela diz "Catálogo". */
export const NOMES_RECORTE: Record<Recorte, string> = {
  animanga: 'Anime & Mangá',
  jogos: 'Jogos',
};
