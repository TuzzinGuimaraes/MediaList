import {
  carrosselDeRelacoes,
  chaveDaRelacao,
  descricaoDaRelacao,
  destinoDaRelacao,
  LIMITE_DE_JOGOS,
  linkDaFonte,
  nomeDaRelacao,
  ordenarRelacoes,
  sugestoesDeSequencia,
  TEXTOS_DAS_RELACOES,
} from './relacoes';
import type { RelacaoDaMidia } from './tipos';

function relacao(titulo: string, dados: Partial<RelacaoDaMidia> = {}): RelacaoDaMidia {
  return {
    relacao: 'SEQUEL',
    tipo: 'anime',
    titulo,
    poster_url: null,
    data_lancamento: null,
    id_midia: `id-${titulo}`,
    link_fonte: null,
    status_consumo: null,
    ...dados,
  };
}

const titulos = (relacoes: readonly RelacaoDaMidia[]) => relacoes.map((r) => r.titulo);

describe('nomeDaRelacao', () => {
  it.each([
    ['PREQUEL', 'anime', 'Prequel'],
    ['SEQUEL', 'anime', 'Sequência'],
    ['ADAPTATION', 'manga', 'Adaptação · mangá'],
    ['ADAPTATION', 'anime', 'Adaptação · anime'],
    ['SOURCE', 'manga', 'Original · mangá'],
    ['PARENT', 'anime', 'Principal'],
    ['SIDE_STORY', 'anime', 'História paralela'],
    ['SPIN_OFF', 'manga', 'Spin-off'],
    ['ALTERNATIVE', 'anime', 'Versão alternativa'],
    ['SUMMARY', 'anime', 'Resumo'],
    ['COMPILATION', 'anime', 'Compilação'],
    ['CONTAINS', 'manga', 'Contém'],
    ['SAME_UNIVERSE', 'anime', 'Mesmo universo'],
    ['MESMA_SERIE', 'jogo', 'Mesma série'],
  ] as const)('%s de %s: %s', (nome, tipo, esperado) => {
    expect(nomeDaRelacao({ relacao: nome, tipo })).toBe(esperado);
  });
});

describe('descricaoDaRelacao', () => {
  it('diz a Relação, o título, o Tipo e o Estado do Usuário', () => {
    expect(descricaoDaRelacao(relacao('Frieren 2', { status_consumo: 'completo' }))).toBe(
      'Sequência: Frieren 2, Anime, Concluído',
    );
  });

  it('sem Item na Lista, sem o Estado; fora do Catálogo, avisa', () => {
    expect(descricaoDaRelacao(relacao('Frieren 2'))).toBe('Sequência: Frieren 2, Anime');
    expect(
      descricaoDaRelacao(relacao('Mangá', { relacao: 'SOURCE', tipo: 'manga', id_midia: null, link_fonte: 'https://anilist.co/manga/1' })),
    ).toBe('Original · mangá: Mangá, Mangá, fora do Catálogo');
  });
});

describe('linkDaFonte', () => {
  it('fora do Catálogo, o link https da fonte', () => {
    expect(linkDaFonte(relacao('X', { id_midia: null, link_fonte: 'https://anilist.co/anime/9' }))).toBe(
      'https://anilist.co/anime/9',
    );
  });

  it.each([
    ['http', 'http://anilist.co/anime/9'],
    ['javascript', 'javascript:alert(1)'],
    ['relativo', '/midia/1'],
    ['sem link', null],
  ])('%s: nenhum', (_, link) => {
    expect(linkDaFonte(relacao('X', { id_midia: null, link_fonte: link }))).toBeNull();
  });

  it('no Catálogo, nenhum (o cartão abre o Detalhe)', () => {
    expect(linkDaFonte(relacao('X', { link_fonte: 'https://anilist.co/anime/9' }))).toBeNull();
  });
});

