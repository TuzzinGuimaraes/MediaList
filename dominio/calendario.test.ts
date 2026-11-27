import {
  aSeguirDosSeus,
  avisoDaSemanaVazia,
  avisoDoDiaVazio,
  consultaDoCalendario,
  diasDoCalendario,
  ehDosMeus,
  marcadorDoAgora,
  notaDoHorario,
  rotuloDoChip,
  semanaVazia,
  soOsMeusPorPadrao,
  vistaGuardada,
  type ItemDoCalendario,
} from './calendario';
import type { EpisodioDoCalendario } from './tipos';

const BRASILIA = 'America/Sao_Paulo';
const TOQUIO = 'Asia/Tokyo';
// Quinta-feira, 26/11/2026, 16:45 em Brasília.
const AGORA = new Date('2026-11-26T19:45:00Z');

function episodio(id_midia: string, instante: string, campos: Partial<EpisodioDoCalendario> = {}): EpisodioDoCalendario {
  return {
    id_midia,
    tipo: 'anime',
    titulo_original: `Anime ${id_midia}`,
    titulo_ingles: null,
    titulo_romaji: null,
    poster_url: null,
    episodio: 1,
    instante,
    exibido: false,
    ...campos,
  };
}

function item(id_midia: string, status_consumo: ItemDoCalendario['status_consumo'], favorito = false): ItemDoCalendario {
  return { id_midia, tipo: 'anime', status_consumo, favorito };
}

describe('consultaDoCalendario', () => {
  it('vai do início de hoje ao fim do 7º dia, no fuso', () => {
    expect(consultaDoCalendario(AGORA, BRASILIA)).toEqual({
      de: '2026-11-26T03:00:00.000Z',
      ate: '2026-12-03T03:00:00.000Z',
    });
    // Em Tóquio já é sexta, 27/11 (04:45).
    expect(consultaDoCalendario(AGORA, TOQUIO)).toEqual({
      de: '2026-11-26T15:00:00.000Z',
      ate: '2026-12-03T15:00:00.000Z',
    });
  });

  it('acompanha a mudança de horário dentro da janela', () => {
    // Nova York sai do horário de verão em 01/11/2026: a janela tem 7 dias e 1 hora.
    expect(consultaDoCalendario(new Date('2026-10-30T12:00:00Z'), 'America/New_York')).toEqual({
      de: '2026-10-30T04:00:00.000Z',
      ate: '2026-11-06T05:00:00.000Z',
    });
  });
});

