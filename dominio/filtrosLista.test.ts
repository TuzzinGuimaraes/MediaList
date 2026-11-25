import {
  buscarNaLista,
  contagemPorTipo,
  crescente,
  doTipo,
  FILTROS_PADRAO,
  filtrosAtivos,
  filtrosEfetivos,
  filtrosRestringem,
  generosPorFrequencia,
  opcoesDosFiltros,
  ORDENS_DA_LISTA,
  organizarLista,
  porTipo,
  secoesPorStatus,
  tiposDoFiltro,
} from './filtrosLista';

type Dados = Partial<{
  progresso_atual: number | null;
  status_consumo: string;
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
    progresso_atual: null,
    status_consumo: 'assistindo',
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

describe('filtrosEfetivos e filtrosRestringem', () => {
  const opcoes = { generos: ['Ação'], situacoes: [{ valor: 'finalizado', titulo: 'Finalizado' }] };

  it('Gênero ou Situação fora do catálogo atual voltam a todos; a Ordem fica', () => {
    expect(filtrosEfetivos({ genero: 'Drama', situacao: 'hiato', ordem: 'nota' }, opcoes)).toEqual({
      genero: null,
      situacao: null,
      ordem: 'nota',
    });
    expect(filtrosEfetivos({ genero: 'Ação', situacao: 'finalizado', ordem: 'titulo' }, opcoes)).toEqual({
      genero: 'Ação',
      situacao: 'finalizado',
      ordem: 'titulo',
    });
  });

  it('só Gênero e Situação restringem os Itens', () => {
    expect(filtrosRestringem({ ...FILTROS_PADRAO, ordem: 'nota' })).toBe(false);
    expect(filtrosRestringem({ ...FILTROS_PADRAO, genero: 'Ação' })).toBe(true);
    expect(filtrosRestringem({ ...FILTROS_PADRAO, situacao: 'finalizado' })).toBe(true);
  });
});



describe('organizarLista: Ordem padrão (Q120)', () => {
  const padrao = { ...FILTROS_PADRAO, ordem: 'padrao' as const };

  it('anime e mangá pela maior Nota pessoal; empate alfabético; sem nota no fim', () => {
    const itens = [
      item('a', { titulo_portugues: 'Akira', nota_usuario: null }),
      item('b', { titulo_portugues: 'Berserk', tipo: 'manga', nota_usuario: 8 }),
      item('c', { titulo_portugues: 'Cowboy Bebop', nota_usuario: 10 }),
      item('d', { titulo_portugues: 'Dorohedoro', nota_usuario: 8 }),
    ];
    expect(ids(organizarLista(itens, padrao))).toEqual(['c', 'b', 'd', 'a']);
  });

  it('jogos pelas mais horas; 0 h conta como sem horas e vai para o fim', () => {
    const itens = [
      item('a', { titulo_portugues: 'Celeste', tipo: 'jogo', progresso_atual: 0, nota_usuario: 10 }),
      item('b', { titulo_portugues: 'Hades', tipo: 'jogo', progresso_atual: 80 }),
      item('c', { titulo_portugues: 'Outer Wilds', tipo: 'jogo', progresso_atual: null }),
      item('d', { titulo_portugues: 'Elden Ring', tipo: 'jogo', progresso_atual: 140 }),
      item('e', { titulo_portugues: 'Balatro', tipo: 'jogo', progresso_atual: 80 }),
    ];
    expect(ids(organizarLista(itens, padrao))).toEqual(['d', 'e', 'b', 'a', 'c']);
  });

  it('com Tipos misturados, a nota decide e as horas desempatam', () => {
    const itens = [
      item('a', { titulo_portugues: 'Hades', tipo: 'jogo', nota_usuario: 9, progresso_atual: 80 }),
      item('b', { titulo_portugues: 'Frieren', nota_usuario: 9, progresso_atual: 28 }),
      item('c', { titulo_portugues: 'Celeste', tipo: 'jogo', nota_usuario: null, progresso_atual: 30 }),
      item('d', { titulo_portugues: 'Monster', nota_usuario: 10 }),
    ];
    expect(ids(organizarLista(itens, padrao))).toEqual(['d', 'a', 'b', 'c']);
  });

  it('inversa troca a direção, e quem não tem nota/horas continua no fim', () => {
    const itens = [
      item('a', { titulo_portugues: 'A', nota_usuario: null }),
      item('b', { titulo_portugues: 'B', nota_usuario: 7 }),
      item('c', { titulo_portugues: 'C', nota_usuario: 9 }),
    ];
    expect(ids(organizarLista(itens, { ...padrao, inversa: true }))).toEqual(['b', 'c', 'a']);
  });
});

describe('organizarLista: Ordem horas e direção', () => {
  it('horas lê as horas do jogo e o Progresso do anime/mangá, do maior para o menor', () => {
    const itens = [
      item('a', { titulo_portugues: 'A', tipo: 'jogo', progresso_atual: 12 }),
      item('b', { titulo_portugues: 'B', progresso_atual: 24 }),
      item('c', { titulo_portugues: 'C', progresso_atual: 0 }),
    ];
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, ordem: 'horas' }))).toEqual(['b', 'a', 'c']);
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, ordem: 'horas', inversa: true }))).toEqual(['a', 'b', 'c']);
  });

  it('título inverso vai de Z a A; datas inversas, do mais antigo', () => {
    const itens = [
      item('a', { titulo_portugues: 'A', data_adicao: '2026-02-01T00:00:00Z' }),
      item('b', { titulo_portugues: 'B', data_adicao: null }),
      item('c', { titulo_portugues: 'C', data_adicao: '2026-01-01T00:00:00Z' }),
    ];
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, inversa: true }))).toEqual(['c', 'b', 'a']);
    expect(ids(organizarLista(itens, { ...FILTROS_PADRAO, ordem: 'adicao', inversa: true }))).toEqual(['c', 'a', 'b']);
  });

  it('crescente diz para onde a Ordem aponta: título sobe, o resto desce, e inversa troca', () => {
    expect(ORDENS_DA_LISTA).toEqual(['padrao', 'nota', 'horas', 'titulo', 'adicao', 'atualizacao']);
    expect(crescente('titulo', false)).toBe(true);
    expect(crescente('titulo', true)).toBe(false);
    expect(crescente('padrao', false)).toBe(false);
    expect(crescente('nota', true)).toBe(true);
  });
});