describe('destinoDaRelacao', () => {
  it('no Catálogo, o Detalhe (mesmo com link da fonte)', () => {
    expect(destinoDaRelacao(relacao('X', { id_midia: 'm1', link_fonte: 'https://anilist.co/anime/9' }))).toEqual({
      abre: 'detalhe',
      idMidia: 'm1',
    });
  });

  it('fora do Catálogo com link https, o link', () => {
    expect(destinoDaRelacao(relacao('X', { id_midia: null, link_fonte: 'https://anilist.co/anime/9' }))).toEqual({
      abre: 'link',
      link: 'https://anilist.co/anime/9',
    });
  });

  it.each([
    ['http', 'http://anilist.co/anime/9'],
    ['javascript', 'javascript:alert(1)'],
    ['sem link', null],
  ])('fora do Catálogo, %s: nada', (_, link) => {
    expect(destinoDaRelacao(relacao('X', { id_midia: null, link_fonte: link }))).toBeNull();
  });
});

describe('chaveDaRelacao', () => {
  it('a Relação e a Mídia, ou o link, ou o título', () => {
    expect(chaveDaRelacao(relacao('X', { id_midia: 'm1' }))).toBe('SEQUEL-m1');
    expect(chaveDaRelacao(relacao('X', { relacao: 'SOURCE', id_midia: null, link_fonte: 'https://a.co/1' }))).toBe(
      'SOURCE-https://a.co/1',
    );
    expect(chaveDaRelacao(relacao('X', { id_midia: null }))).toBe('SEQUEL-X');
  });
});

describe('ordenarRelacoes', () => {
  it('Prequel e Sequência primeiro, depois os outros grupos; cada grupo por lançamento, sem data no fim', () => {
    const relacoes = [
      relacao('Spin-off', { relacao: 'SPIN_OFF', data_lancamento: '2010-01-01' }),
      relacao('Sequência 2', { data_lancamento: '2022-01-01' }),
      relacao('Adaptação', { relacao: 'ADAPTATION', tipo: 'manga', data_lancamento: '2001-01-01' }),
      relacao('Sequência sem data'),
      relacao('Prequel', { relacao: 'PREQUEL', data_lancamento: '2015-01-01' }),
      relacao('Sequência 1', { data_lancamento: '2020-01-01' }),
      relacao('Original', { relacao: 'SOURCE', tipo: 'manga', data_lancamento: '1999-01-01' }),
    ];

    expect(titulos(ordenarRelacoes(relacoes))).toEqual([
      'Prequel',
      'Sequência 1',
      'Sequência 2',
      'Sequência sem data',
      'Adaptação',
      'Original',
      'Spin-off',
    ]);
  });

  it('não muda a lista recebida', () => {
    const relacoes = [relacao('B', { relacao: 'SUMMARY' }), relacao('A', { relacao: 'PREQUEL' })];

    ordenarRelacoes(relacoes);

    expect(titulos(relacoes)).toEqual(['B', 'A']);
  });
});

