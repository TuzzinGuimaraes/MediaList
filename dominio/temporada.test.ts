import {
  anterior,
  proxima,
  rotuloDaTemporada,
  secoesDaTemporada,
  seloDeEstimativa,
  temporadaDe,
  temporadasDoSeletor,
  type Temporada,
} from './temporada';

const t = (estacao: Temporada['estacao'], ano: number): Temporada => ({ estacao, ano });

describe('temporadaDe', () => {
  it.each([
    [new Date(2027, 0, 1, 0, 0), t('inverno', 2027)],
    [new Date(2027, 2, 31, 23, 59), t('inverno', 2027)],
    [new Date(2027, 3, 1), t('primavera', 2027)],
    [new Date(2027, 5, 30), t('primavera', 2027)],
    [new Date(2027, 6, 1), t('verao', 2027)],
    [new Date(2027, 8, 30), t('verao', 2027)],
    [new Date(2026, 9, 1), t('outono', 2026)],
    [new Date(2026, 11, 31, 23, 59), t('outono', 2026)],
  ])('%s cai em %o', (data, esperada) => {
    expect(temporadaDe(data)).toEqual(esperada);
  });
});

describe('anterior e próxima', () => {
  it('viram o ano entre o outono e o inverno', () => {
    expect(proxima(t('outono', 2026))).toEqual(t('inverno', 2027));
    expect(anterior(t('inverno', 2027))).toEqual(t('outono', 2026));
  });

  it('andam uma estação dentro do ano', () => {
    expect(proxima(t('inverno', 2027))).toEqual(t('primavera', 2027));
    expect(anterior(t('outono', 2027))).toEqual(t('verao', 2027));
  });
});

describe('temporadasDoSeletor', () => {
  const agora = new Date(2026, 10, 28);

  it('vai da mais antiga do Catálogo até 4 depois da atual, em ordem', () => {
    expect(temporadasDoSeletor(t('primavera', 2026), agora)).toEqual([
      t('primavera', 2026),
      t('verao', 2026),
      t('outono', 2026),
      t('inverno', 2027),
      t('primavera', 2027),
      t('verao', 2027),
      t('outono', 2027),
    ]);
  });

  it('atravessa anos inteiros desde a mais antiga', () => {
    const seletor = temporadasDoSeletor(t('outono', 1990), agora);
    expect(seletor[0]).toEqual(t('outono', 1990));
    expect(seletor[1]).toEqual(t('inverno', 1991));
    expect(seletor).toHaveLength(1 + (2026 - 1990) * 4 + 4);
    expect(seletor[seletor.length - 1]).toEqual(t('outono', 2027));
  });

  it('sem Temporada no Catálogo, ou com a mais antiga no futuro, começa na atual', () => {
    const daAtual = [t('outono', 2026), t('inverno', 2027), t('primavera', 2027), t('verao', 2027), t('outono', 2027)];
    expect(temporadasDoSeletor(null, agora)).toEqual(daAtual);
    expect(temporadasDoSeletor(t('verao', 2027), agora)).toEqual(daAtual);
  });

  it('na virada do ano, as 4 à frente já são do ano seguinte', () => {
    expect(temporadasDoSeletor(null, new Date(2027, 0, 1))).toEqual([
      t('inverno', 2027),
      t('primavera', 2027),
      t('verao', 2027),
      t('outono', 2027),
      t('inverno', 2028),
    ]);
  });
});

describe('rotuloDaTemporada', () => {
  it.each([
    [t('inverno', 2027), 'Inverno 2027'],
    [t('primavera', 2027), 'Primavera 2027'],
    [t('verao', 2027), 'Verão 2027'],
    [t('outono', 2026), 'Outono 2026'],
  ])('%o vira %s, sem os meses', (temporada, rotulo) => {
    expect(rotuloDaTemporada(temporada)).toBe(rotulo);
  });
});

describe('secoesDaTemporada', () => {
  it('séries e formato desconhecido na grade; filmes, especiais, OVAs e clipes à parte, na ordem que vieram', () => {
    const animes = [
      { id: 1, formato: 'MOVIE' },
      { id: 2, formato: 'TV' },
      { id: 3, formato: 'SPECIAL' },
      { id: 4, formato: 'TV_SHORT' },
      { id: 5, formato: 'OVA' },
      { id: 6, formato: 'ONA' },
      { id: 7, formato: null },
      { id: 8, formato: 'MUSIC' },
    ] as const;

    const { principal, filmesEEspeciais } = secoesDaTemporada(animes);

    expect(principal.map((a) => a.id)).toEqual([2, 4, 6, 7]);
    expect(filmesEEspeciais.map((a) => a.id)).toEqual([1, 3, 5, 8]);
  });
});

describe('seloDeEstimativa', () => {
  it('só aparece na Temporada estimada, com a explicação', () => {
    expect(seloDeEstimativa({ temporada_estimada: true })).toEqual({
      texto: 'temporada estimada',
      explicacao: 'pela data de estreia; pode estar errada',
    });
    expect(seloDeEstimativa({ temporada_estimada: false })).toBeNull();
    expect(seloDeEstimativa({ temporada_estimada: null })).toBeNull();
  });
});
