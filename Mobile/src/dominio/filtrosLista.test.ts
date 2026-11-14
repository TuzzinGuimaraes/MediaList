import { buscarNaLista, FILTROS_PADRAO, filtrosAtivos, opcoesDosFiltros, organizarLista, porTipo } from './filtrosLista';

type Dados = Partial<{
  titulo_portugues: string | null;
  titulo_original: string;
  titulo_ingles: string | null;
  tipo: 'anime' | 'manga' | 'jogo';
  generos_lista: string[];
  status_anime: string | null;
  status_manga: string | null;
  status_jogo: string | null;
  nota_usuario: number | null;
  data_adicao: string | null;
  data_atualizacao: string | null;
}>;

let seq = 0;
function item(id: string, dados: Dados = {}) {
  seq += 1;
  return {
    id_lista: id,
    tipo: 'anime' as const,
    titulo_original: id,
    titulo_portugues: null,
    titulo_ingles: null,
    generos_lista: [],
    status_anime: null,
    status_manga: null,
    status_jogo: null,
    nota_usuario: null,
    data_adicao: `2026-01-${String(seq).padStart(2, '0')}T10:00:00+00:00`,
    data_atualizacao: null,
    ...dados,
  };
}

const ids = (itens: { id_lista: string }[]) => itens.map((i) => i.id_lista);

describe('organizarLista: filtros', () => {
  it('Gênero deixa só os Itens que têm o gênero', () => {
    const itens = [
      item('a', { generos_lista: ['Ação', 'Drama'] }),
      item('b', { generos_lista: ['Comédia'] }),
      item('c', { generos_lista: ['Drama'] }),
    ];
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, genero: 'Drama' }))).toEqual(['a', 'c']);
    expect(ids(organizarLista(itens, FILTROS_PADRAO))).toEqual(['a', 'b', 'c']);
  });

  it('Situação lê o status de lançamento do Tipo de cada Item', () => {
    const itens = [
      item('a', { tipo: 'anime', status_anime: 'finalizado' }),
      item('b', { tipo: 'manga', status_manga: 'finalizado' }),
      item('c', { tipo: 'anime', status_anime: 'em_exibicao' }),
      // Campo de outro Tipo não conta.
      item('d', { tipo: 'manga', status_anime: 'finalizado', status_manga: 'hiato' }),
      item('e', { tipo: 'jogo', status_jogo: 'lancado' }),
    ];
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, situacao: 'finalizado' }))).toEqual(['a', 'b']);
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, situacao: 'lancado' }))).toEqual(['e']);
  });

  it('Gênero e Situação se somam', () => {
    const itens = [
      item('a', { generos_lista: ['Drama'], status_anime: 'finalizado' }),
      item('b', { generos_lista: ['Drama'], status_anime: 'em_exibicao' }),
      item('c', { generos_lista: ['Ação'], status_anime: 'finalizado' }),
    ];
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, genero: 'Drama', situacao: 'finalizado' }))).toEqual(['a']);
  });
});


describe('organizarLista: Ordem', () => {
  it('padrão é alfabética pelo título exibido, sem caixa; id_lista desempata', () => {
    const itens = [
      item('z1', { titulo_portugues: 'banana' }),
      item('a2', { titulo_portugues: null, titulo_original: 'Abacaxi' }),
      item('c3', { titulo_portugues: 'Caju' }),
      item('b0', { titulo_portugues: 'banana' }),
    ];
    expect(ids(organizarLista(itens, FILTROS_PADRAO))).toEqual(['a2', 'b0', 'z1', 'c3']);
  });

  it('Nota pessoal: maior primeiro, sem nota no fim, alfabética no empate', () => {
    const itens = [
      item('a', { titulo_portugues: 'A', nota_usuario: null }),
      item('b', { titulo_portugues: 'B', nota_usuario: 7.5 }),
      item('c', { titulo_portugues: 'C', nota_usuario: 9 }),
      item('d', { titulo_portugues: 'D', nota_usuario: 7.5 }),
      item('e', { titulo_portugues: 'E', nota_usuario: 0 }),
    ];
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, ordem: 'nota' }))).toEqual(['c', 'b', 'd', 'e', 'a']);
  });

  it('adicionado e atualizado recentemente: o mais novo primeiro', () => {
    const itens = [
      item('a', { titulo_portugues: 'A', data_adicao: '2026-03-01T10:00:00+00:00', data_atualizacao: '2026-11-01T08:00:00+00:00' }),
      item('b', { titulo_portugues: 'B', data_adicao: '2026-05-01T10:00:00+00:00', data_atualizacao: '2026-05-01T10:00:00+00:00' }),
      item('c', { titulo_portugues: 'C', data_adicao: '2026-01-01T10:00:00+00:00', data_atualizacao: '2026-11-01T09:30:00+00:00' }),
    ];
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, ordem: 'adicao' }))).toEqual(['b', 'a', 'c']);
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, ordem: 'atualizacao' }))).toEqual(['c', 'a', 'b']);
  });

  it('não muda a ordem de quem chamou', () => {
    const itens = [item('b', { titulo_portugues: 'B' }), item('a', { titulo_portugues: 'A' })];
    organizarLista(itens, FILTROS_PADRAO);
    expect(ids(itens)).toEqual(['b', 'a']);
  });
});


