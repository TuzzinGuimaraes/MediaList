import { contagemDeEpisodios, notaDeRanking, notasDaMidia, outrosTitulos, tituloDaMidia } from './midia';

describe('contagemDeEpisodios', () => {
  it.each([
    [0, 'nenhum episódio'],
    [1, '1 episódio'],
    [3, '3 episódios'],
  ])('%i: %s', (n, texto) => {
    expect(contagemDeEpisodios(n)).toBe(texto);
  });
});

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
  });

  it('Nota média 0 é nota', () => {
    expect(notasDaMidia({ nota_media: 0, nota_fonte: null, origem_nota: null })).toEqual([{ rotulo: 'Nota dos Usuários', curto: 'Usuários', valor: '0.0' }]);
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

describe('tituloDaMidia', () => {
  const fma = { titulo_ingles: 'Fullmetal Alchemist: Brotherhood', titulo_romaji: 'Hagane no Renkinjutsushi', titulo_original: '鋼の錬金術師' };

  it('é o inglês', () => {
    expect(tituloDaMidia(fma)).toBe('Fullmetal Alchemist: Brotherhood');
  });

  it('sem inglês, o romanizado', () => {
    expect(tituloDaMidia({ ...fma, titulo_ingles: null })).toBe('Hagane no Renkinjutsushi');
    expect(tituloDaMidia({ ...fma, titulo_ingles: '' })).toBe('Hagane no Renkinjutsushi');
  });

  it('sem os dois, o original', () => {
    expect(tituloDaMidia({ titulo_ingles: null, titulo_romaji: '', titulo_original: '鋼の錬金術師' })).toBe('鋼の錬金術師');
  });
});

describe('outrosTitulos', () => {
  const midia = (titulo_ingles: string | null, titulo_romaji: string | null, titulo_original: string) => ({
    titulo_ingles,
    titulo_romaji,
    titulo_original,
  });

  it('com o inglês principal, o romanizado e o japonês, nessa ordem', () => {
    expect(outrosTitulos(midia("Frieren: Beyond Journey's End", 'Sousou no Frieren', '葬送のフリーレン'))).toEqual([
      'Sousou no Frieren',
      '葬送のフリーレン',
    ]);
  });

  it('sem inglês, só o japonês', () => {
    expect(outrosTitulos(midia(null, 'Sousou no Frieren', '葬送のフリーレン'))).toEqual(['葬送のフリーレン']);
  });

  it('sem repetir o principal nem um igual ao outro', () => {
    expect(outrosTitulos(midia('Hollow Knight', 'Hollow Knight', 'Hollow Knight'))).toEqual([]);
    expect(outrosTitulos(midia('Steins;Gate', 'Steins;Gate', 'STEINS;GATE'))).toEqual(['STEINS;GATE']);
    expect(outrosTitulos(midia('', 'Hollow Knight', ''))).toEqual([]);
  });
});
