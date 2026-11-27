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

  it('cada cartão traz o atraso, se está atrasado e o texto', () => {
    const [atrasado, emDia] = paraAssistirAgora(
      [anime('a', { progresso_atual: 2 }), anime('b', { proximo_episodio_em: '2026-11-29T12:00:00Z' })],
      AGORA,
    );

    expect([atrasado?.atraso, atrasado?.atrasado, atrasado?.texto]).toEqual([
      3,
      true,
      '3 episódios atrás · próximo em 2 d 0 h 0 min',
    ]);
    expect([emDia?.atraso, emDia?.atrasado, emDia?.texto]).toEqual([0, false, 'próximo em 2 d 0 h 0 min']);
  });

  it('atrasado com o próximo episódio a menos de 1 min: próximo em instantes', () => {
    const [atrasado] = paraAssistirAgora([anime('a', { progresso_atual: 2, proximo_episodio_em: '2026-11-27T12:00:30Z' })], AGORA);

    expect(atrasado?.texto).toBe('3 episódios atrás · próximo em instantes');
  });

  it('atrasado sem data futura do próximo episódio: só o atraso', () => {
    const [semData, passou] = paraAssistirAgora(
      [
        anime('a', { progresso_atual: 1, proximo_episodio_em: null }),
        anime('b', { progresso_atual: 3, proximo_episodio_em: '2026-11-27T11:00:00Z' }),
      ],
      AGORA,
    );

    expect([semData?.texto, passou?.texto]).toEqual(['4 episódios atrás', '2 episódios atrás']);
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
    ['episódios lançados ausentes (API antiga)', { episodios_lancados: undefined as unknown as null }],
  ])('%s fica de fora', (_caso, dados) => {
    expect(paraAssistirAgora([anime('fora', dados)], AGORA)).toEqual([]);
  });

  it('o +1 que alcança o último lançado tira o cartão dos atrasados', () => {
    const antes = anime('a', { progresso_atual: 6, episodios_lancados: 7 });
    const depois = { ...antes, progresso_atual: 7 };

    expect(paraAssistirAgora([antes], AGORA)[0]?.atraso).toBe(1);
    expect(paraAssistirAgora([depois], AGORA)[0]?.texto).toBe('próximo em 2 d 0 h 0 min');
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
    ['só minutos', daqui(45 * MIN), 'próximo em 45 min'],
    ['59 min e pouco: para baixo', daqui(59 * MIN + 59_000), 'próximo em 59 min'],
    ['1 min em ponto', daqui(MIN), 'próximo em 1 min'],
    ['horas e minutos', daqui(4 * HORA + 10 * MIN), 'próximo em 4 h 10 min'],
    ['1 h em ponto: os minutos zero ficam', daqui(HORA), 'próximo em 1 h 0 min'],
    ['dias, horas e minutos', daqui(2 * DIA + 4 * HORA + 10 * MIN), 'próximo em 2 d 4 h 10 min'],
    ['dias com zero no meio', daqui(2 * DIA + 5 * MIN), 'próximo em 2 d 0 h 5 min'],
    ['1 d em ponto', daqui(DIA), 'próximo em 1 d 0 h 0 min'],
  ])('%s', (_caso, quando, texto) => {
    expect(textoDoProximo(quando, AGORA)).toBe(texto);
  });

  it('menos de 1 min: próximo em instantes', () => {
    expect(textoDoProximo(daqui(20_000), AGORA)).toBe('próximo em instantes');
    expect(textoDoProximo(daqui(1), AGORA)).toBe('próximo em instantes');
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
    ['episódios lançados ausentes (API antiga)', { episodios_lancados: undefined as unknown as null }],
    ['mangá', { tipo: 'manga' as const, status_consumo: 'lendo' as const, episodios_lancados: 9 }],
  ])('%s: sem destaque', (_caso, dados) => {
    expect(destaqueDoItem(anime('a', dados))).toBeNull();
  });

  it('sem Item (a Mídia não está na Lista): sem destaque', () => {
    expect(destaqueDoItem(null)).toBeNull();
  });
});
