import { distribuicaoDeNotas, formatarMedia, maisFrequentes, plataformasDoItem } from './estatisticas';

describe('distribuicaoDeNotas', () => {
  it('conta as Notas pessoais de 1 a 10, arredondadas, ignorando os Itens sem nota', () => {
    const contagem = distribuicaoDeNotas([
      { nota_usuario: 8 },
      { nota_usuario: 7.5 },
      { nota_usuario: 10 },
      { nota_usuario: null },
      { nota_usuario: 1.2 },
    ]);

    expect(contagem).toEqual([
      { nota: 1, total: 1 },
      { nota: 2, total: 0 },
      { nota: 3, total: 0 },
      { nota: 4, total: 0 },
      { nota: 5, total: 0 },
      { nota: 6, total: 0 },
      { nota: 7, total: 0 },
      { nota: 8, total: 2 },
      { nota: 9, total: 0 },
      { nota: 10, total: 1 },
    ]);
  });

  it('sem notas, todas as faixas ficam em zero', () => {
    expect(distribuicaoDeNotas([]).every((f) => f.total === 0)).toBe(true);
  });
});

describe('maisFrequentes', () => {
  it('conta cada termo uma vez por Item, do mais frequente para o menos; empate em ordem alfabética', () => {
    const termos = maisFrequentes([['Ação', 'Drama'], ['Drama', 'Comédia'], ['Ação', 'Drama'], []]);

    expect(termos).toEqual([
      { nome: 'Drama', total: 3 },
      { nome: 'Ação', total: 2 },
      { nome: 'Comédia', total: 1 },
    ]);
  });

  it('respeita o limite e ignora termos vazios ou repetidos no mesmo Item', () => {
    expect(maisFrequentes([['A', ' ', 'A'], ['B'], ['C']], 2)).toEqual([
      { nome: 'A', total: 1 },
      { nome: 'B', total: 1 },
    ]);
  });
});

describe('plataformasDoItem', () => {
  it('separa as plataformas que a API manda em texto', () => {
    expect(plataformasDoItem({ plataformas: 'PC, Switch ,PlayStation 5' })).toEqual(['PC', 'Switch', 'PlayStation 5']);
  });

  it('sem plataformas, nenhuma', () => {
    expect(plataformasDoItem({ plataformas: null })).toEqual([]);
  });
});

describe('formatarMedia', () => {
  it('uma casa, com vírgula', () => {
    expect(formatarMedia(7.25)).toBe('7,3');
    expect(formatarMedia(8)).toBe('8,0');
  });

  it('sem média, um traço', () => {
    expect(formatarMedia(null)).toBe('—');
  });
});
