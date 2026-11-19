import { describe, expect, it } from 'vitest';

import { cartaoDaMidia } from './cartao';

const midia = {
  id_midia: 'm1',
  titulo_portugues: null,
  titulo_original: 'Frieren',
  poster_url: null,
  tipo: 'anime' as const,
};

describe('cartaoDaMidia', () => {
  it('sem Item, não tem fio', () => {
    expect(cartaoDaMidia(midia)).toEqual({ idMidia: 'm1', titulo: 'Frieren', posterUrl: null, tipo: 'Anime' });
  });

  it('com Item, o fio sai do Progresso', () => {
    const item = { tipo: 'anime' as const, status_consumo: 'assistindo', progresso_atual: 7, progresso_total: 28 };
    expect(cartaoDaMidia(midia, item).progresso).toBe(0.25);
  });
});