describe('Tipo da Lista', () => {
  const itens = [
    item('a', { tipo: 'anime' }),
    item('b', { tipo: 'jogo' }),
    item('c', { tipo: 'manga' }),
    item('d', { tipo: 'jogo' }),
  ];

  it('tiposDoFiltro e doTipo: "todos" são os três Tipos', () => {
    expect(tiposDoFiltro('todos')).toEqual(['anime', 'manga', 'jogo']);
    expect(tiposDoFiltro('jogo')).toEqual(['jogo']);
    expect(ids(doTipo(itens, 'todos'))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(doTipo(itens, 'jogo'))).toEqual(['b', 'd']);
  });

  it('contagemPorTipo conta cada Tipo e o total', () => {
    expect(contagemPorTipo(itens)).toEqual({ todos: 4, anime: 1, manga: 1, jogo: 2 });
    expect(contagemPorTipo([])).toEqual({ todos: 0, anime: 0, manga: 0, jogo: 0 });
  });
});

describe('secoesPorStatus ("Todos")', () => {
  it('uma seção por Status, na ordem dada, sem as vazias; os platinados só dentro do Concluído', () => {
    const itens = [
      item('a', { tipo: 'jogo', status_consumo: 'platinado' }),
      item('b', { status_consumo: 'planejado' }),
      item('c', { status_consumo: 'completo' }),
      item('d', { status_consumo: 'assistindo' }),
    ];
    const secoes = secoesPorStatus(itens, ['em_progresso', 'planejado', 'pausado', 'concluido', 'platinado']);
    expect(secoes.map((s) => [s.estado, ids(s.itens)])).toEqual([
      ['em_progresso', ['d']],
      ['planejado', ['b']],
      ['concluido', ['a', 'c']],
    ]);
    // Sem seção Platinado, cada Item aparece uma vez: a soma das seções é o total.
    expect(secoes.reduce((n, s) => n + s.itens.length, 0)).toBe(itens.length);
  });
});

describe('generosPorFrequencia', () => {
  it('os mais frequentes primeiro, alfabética no empate', () => {
    const itens = [
      item('a', { generos_lista: ['Drama', 'Ação'] }),
      item('b', { generos_lista: ['Comédia', 'Drama'] }),
      item('c', { generos_lista: ['Ação', 'Drama'] }),
      item('d', { generos_lista: ['Bélico'] }),
    ];
    expect(generosPorFrequencia(itens)).toEqual(['Drama', 'Ação', 'Bélico', 'Comédia']);
  });
});
