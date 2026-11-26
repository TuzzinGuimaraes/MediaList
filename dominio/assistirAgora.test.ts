import { destaqueDoItem, paraAssistirAgora, textoDoAtraso, textoDoProximo } from './assistirAgora';

const AGORA = new Date('2026-11-27T12:00:00Z');

type Item = Parameters<typeof paraAssistirAgora>[0][number] & { id: string };

function anime(id: string, dados: Partial<Item> = {}): Item {
  return {
    id,
    tipo: 'anime',
    status_consumo: 'assistindo',
    status_anime: 'em_exibicao',
    progresso_atual: 5,
    episodios_lancados: 5,
    proximo_episodio_em: '2026-11-29T12:00:00Z',
    ...dados,
  };
}

const ids = (faixa: { item: Item }[]) => faixa.map((c) => c.item.id);

describe('paraAssistirAgora', () => {
  it('atrasados primeiro, do mais atrasado ao menos; depois os em dia, do próximo episódio mais perto ao mais longe', () => {
    const itens = [
      anime('em-dia-longe', { proximo_episodio_em: '2026-12-03T12:00:00Z' }),
      anime('atras-1', { episodios_lancados: 6 }),
      anime('em-dia-perto', { proximo_episodio_em: '2026-11-27T13:00:00Z' }),
      anime('atras-3', { progresso_atual: 2, episodios_lancados: 5 }),
    ];

    expect(ids(paraAssistirAgora(itens, AGORA))).toEqual(['atras-3', 'atras-1', 'em-dia-perto', 'em-dia-longe']);
  });

  it('cada cartão traz o atraso e o texto', () => {
    const [atrasado, emDia] = paraAssistirAgora(
      [anime('a', { progresso_atual: 2 }), anime('b', { proximo_episodio_em: '2026-11-29T12:00:00Z' })],
      AGORA,
    );

    expect([atrasado?.atraso, atrasado?.texto]).toEqual([3, '3 episódios atrás']);
    expect([emDia?.atraso, emDia?.texto]).toEqual([0, 'próximo em 2 d']);
  });

  it('em dia sem data do próximo episódio vai para o fim, como "em dia"', () => {
    const faixa = paraAssistirAgora(
      [anime('sem-data', { proximo_episodio_em: null }), anime('com-data')],
      AGORA,
    );

    expect(ids(faixa)).toEqual(['com-data', 'sem-data']);
    expect(faixa[1]?.texto).toBe('Em dia');
  });

  it('atraso 0 (ou Progresso à frente do que o job viu) é em dia', () => {
    const faixa = paraAssistirAgora([anime('frente', { progresso_atual: 6, episodios_lancados: 5 })], AGORA);

    expect(faixa.map((c) => c.atraso)).toEqual([0]);
  });

  it('Progresso ausente conta como 0', () => {
    expect(paraAssistirAgora([anime('a', { progresso_atual: null })], AGORA)[0]?.atraso).toBe(5);
  });

  it.each([
    ['anime finalizado', { status_anime: 'finalizado' as const }],
    ['anime aguardando', { status_anime: 'aguardando' as const }],
    ['status do anime desconhecido', { status_anime: null }],
    ['mangá', { tipo: 'manga' as const, status_consumo: 'lendo' as const }],
    ['jogo', { tipo: 'jogo' as const, status_consumo: 'jogando' as const }],
    ['Planejado', { status_consumo: 'planejado' as const }],
    ['Pausado', { status_consumo: 'pausado' as const }],
    ['Concluído', { status_consumo: 'completo' as const }],
    ['episódios lançados ainda não conhecidos', { episodios_lancados: null }],
  ])('%s fica de fora', (_caso, dados) => {
    expect(paraAssistirAgora([anime('fora', dados)], AGORA)).toEqual([]);
  });

  it('o +1 que alcança o último lançado tira o cartão dos atrasados', () => {
    const antes = anime('a', { progresso_atual: 6, episodios_lancados: 7 });
    const depois = { ...antes, progresso_atual: 7 };

    expect(paraAssistirAgora([antes], AGORA)[0]?.atraso).toBe(1);
    expect(paraAssistirAgora([depois], AGORA)[0]?.texto).toBe('próximo em 2 d');
  });

  it('sem anime em exibição Em progresso, a faixa é vazia', () => {
    expect(paraAssistirAgora([], AGORA)).toEqual([]);
  });
});

