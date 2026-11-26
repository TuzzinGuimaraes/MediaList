import {
  anterior,
  animesDaTemporada,
  consultaDaTemporada,
  MAX_PAGINAS_DA_TEMPORADA,
  ORDEM_PADRAO_DA_TEMPORADA,
  ordemDaTemporada,
  ORDENS_DA_TEMPORADA,
  POR_PAGINA_DA_TEMPORADA,
  proxima,
  temporadaDosParametros,
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

describe('ordens da Temporada', () => {
  it('são os mais esperados (o padrão), a estreia e a Nota da fonte', () => {
    expect(ORDENS_DA_TEMPORADA).toEqual([
      { valor: 'popularidade_fonte', rotulo: 'Mais esperados' },
      { valor: 'estreia', rotulo: 'Estreia' },
      { valor: 'nota_fonte', rotulo: 'Nota da fonte' },
    ]);
    expect(ORDEM_PADRAO_DA_TEMPORADA).toBe('popularidade_fonte');
  });

  it.each([
    ['estreia', 'estreia'],
    ['nota_fonte', 'nota_fonte'],
    ['nota_media', 'popularidade_fonte'],
    [undefined, 'popularidade_fonte'],
    [['estreia'], 'popularidade_fonte'],
  ])('%o vale %s', (valor, ordem) => {
    expect(ordemDaTemporada(valor)).toBe(ordem);
  });
});

describe('temporadaDosParametros', () => {
  const agora = new Date(2026, 10, 28);

  it.each([
    [{ estacao: 'verao', ano: '2027' }, t('verao', 2027)],
    [{ estacao: 'inverno', ano: 1990 }, t('inverno', 1990)],
    [{ estacao: 'outono', ano: '1900' }, t('outono', 1900)],
  ])('lê %o', (parametros, temporada) => {
    expect(temporadaDosParametros(parametros, agora)).toEqual(temporada);
  });

  it.each([
    [{}],
    [{ estacao: 'verao' }],
    [{ ano: '2027' }],
    [{ estacao: 'moncao', ano: '2027' }],
    [{ estacao: 'verao', ano: '1899' }],
    [{ estacao: 'verao', ano: '20270' }],
    [{ estacao: 'verao', ano: '2027.5' }],
    [{ estacao: 'verao', ano: 2027.5 }],
    [{ estacao: 'verao', ano: 'abc' }],
  ])('inválido (%o) volta para a atual', (parametros) => {
    expect(temporadaDosParametros(parametros, agora)).toEqual(t('outono', 2026));
  });
});

describe('animesDaTemporada', () => {
  const paginas = (total: number) => (pagina: number) =>
    Promise.resolve({
      itens: Array.from({ length: Math.max(0, Math.min(POR_PAGINA_DA_TEMPORADA, total - (pagina - 1) * POR_PAGINA_DA_TEMPORADA)) }, (_, i) => (pagina - 1) * POR_PAGINA_DA_TEMPORADA + i),
      pagina,
      por_pagina: POR_PAGINA_DA_TEMPORADA,
      total,
    });

  /** A busca e as páginas que ela recebeu. */
  function registrando<T>(buscar: (pagina: number) => Promise<T>) {
    const pedidas: number[] = [];
    return { pedidas, buscar: (pagina: number) => (pedidas.push(pagina), buscar(pagina)) };
  }

  it('a consulta de uma página é a da Temporada, na ordem, com o máximo por página', () => {
    expect(consultaDaTemporada(t('outono', 2026), 'estreia', 2)).toEqual({
      tipo: 'anime',
      temporada_estacao: 'outono',
      temporada_ano: 2026,
      ordem: 'estreia',
      pagina: 2,
      por_pagina: 50,
    });
  });

  it.each([
    [0, [1]],
    [50, [1]],
    [51, [1, 2]],
    [120, [1, 2, 3]],
  ])('com %i animes, pede as páginas %o e junta todos', async (total, pedidas) => {
    const { buscar, pedidas: feitas } = registrando(paginas(total));
    const animes = await animesDaTemporada(buscar);
    expect(feitas).toEqual(pedidas);
    expect(animes).toHaveLength(total);
  });

  it('para numa página vazia, mesmo com o total maior', async () => {
    const { buscar, pedidas } = registrando((pagina) => Promise.resolve({ itens: pagina === 1 ? [1] : [], pagina, por_pagina: 1, total: 5 }));
    expect(await animesDaTemporada(buscar)).toEqual([1]);
    expect(pedidas).toEqual([1, 2]);
  });

  it(`não passa de ${MAX_PAGINAS_DA_TEMPORADA} páginas com um total errado`, async () => {
    const { buscar, pedidas } = registrando(paginas(10_000));
    await animesDaTemporada(buscar);
    expect(pedidas).toHaveLength(MAX_PAGINAS_DA_TEMPORADA);
  });
});