describe('buscarNaLista', () => {
  const itens = [
    item('a', { titulo_portugues: 'Sousou no Frieren', titulo_original: '葬送のフリーレン', titulo_ingles: "Frieren: Beyond Journey's End" }),
    item('b', { titulo_portugues: null, titulo_original: 'Shingeki no Kyojin', titulo_ingles: 'Attack on Titan' }),
    item('c', { titulo_portugues: 'Pokémon', titulo_original: 'Pocket Monsters' }),
  ];

  it('acha pelo trecho de qualquer título, sem caixa nem acento, na ordem recebida', () => {
    expect(ids(buscarNaLista(itens, 'frie'))).toEqual(['a']);
    expect(ids(buscarNaLista(itens, 'TITAN'))).toEqual(['b']);
    expect(ids(buscarNaLista(itens, 'pokemon'))).toEqual(['c']);
    expect(ids(buscarNaLista(itens, 'フリー'))).toEqual(['a']);
    expect(ids(buscarNaLista(itens, ' no '))).toEqual(['a', 'b']);
  });

  it('termo só de espaços acha tudo; termo sem par acha nada', () => {
    expect(ids(buscarNaLista(itens, '   '))).toEqual(['a', 'b', 'c']);
    expect(buscarNaLista(itens, 'zelda')).toEqual([]);
  });
});


describe('opções e contador do sheet', () => {
  it('gêneros e Situações vêm dos Itens, sem repetir, em ordem alfabética', () => {
    const itens = [
      item('a', { generos_lista: ['Drama', 'Ação'], status_anime: 'finalizado' }),
      item('b', { tipo: 'manga', generos_lista: ['Ação', 'Comédia'], status_manga: 'em_publicacao' }),
      item('c', { generos_lista: [], status_anime: 'finalizado' }),
      item('d', { tipo: 'manga', status_manga: null }),
    ];
    expect(opcoesDosFiltros(itens)).toEqual({
      generos: ['Ação', 'Comédia', 'Drama'],
      situacoes: [
        { valor: 'em_publicacao', titulo: 'Em publicação' },
        { valor: 'finalizado', titulo: 'Finalizado' },
      ],
    });
  });

  it('Situação desconhecida aparece com o valor cru', () => {
    expect(opcoesDosFiltros([item('a', { status_anime: 'novo_valor' })]).situacoes).toEqual([
      { valor: 'novo_valor', titulo: 'novo_valor' },
    ]);
  });

  it('o contador soma Gênero, Situação e Ordem fora do padrão', () => {
    expect(filtrosAtivos(FILTROS_PADRAO)).toBe(0);
    expect(filtrosAtivos({ genero: 'Drama', situacao: null, ordem: 'titulo' })).toBe(1);
    expect(filtrosAtivos({ genero: 'Drama', situacao: 'finalizado', ordem: 'nota' })).toBe(3);
  });
});


describe('porTipo', () => {
  it('separa por Tipo na ordem do catálogo e omite Tipo sem Item', () => {
    const itens = [item('a', { tipo: 'manga' }), item('b', { tipo: 'anime' }), item('c', { tipo: 'manga' })];
    expect(porTipo(itens, ['anime', 'manga']).map((s) => [s.tipo, ids(s.itens)])).toEqual([
      ['anime', ['b']],
      ['manga', ['a', 'c']],
    ]);
    expect(porTipo([item('a', { tipo: 'manga' })], ['anime', 'manga']).map((s) => s.tipo)).toEqual(['manga']);
  });

  it('catálogo de um Tipo só não tem subseção', () => {
    const itens = [item('a', { tipo: 'jogo' }), item('b', { tipo: 'jogo' })];
    expect(porTipo(itens, ['jogo'])).toEqual([{ tipo: null, itens }]);
  });
});
