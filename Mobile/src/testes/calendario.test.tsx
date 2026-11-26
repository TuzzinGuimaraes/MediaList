import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { EpisodioDoCalendario, MidiaDetalhe, RespostaFacetas } from '../api/tipos';
import { pagina } from './contrato';
import { simularFetch } from './fetchSimulado';
import { anime, itemDaLista } from './midias';
import { abrirLogado } from './sessao';

// O aparelho está em Brasília; agora é quinta, 26/11/2026, 12:00 de Brasília (15:00 UTC).
jest.mock('../calendario/fuso', () => ({ fusoDoAparelho: () => 'America/Sao_Paulo' }));

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date('2026-11-26T15:00:00Z'),
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
});
afterEach(() => jest.useRealTimers());

const frieren = anime({ temporada_estacao: 'outono', temporada_ano: 2026 });
const dandadan = anime({ id_midia: 'MID-ANM-2026-20100', titulo_portugues: 'Dandadan' });
const kaiju = anime({ id_midia: 'MID-ANM-2026-20400', titulo_portugues: 'Kaiju nº 8' });

function episodio(midia: MidiaDetalhe, episodio: number, instante: string, exibido = false): EpisodioDoCalendario {
  return {
    id_midia: midia.id_midia,
    tipo: 'anime',
    titulo_original: midia.titulo_original,
    titulo_portugues: midia.titulo_portugues,
    titulo_ingles: midia.titulo_ingles,
    poster_url: midia.poster_url,
    episodio,
    instante,
    exibido,
  };
}

// Hoje às 10:00 (já foi ao ar) e às 19:30; o do Kaiju sai sábado 01:30 UTC, que em Brasília é
// sexta (Amanhã) às 22:30.
const episodios = [
  episodio(frieren, 8, '2026-11-26T13:00:00Z', true),
  episodio(dandadan, 9, '2026-11-26T22:30:00Z'),
  episodio(kaiju, 5, '2026-11-28T01:30:00Z'),
];

/** A janela de Hoje 00:00 até o fim do 7º dia, em Brasília. */
const CALENDARIO = 'GET /midias/calendario?de=2026-11-26T03%3A00%3A00.000Z&ate=2026-12-03T03%3A00%3A00.000Z';

const facetas: { status: 200; corpo: RespostaFacetas } = {
  status: 200,
  corpo: { estudios: [], plataformas: [], temporada_mais_antiga: { estacao: 'verao', ano: 2026 } },
};

function rotas(extras: Record<string, unknown> = {}) {
  return {
    'GET /midias/facetas?tipo=anime': facetas,
    'GET /lista': { status: 200, corpo: { lista: [] } },
    'GET /midias?tipo=anime&temporada_estacao=outono&temporada_ano=2026&ordem=popularidade_fonte&pagina=1&por_pagina=50':
      pagina([frieren], { por_pagina: 50 }),
    'GET /midias?tipo=anime&temporada_estacao=inverno&temporada_ano=2027&ordem=popularidade_fonte&pagina=1&por_pagina=50':
      pagina([], { por_pagina: 50 }),
    [CALENDARIO]: { status: 200, corpo: { episodios } },
    ...extras,
  } as Parameters<typeof simularFetch>[0];
}

const abrirCalendario = () => abrirLogado('/temporada?aba=calendario');

