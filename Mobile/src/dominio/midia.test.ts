import { notaDeRanking, notasDaMidia } from './midia';

describe('notasDaMidia', () => {
  it('com Avaliações e Nota da fonte, mostra as duas com rótulos distintos', () => {
    expect(notasDaMidia({ nota_media: 9.25, nota_fonte: 8.4, origem_nota: 'AniList' })).toEqual([
      { rotulo: 'Nota dos Usuários', curto: 'Usuários', valor: '9.3' },
      { rotulo: 'Nota AniList', curto: 'AniList', valor: '8.4' },
    ]);
  });

  it('jogo traz a nota da RAWG', () => {
    expect(notasDaMidia({ nota_media: null, nota_fonte: 9, origem_nota: 'RAWG' })).toEqual([
      { rotulo: 'Nota RAWG', curto: 'RAWG', valor: '9.0' },
    ]);
  });

  it('sem Avaliações, só a Nota da fonte', () => {
    expect(notasDaMidia({ nota_media: null, nota_fonte: 7, origem_nota: 'AniList' }).map((n) => n.rotulo)).toEqual([
      'Nota AniList',
    ]);
  });

  it('sem nenhuma nota, nada', () => {
    expect(notasDaMidia({ nota_media: null, nota_fonte: null, origem_nota: null })).toEqual([]);
    expect(notasDaMidia({ nota_media: null })).toEqual([]);
  });

  it('Nota média 0 é nota', () => {
    expect(notasDaMidia({ nota_media: 0 })).toEqual([{ rotulo: 'Nota dos Usuários', curto: 'Usuários', valor: '0.0' }]);
  });

  it('Nota da fonte sem origem conhecida usa o rótulo genérico', () => {
    expect(notasDaMidia({ nota_media: null, nota_fonte: 6, origem_nota: null })).toEqual([
      { rotulo: 'Nota da fonte', curto: 'Fonte', valor: '6.0' },
    ]);
  });
});

describe('notaDeRanking', () => {
  it('é a Nota média, senão a Nota da fonte, senão null', () => {
    expect(notaDeRanking({ nota_media: 6, nota_fonte: 9 })).toBe(6);
    expect(notaDeRanking({ nota_media: null, nota_fonte: 9.5 })).toBe(9.5);
    expect(notaDeRanking({ nota_media: null, nota_fonte: null })).toBeNull();
  });
});
