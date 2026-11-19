import { generosQueVoceCurte, rotuloMaisConcluidos } from './inicio';

const comGeneros = (generos: string | null) => ({ generos });

describe('generosQueVoceCurte', () => {
  it('escolhe os 2 gêneros mais frequentes da Lista, do mais frequente para o menos', () => {
    const lista = [
      comGeneros('Ação, Drama'),
      comGeneros('Drama, Fantasia'),
      comGeneros('Drama, Ação'),
      comGeneros('Comédia'),
    ];
    const populares = [comGeneros('Esporte, Romance')];

    expect(generosQueVoceCurte(lista, populares)).toEqual(['Drama', 'Ação']);
  });

  it('no empate, a ordem alfabética decide', () => {
    expect(generosQueVoceCurte([comGeneros('Romance, Ação, Drama')], [])).toEqual(['Ação', 'Drama']);
  });

  it('sem Lista, usa os gêneros mais frequentes entre as populares', () => {
    const populares = [comGeneros('Esporte, Romance'), comGeneros('Romance'), comGeneros(null)];

    expect(generosQueVoceCurte([], populares)).toEqual(['Romance', 'Esporte']);
  });

  it('Lista cujas Mídias não têm gênero conta como sem Lista', () => {
    expect(generosQueVoceCurte([comGeneros(null)], [comGeneros('Terror')])).toEqual(['Terror']);
  });

  it('sem gênero em lugar nenhum, nenhum carrossel', () => {
    expect(generosQueVoceCurte([], [])).toEqual([]);
  });
});

describe('rotuloMaisConcluidos', () => {
  it('nomeia pelo verbo do Tipo; com Anime e Mangá juntos, "Mais concluídos"', () => {
    expect(rotuloMaisConcluidos(['jogo'])).toBe('Mais jogados');
    expect(rotuloMaisConcluidos(['anime'])).toBe('Mais assistidos');
    expect(rotuloMaisConcluidos(['manga'])).toBe('Mais lidos');
    expect(rotuloMaisConcluidos(['anime', 'manga'])).toBe('Mais concluídos');
  });
});
