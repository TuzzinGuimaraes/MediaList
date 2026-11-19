import { describe, expect, it } from 'vitest';

import { paginacao } from './paginacao';

const itens = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('paginacao', () => {
  it('página do meio: 245 itens de 30 em 30 são 9 páginas, a 2ª vai de 31 a 60', () => {
    expect(paginacao({ itens: itens(30), pagina: 2, por_pagina: 30, total: 245 })).toEqual({
      pagina: 2,
      totalDePaginas: 9,
      temAnterior: true,
      temProxima: true,
      faixa: { de: 31, ate: 60 },
    });
  });

  it('última página incompleta não tem próxima', () => {
    const p = paginacao({ itens: itens(5), pagina: 9, por_pagina: 30, total: 245 });
    expect(p.temProxima).toBe(false);
    expect(p.faixa).toEqual({ de: 241, ate: 245 });
  });

  it('sem resultados: nenhuma página e sem faixa', () => {
    expect(paginacao({ itens: [], pagina: 1, por_pagina: 30, total: 0 })).toMatchObject({
      totalDePaginas: 0,
      temAnterior: false,
      temProxima: false,
      faixa: null,
    });
  });
});
