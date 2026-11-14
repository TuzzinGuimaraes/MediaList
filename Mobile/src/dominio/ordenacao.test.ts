import { decrescente } from './ordenacao';

describe('decrescente', () => {
  it('ordena do maior para o menor, com null no fim, em números e datas ISO', () => {
    const notas = [{ v: 3 }, { v: null }, { v: 9 }, { v: 5 }];
    expect(notas.sort(decrescente((x) => x.v)).map((x) => x.v)).toEqual([9, 5, 3, null]);

    const datas = [{ v: '2024-01-01' }, { v: null }, { v: '2025-06-30' }];
    expect(datas.sort(decrescente((x) => x.v)).map((x) => x.v)).toEqual(['2025-06-30', '2024-01-01', null]);
  });
});