describe('textoDoAtraso', () => {
  it('singular e plural', () => {
    expect(textoDoAtraso(1)).toBe('1 episódio atrás');
    expect(textoDoAtraso(4)).toBe('4 episódios atrás');
  });
});

describe('textoDoProximo', () => {
  const daqui = (ms: number) => new Date(AGORA.getTime() + ms).toISOString();
  const MIN = 60_000;
  const HORA = 60 * MIN;
  const DIA = 24 * HORA;

  it.each([
    ['menos de 1 h: minutos', daqui(45 * MIN), 'próximo em 45 min'],
    ['menos de 1 min: 1 min', daqui(20_000), 'próximo em 1 min'],
    ['59 min e pouco: 59 min', daqui(59 * MIN + 59_000), 'próximo em 59 min'],
    ['1 h em ponto: horas', daqui(HORA), 'próximo em 1 h'],
    ['menos de 1 d: horas, para baixo', daqui(5 * HORA + 50 * MIN), 'próximo em 5 h'],
    ['23 h e pouco: 23 h', daqui(23 * HORA + 59 * MIN), 'próximo em 23 h'],
    ['1 d em ponto: dias', daqui(DIA), 'próximo em 1 d'],
    ['dias, para baixo', daqui(2 * DIA + 23 * HORA), 'próximo em 2 d'],
  ])('%s', (_caso, quando, texto) => {
    expect(textoDoProximo(quando, AGORA)).toBe(texto);
  });

  it('já passou (o job ainda não viu o episódio): sai a qualquer momento', () => {
    expect(textoDoProximo(daqui(-5 * MIN), AGORA)).toBe('saindo agora');
    expect(textoDoProximo(daqui(0), AGORA)).toBe('saindo agora');
  });

  it('data ilegível ou ausente: null', () => {
    expect(textoDoProximo(null, AGORA)).toBeNull();
    expect(textoDoProximo('amanhã', AGORA)).toBeNull();
  });
});

describe('destaqueDoItem', () => {
  it('anime em exibição, Em progresso e atrasado: onde parou e o último lançado', () => {
    expect(destaqueDoItem(anime('a', { progresso_atual: 5, episodios_lancados: 7 }))).toEqual({
      atraso: 2,
      parouNo: 5,
      ultimoLancado: 7,
      texto: 'Você parou no ep. 5; saiu o 7',
    });
  });

  it('sem nenhum episódio visto', () => {
    expect(destaqueDoItem(anime('a', { progresso_atual: 0, episodios_lancados: 1 }))?.texto).toBe(
      'Você ainda não começou; saiu o 1',
    );
  });

  it.each([
    ['em dia', { progresso_atual: 7, episodios_lancados: 7 }],
    ['finalizado', { status_anime: 'finalizado' as const, episodios_lancados: 12 }],
    ['Pausado', { status_consumo: 'pausado' as const, episodios_lancados: 9 }],
    ['episódios lançados desconhecidos', { episodios_lancados: null }],
    ['mangá', { tipo: 'manga' as const, status_consumo: 'lendo' as const, episodios_lancados: 9 }],
  ])('%s: sem destaque', (_caso, dados) => {
    expect(destaqueDoItem(anime('a', dados))).toBeNull();
  });

  it('sem Item (a Mídia não está na Lista): sem destaque', () => {
    expect(destaqueDoItem(null)).toBeNull();
  });
});