describe('Calendário', () => {
  it('é uma aba da Temporada atual, que some nas outras', async () => {
    simularFetch(rotas());
    await abrirLogado('/temporada');

    await fireEvent.press(await screen.findByRole('tab', { name: 'Calendário' }));
    expect(await screen.findByRole('header', { name: 'Hoje' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Próxima, Inverno 2027' }));
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Calendário' })).not.toBeOnTheScreen());
    expect(await screen.findByText('Nenhum anime de Inverno 2027 no Catálogo.')).toBeOnTheScreen();
  });

  it('mostra os 7 dias com a hora de Brasília, e o que já saiu hoje "foi ao ar"', async () => {
    simularFetch(rotas());
    await abrirCalendario();

    const hoje = await screen.findByLabelText('Hoje');
    expect(within(hoje).getByRole('link', { name: 'Sousou no Frieren, Ep. 8, 10:00, foi ao ar' })).toBeOnTheScreen();
    expect(within(hoje).getByRole('link', { name: 'Dandadan, Ep. 9, 19:30' })).toBeOnTheScreen();
    expect(within(screen.getByLabelText('Amanhã')).getByRole('link', { name: 'Kaiju nº 8, Ep. 5, 22:30' })).toBeOnTheScreen();
    for (const dia of ['Sábado', 'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira']) {
      expect(within(screen.getByLabelText(dia)).getByText('Nenhum episódio neste dia.')).toBeOnTheScreen();
    }
    expect(screen.getByText(/horário da exibição no Japão/)).toBeOnTheScreen();
  });

  it('"Só os meus" começa ligado para quem tem um dos seus em exibição: Pausado fica fora, favorito entra', async () => {
    simularFetch(
      rotas({
        'GET /lista': {
          status: 200,
          corpo: {
            lista: [
              itemDaLista(dandadan, { status_consumo: 'assistindo' }),
              itemDaLista(frieren, { status_consumo: 'pausado' }),
              itemDaLista(kaiju, { status_consumo: 'abandonado', favorito: true }),
            ],
          },
        },
      }),
    );
    await abrirCalendario();

    const filtro = await screen.findByRole('switch', { name: 'Só os meus' });
    expect(filtro).toBeChecked();
    const hoje = screen.getByLabelText('Hoje');
    expect(within(hoje).getByRole('link', { name: 'Dandadan, Ep. 9, 19:30' })).toBeOnTheScreen();
    expect(within(hoje).queryByRole('link', { name: /^Sousou no Frieren/ })).not.toBeOnTheScreen();
    expect(within(screen.getByLabelText('Amanhã')).getByRole('link', { name: /^Kaiju nº 8/ })).toBeOnTheScreen();
    expect(within(screen.getByLabelText('Sábado')).getByText('Nenhum dos seus sai neste dia.')).toBeOnTheScreen();

    await fireEvent(filtro, 'valueChange', false);

    expect(await within(screen.getByLabelText('Hoje')).findByRole('link', { name: /^Sousou no Frieren/ })).toBeOnTheScreen();
  });

  it('sem nenhum dos seus, o filtro começa desligado e ligá-lo avisa que a semana ficou vazia', async () => {
    simularFetch(rotas());
    await abrirCalendario();

    const filtro = await screen.findByRole('switch', { name: 'Só os meus' });
    expect(filtro).not.toBeChecked();
    expect(screen.queryByRole('link', { name: /^A seguir dos seus/ })).not.toBeOnTheScreen();

    await fireEvent(filtro, 'valueChange', true);
    expect(await screen.findByText('Nenhum dos seus animes sai nos próximos 7 dias.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver todos os animes' }));
    expect(await screen.findByRole('link', { name: 'Dandadan, Ep. 9, 19:30' })).toBeOnTheScreen();
  });

  it('"A seguir dos seus" é o próximo dos seus que ainda não saiu, e abre o anime', async () => {
    simularFetch(
      rotas({
        'GET /lista': {
          status: 200,
          corpo: {
            lista: [itemDaLista(frieren, { status_consumo: 'assistindo' }), itemDaLista(kaiju, { status_consumo: 'planejado' })],
          },
        },
      }),
    );
    const app = await abrirCalendario();

    await fireEvent.press(await screen.findByRole('link', { name: 'A seguir dos seus: Kaiju nº 8, Ep. 5, Amanhã, 22:30' }));

    await waitFor(() => expect(app.getPathname()).toBe(`/midia/${kaiju.id_midia}`));
  });

  it('tocar num episódio abre o anime', async () => {
    simularFetch(rotas());
    const app = await abrirCalendario();

    await fireEvent.press(await screen.findByRole('link', { name: 'Dandadan, Ep. 9, 19:30' }));

    await waitFor(() => expect(app.getPathname()).toBe(`/midia/${dandadan.id_midia}`));
  });

  it('"Planejado" põe o anime na Lista, e o filtro não muda por isso', async () => {
    let lista: ReturnType<typeof itemDaLista>[] = [];
    const api = simularFetch(
      rotas({
        'GET /lista': () => ({ status: 200, corpo: { lista } }),
        'POST /lista/adicionar': () => {
          lista = [itemDaLista(dandadan, { status_consumo: 'planejado' })];
          return { status: 201, corpo: { mensagem: 'ok', id_lista: 'LST-1' } };
        },
        'GET /usuario/estatisticas': { status: 200, corpo: { estatisticas: [] } },
        [`GET /midias/${dandadan.id_midia}/distribuicao`]: { status: 200, corpo: { distribuicao: [] } },
      }),
    );
    await abrirCalendario();

    await fireEvent.press(await screen.findByRole('button', { name: 'Planejado, Dandadan' }));

    expect(await screen.findByText('Na Lista')).toBeOnTheScreen();
    expect(api.para('POST /lista/adicionar')[0]?.corpo).toEqual({ id_midia: dandadan.id_midia, status_consumo: 'planejado' });
    expect(screen.getByRole('switch', { name: 'Só os meus' })).not.toBeChecked();
    expect(screen.getByRole('link', { name: /^Sousou no Frieren/ })).toBeOnTheScreen();
  });

  it('a faixa tem os 7 dias com a contagem, e tocar num dia o marca', async () => {
    simularFetch(rotas());
    await abrirCalendario();

    expect(await screen.findByRole('tab', { name: 'Hoje, 26/11, 2 episódios', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Quarta-feira, 02/12, 0 episódios' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: 'Amanhã, 27/11, 1 episódio' }));

    expect(screen.getByRole('tab', { name: 'Amanhã, 27/11, 1 episódio', selected: true })).toBeOnTheScreen();
  });

  it('Agenda é o padrão; a Semana escolhida fica guardada no aparelho', async () => {
    simularFetch(rotas());
    const app = await abrirCalendario();
    expect(await screen.findByRole('radio', { name: 'Agenda', checked: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Agora')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Semana' }));
    expect(await within(screen.getByLabelText('Hoje')).findByText('Ep. 8 · foi ao ar')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Agora')).not.toBeOnTheScreen();

    app.unmount();
    await abrirCalendario();
    expect(await screen.findByRole('radio', { name: 'Semana', checked: true })).toBeOnTheScreen();
  });
});