describe('carrosselDeRelacoes', () => {
  const jogo = (ano: number | null) =>
    relacao(ano === null ? 'sem data' : `${ano}`, {
      relacao: 'MESMA_SERIE',
      tipo: 'jogo',
      data_lancamento: ano === null ? null : `${ano}-06-01`,
    });

  it('anime e mangá: todas, na ordem, sem "e mais"', () => {
    const relacoes = Array.from({ length: 15 }, (_, i) => relacao(`S${i}`, { data_lancamento: `${2000 + i}-01-01` }));

    const carrossel = carrosselDeRelacoes(relacoes, { tipo: 'anime', data_lancamento: '2005-01-01' });

    expect(carrossel.cartoes).toHaveLength(15);
    expect(carrossel.mais).toBe(0);
  });

  it('jogos: os 12 mais próximos por data do jogo atual, em ordem de lançamento, e quantos ficaram de fora', () => {
    // Mesma série de 1985 a 2024, um por ano, mais um sem data; o jogo atual é de 2017.
    const serie = [...Array.from({ length: 40 }, (_, i) => jogo(1985 + i)), jogo(null)];

    const carrossel = carrosselDeRelacoes(serie, { tipo: 'jogo', data_lancamento: '2017-03-03' });

    expect(LIMITE_DE_JOGOS).toBe(12);
    expect(titulos(carrossel.cartoes)).toEqual([
      '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022',
    ]);
    expect(carrossel.mais).toBe(29);
  });

  it('jogos: perto do fim da série, os mais próximos são os anteriores', () => {
    const serie = Array.from({ length: 20 }, (_, i) => jogo(2000 + i));

    const carrossel = carrosselDeRelacoes(serie, { tipo: 'jogo', data_lancamento: '2019-12-01' });

    expect(titulos(carrossel.cartoes)).toEqual(Array.from({ length: 12 }, (_, i) => `${2008 + i}`));
    expect(carrossel.mais).toBe(8);
  });

  it('jogos sem data no atual: os 12 primeiros por lançamento', () => {
    const serie = [jogo(null), ...Array.from({ length: 14 }, (_, i) => jogo(2000 + i))];

    const carrossel = carrosselDeRelacoes(serie, { tipo: 'jogo', data_lancamento: null });

    expect(titulos(carrossel.cartoes)).toEqual(Array.from({ length: 12 }, (_, i) => `${2000 + i}`));
    expect(carrossel.mais).toBe(3);
  });

  it('jogos até 12: todos, sem "e mais"', () => {
    const carrossel = carrosselDeRelacoes([jogo(2001), jogo(null), jogo(1999)], { tipo: 'jogo', data_lancamento: '2000-01-01' });

    expect(titulos(carrossel.cartoes)).toEqual(['1999', '2001', 'sem data']);
    expect(carrossel.mais).toBe(0);
  });
});

describe('sugestoesDeSequencia', () => {
  const concluido = { status_consumo: 'completo' };

  it('anime Concluído: cada Sequência fora da Lista, lançada ou não, com a ação só no Catálogo', () => {
    const relacoes = [
      relacao('Na Lista', { status_consumo: 'planejado' }),
      relacao('Lançada', { data_lancamento: '2020-01-01' }),
      relacao('Ainda não estreou', { data_lancamento: '2099-01-01' }),
      relacao('Fora do Catálogo', { id_midia: null, link_fonte: 'https://anilist.co/anime/9' }),
      relacao('Prequel', { relacao: 'PREQUEL' }),
      relacao('Spin-off', { relacao: 'SPIN_OFF' }),
    ];

    const sugestoes = sugestoesDeSequencia({ tipo: 'anime' }, concluido, relacoes);

    expect(sugestoes.map((s) => [s.relacao.titulo, s.planejavel])).toEqual([
      ['Lançada', true],
      ['Ainda não estreou', true],
      ['Fora do Catálogo', false],
    ]);
  });

  it('mangá Concluído (lido) também sugere; a Sequência pode ser de outro Tipo', () => {
    const sugestoes = sugestoesDeSequencia({ tipo: 'manga' }, { status_consumo: 'lido' }, [
      relacao('Continuação', { tipo: 'manga' }),
    ]);

    expect(sugestoes.map((s) => s.relacao.titulo)).toEqual(['Continuação']);
  });

  it.each([
    ['sem Item', null],
    ['Em progresso', { status_consumo: 'assistindo' }],
    ['Planejado', { status_consumo: 'planejado' }],
    ['Abandonado', { status_consumo: 'abandonado' }],
  ])('anime %s: nada', (_, item) => {
    expect(sugestoesDeSequencia({ tipo: 'anime' }, item, [relacao('S2')])).toEqual([]);
  });

  it('jogo nunca sugere', () => {
    const serie = [relacao('Próximo', { relacao: 'MESMA_SERIE', tipo: 'jogo' })];

    expect(sugestoesDeSequencia({ tipo: 'jogo' }, { status_consumo: 'zerado' }, serie)).toEqual([]);
    expect(sugestoesDeSequencia({ tipo: 'jogo' }, { status_consumo: 'platinado' }, serie)).toEqual([]);
  });
});


describe('TEXTOS_DAS_RELACOES', () => {
  it('"e mais N"', () => {
    expect(TEXTOS_DAS_RELACOES.mais(29)).toBe('e mais 29');
  });
});