describe('diasDoCalendario', () => {
  it('são 7 dias, de Hoje em diante, com o nome, a data e a contagem', () => {
    const dias = diasDoCalendario([], { agora: AGORA, fuso: BRASILIA });

    expect(dias.map(({ chave, rotulo, curto, data, hoje, total }) => ({ chave, rotulo, curto, data, hoje, total }))).toEqual([
      { chave: '2026-11-26', rotulo: 'Hoje', curto: 'Hoje', data: '26/11', hoje: true, total: 0 },
      { chave: '2026-11-27', rotulo: 'Amanhã', curto: 'Amanhã', data: '27/11', hoje: false, total: 0 },
      { chave: '2026-11-28', rotulo: 'Sábado', curto: 'Sáb', data: '28/11', hoje: false, total: 0 },
      { chave: '2026-11-29', rotulo: 'Domingo', curto: 'Dom', data: '29/11', hoje: false, total: 0 },
      { chave: '2026-11-30', rotulo: 'Segunda-feira', curto: 'Seg', data: '30/11', hoje: false, total: 0 },
      { chave: '2026-12-01', rotulo: 'Terça-feira', curto: 'Ter', data: '01/12', hoje: false, total: 0 },
      { chave: '2026-12-02', rotulo: 'Quarta-feira', curto: 'Qua', data: '02/12', hoje: false, total: 0 },
    ]);
  });

  it('põe cada episódio no dia local, com a hora local, em ordem', () => {
    const tarde = episodio('a', '2026-11-26T21:00:00Z');
    const madrugada = episodio('b', '2026-11-28T01:30:00Z'); // 22:30 de sexta em Brasília
    const cedo = episodio('c', '2026-11-26T12:05:00Z', { exibido: true });

    const dias = diasDoCalendario([tarde, madrugada, cedo], { agora: AGORA, fuso: BRASILIA });

    expect(dias[0]?.episodios.map((e) => [e.episodio.id_midia, e.hora])).toEqual([['c', '09:05'], ['a', '18:00']]);
    expect(dias[0]?.total).toBe(2);
    expect(dias[1]?.episodios.map((e) => [e.episodio.id_midia, e.hora])).toEqual([['b', '22:30']]);
    expect(dias[2]?.total).toBe(0);
  });

  it('o mesmo instante cai em outro dia em outro fuso', () => {
    const dias = diasDoCalendario([episodio('b', '2026-11-28T01:30:00Z')], { agora: AGORA, fuso: TOQUIO });

    // Em Tóquio, hoje é sexta (27/11) e o episódio sai no sábado às 10:30.
    expect(dias[1]?.chave).toBe('2026-11-28');
    expect(dias[1]?.episodios.map((e) => e.hora)).toEqual(['10:30']);
  });

  it('marca "foi ao ar" o exibido e o próximo cuja hora já passou', () => {
    const exibido = episodio('a', '2026-11-26T12:00:00Z', { exibido: true });
    const atrasado = episodio('b', '2026-11-26T19:00:00Z');
    const depois = episodio('c', '2026-11-26T20:00:00Z');

    const [hoje] = diasDoCalendario([exibido, atrasado, depois], { agora: AGORA, fuso: BRASILIA });

    expect(hoje?.episodios.map((e) => e.foiAoAr)).toEqual([true, true, false]);
  });

  it('deixa de fora o que não cai nos 7 dias', () => {
    const ontem = episodio('a', '2026-11-26T02:59:00Z');
    const oitavo = episodio('b', '2026-12-03T03:00:00Z');

    const dias = diasDoCalendario([ontem, oitavo], { agora: AGORA, fuso: BRASILIA });

    expect(dias.every((d) => d.total === 0)).toBe(true);
  });

  it('"Só os meus" deixa só Em progresso, Planejado e favorito', () => {
    const episodios = ['assistindo', 'planejado', 'pausado', 'abandonado', 'favorito', 'completo', 'fora'].map((id, i) =>
      episodio(id, `2026-11-27T1${i}:00:00Z`),
    );
    const itens = [
      item('assistindo', 'assistindo'),
      item('planejado', 'planejado'),
      item('pausado', 'pausado'),
      item('abandonado', 'abandonado'),
      item('favorito', 'pausado', true),
      item('completo', 'completo'),
    ];

    const [, amanha] = diasDoCalendario(episodios, { agora: AGORA, fuso: BRASILIA, itens, soOsMeus: true });

    expect(amanha?.episodios.map((e) => e.episodio.id_midia)).toEqual(['assistindo', 'planejado', 'favorito']);
    expect(amanha?.total).toBe(3);
  });
});

describe('ehDosMeus', () => {
  it.each([
    ['assistindo', false, true],
    ['planejado', false, true],
    ['pausado', false, false],
    ['abandonado', false, false],
    ['completo', false, false],
    ['pausado', true, true],
    ['abandonado', true, true],
  ] as const)('%s, favorito %s: %s', (rotulo, favorito, esperado) => {
    expect(ehDosMeus(item('x', rotulo, favorito))).toBe(esperado);
  });

  it('fora da Lista não é dos meus', () => {
    expect(ehDosMeus(undefined)).toBe(false);
  });
});

describe('soOsMeusPorPadrao', () => {
  const episodios = [episodio('a', '2026-11-27T10:00:00Z'), episodio('b', '2026-11-28T10:00:00Z')];

  it('ligado quando algum episódio da semana é dos meus', () => {
    expect(soOsMeusPorPadrao(episodios, [item('b', 'pausado', true)])).toBe(true);
  });

  it('desligado quando nenhum é (ou a Lista está vazia)', () => {
    expect(soOsMeusPorPadrao(episodios, [item('a', 'pausado'), item('z', 'assistindo')])).toBe(false);
    expect(soOsMeusPorPadrao(episodios, [])).toBe(false);
  });
});

