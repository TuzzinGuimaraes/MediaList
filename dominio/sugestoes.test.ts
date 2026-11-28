import {
  CHAVE_SUGESTOES,
  consultaDasSugestoes,
  descricaoDaSugestao,
  faixaDasSugestoes,
  formatarNotaDoMotivo,
  pedidoDasSugestoes,
  TEXTOS_DAS_SUGESTOES,
  textoDoMotivo,
} from './sugestoes';
import type { MotivoDaSugestao } from './tipos';

const motivo = (dados: Partial<MotivoDaSugestao>): MotivoDaSugestao => ({
  porque: 'nota',
  nota: null,
  titulo: null,
  ...dados,
});

describe('textoDoMotivo', () => {
  it.each([
    [motivo({ porque: 'nota', nota: 9, titulo: 'Frieren' }), 'porque você deu 9 a Frieren'],
    [motivo({ porque: 'nota', nota: 8.5, titulo: 'Frieren' }), 'porque você deu 8,5 a Frieren'],
    [motivo({ porque: 'favorito', titulo: 'Frieren' }), 'porque Frieren é Favorito'],
    [motivo({ porque: 'em_alta' }), 'Em alta'],
  ])('%j → %s', (m, texto) => {
    expect(textoDoMotivo(m)).toBe(texto);
  });

  it('sem o título ou a nota da semente, cai no Em alta', () => {
    expect(textoDoMotivo(motivo({ porque: 'nota', nota: null, titulo: 'Frieren' }))).toBe('Em alta');
    expect(textoDoMotivo(motivo({ porque: 'favorito', titulo: null }))).toBe('Em alta');
  });
});

describe('formatarNotaDoMotivo', () => {
  it.each([
    [9, '9'],
    [10, '10'],
    [8.5, '8,5'],
  ])('%d → %s', (nota, texto) => {
    expect(formatarNotaDoMotivo(nota)).toBe(texto);
  });
});

describe('descricaoDaSugestao', () => {
  const sugestao = {
    tipo: 'manga' as const,
    titulo_ingles: 'Berserk',
    titulo_romaji: 'Berserk',
    titulo_original: 'ベルセルク',
  };

  it('diz o título exibido, o Tipo e o motivo', () => {
    expect(
      descricaoDaSugestao({ ...sugestao, motivo: motivo({ porque: 'favorito', titulo: 'Vagabond' }) }),
    ).toBe('Berserk, Mangá, porque Vagabond é Favorito');
  });

  it('sem título em inglês, o romanizado', () => {
    expect(
      descricaoDaSugestao({
        ...sugestao,
        tipo: 'anime',
        titulo_ingles: null,
        titulo_romaji: 'Sousou no Frieren',
        motivo: motivo({ porque: 'em_alta' }),
      }),
    ).toBe('Sousou no Frieren, Anime, Em alta');
  });
});

it('o título da faixa', () => {
  expect(TEXTOS_DAS_SUGESTOES.faixa).toBe('Sugestões para você');
});


describe('consultaDasSugestoes', () => {
  it.each([
    [['anime', 'manga'], {}],
    [['manga', 'anime'], {}],
    [['anime', 'manga', 'jogo'], {}],
    [['anime'], { tipo: 'anime' }],
    [['manga', 'jogo'], { tipo: 'manga' }],
  ] as const)('%j → %j', (tipos, consulta) => {
    expect(consultaDasSugestoes(tipos)).toEqual(consulta);
  });

  it('sem anime nem mangá (o Recorte de jogos), não há o que pedir', () => {
    expect(consultaDasSugestoes(['jogo'])).toBeNull();
    expect(consultaDasSugestoes([])).toBeNull();
  });
});


describe('pedidoDasSugestoes', () => {
  it('com sessão e anime e mangá, pede as dos dois, sem `tipo`, sob o prefixo das Sugestões', () => {
    expect(pedidoDasSugestoes(['anime', 'manga'], true)).toEqual({
      ativa: true,
      chave: ['midias', 'sugestoes', null],
      consulta: {},
    });
    expect(pedidoDasSugestoes(['anime', 'manga'], true).chave.slice(0, 2)).toEqual([...CHAVE_SUGESTOES]);
  });

  it('com um Tipo, a consulta e a chave levam esse `tipo`', () => {
    expect(pedidoDasSugestoes(['manga'], true)).toEqual({
      ativa: true,
      chave: ['midias', 'sugestoes', 'manga'],
      consulta: { tipo: 'manga' },
    });
  });

  it('sem sessão ou no Recorte de jogos, fica desligado', () => {
    expect(pedidoDasSugestoes(['anime'], false).ativa).toBe(false);
    expect(pedidoDasSugestoes(['jogo'], true)).toEqual({
      ativa: false,
      chave: ['midias', 'sugestoes', null],
      consulta: {},
    });
  });
});

describe('faixaDasSugestoes', () => {
  const resultado = (dados: Partial<{ data: string[]; isError: boolean; isPending: boolean }>) => ({
    data: undefined,
    isError: false,
    isPending: false,
    ...dados,
  });

  it('desligada, conta como pronta e vazia', () => {
    expect(faixaDasSugestoes(false, resultado({ isPending: true }))).toEqual({ sugestoes: [], pendente: false });
  });

  it('ligada, enquanto espera, fica pendente e sem lista', () => {
    expect(faixaDasSugestoes(true, resultado({ isPending: true }))).toEqual({ sugestoes: undefined, pendente: true });
  });

  it('ligada, com resposta, devolve as Sugestões', () => {
    expect(faixaDasSugestoes(true, resultado({ data: ['a'] }))).toEqual({ sugestoes: ['a'], pendente: false });
  });

  it('com erro, a faixa só some', () => {
    expect(faixaDasSugestoes(true, resultado({ isError: true }))).toEqual({ sugestoes: [], pendente: false });
  });
});