describe('aSeguirDosSeus', () => {
  it('o próximo episódio ainda não exibido de um dos meus, com o dia e a hora', () => {
    const episodios = [
      episodio('meu-exibido', '2026-11-26T12:00:00Z', { exibido: true }),
      episodio('outro', '2026-11-26T20:00:00Z'),
      episodio('pausado', '2026-11-26T21:00:00Z'),
      episodio('meu', '2026-11-28T01:30:00Z', { episodio: 8 }),
      episodio('meu-depois', '2026-11-29T01:30:00Z'),
    ];
    const itens = [item('meu-exibido', 'assistindo'), item('pausado', 'pausado'), item('meu', 'planejado'), item('meu-depois', 'assistindo')];

    const proximo = aSeguirDosSeus(episodios, { agora: AGORA, fuso: BRASILIA, itens });

    expect(proximo && { id: proximo.episodio.id_midia, ep: proximo.episodio.episodio, dia: proximo.dia, hora: proximo.hora }).toEqual({
      id: 'meu',
      ep: 8,
      dia: 'Amanhã',
      hora: '22:30',
    });
  });

  it('pula o próximo cuja hora já passou', () => {
    const episodios = [episodio('a', '2026-11-26T19:00:00Z'), episodio('a', '2026-11-27T19:00:00Z', { episodio: 2 })];

    expect(aSeguirDosSeus(episodios, { agora: AGORA, fuso: BRASILIA, itens: [item('a', 'assistindo')] })?.episodio.episodio).toBe(2);
  });

  it('null sem nenhum dos meus por vir', () => {
    expect(aSeguirDosSeus([episodio('a', '2026-11-27T10:00:00Z')], { agora: AGORA, fuso: BRASILIA, itens: [] })).toBeNull();
  });
});


describe('notaDoHorario', () => {
  it('o nome do fuso, e o horário de exibição no Japão', () => {
    expect(notaDoHorario(AGORA, BRASILIA)).toBe('Horário Padrão de Brasília · horário da exibição no Japão');
  });

  it('sem o nome do fuso, "Horários no seu fuso"', () => {
    expect(notaDoHorario(AGORA, 'Fuso/Inexistente')).toBe('Horários no seu fuso · horário da exibição no Japão');
  });
});

describe('marcadorDoAgora', () => {
  it('a hora local de agora, e o rótulo para o leitor de tela', () => {
    expect(marcadorDoAgora(AGORA, BRASILIA)).toEqual({ hora: '16:45', rotulo: 'Agora, 16:45' });
  });
});

describe('rotuloDoChip', () => {
  it('o dia, a data e a contagem', () => {
    const [hoje, , sabado] = diasDoCalendario([episodio('a', '2026-11-26T21:00:00Z')], { agora: AGORA, fuso: BRASILIA });

    expect(rotuloDoChip(hoje!)).toBe('Hoje, 26/11, 1 episódio');
    expect(rotuloDoChip(sabado!)).toBe('Sábado, 28/11, nenhum episódio');
  });
});

describe('semana e dia vazios', () => {
  it('a semana é vazia quando nenhum dia tem episódio', () => {
    expect(semanaVazia(diasDoCalendario([], { agora: AGORA, fuso: BRASILIA }))).toBe(true);
    expect(semanaVazia(diasDoCalendario([episodio('a', '2026-11-27T10:00:00Z')], { agora: AGORA, fuso: BRASILIA }))).toBe(false);
  });

  it('o aviso depende do filtro', () => {
    expect(avisoDaSemanaVazia(true)).toBe('Nenhum dos seus animes sai nos próximos 7 dias.');
    expect(avisoDaSemanaVazia(false)).toBe('Nenhum episódio nos próximos 7 dias.');
    expect(avisoDoDiaVazio(true)).toBe('Nenhum dos seus sai neste dia.');
    expect(avisoDoDiaVazio(false)).toBe('Nenhum episódio neste dia.');
  });
});

describe('vistaGuardada', () => {
  it('a guardada, se for uma das vistas; senão, a Agenda', () => {
    expect(vistaGuardada('semana')).toBe('semana');
    expect(vistaGuardada('agenda')).toBe('agenda');
    expect(vistaGuardada('outra')).toBe('agenda');
    expect(vistaGuardada(null)).toBe('agenda');
  });
});
