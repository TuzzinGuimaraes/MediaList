import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';

import type { Noticia, Notificacao } from '../api/tipos';
import { pagina, paginaAvaliacoes, respostaNotas, rotaAvaliacoes, rotaNotas } from './contrato';
import { loginOk, simularFetch } from './fetchSimulado';
import { anime } from './midias';
import { aba, abrirLogado, entrarPeloLogin as entrar } from './sessao';

afterEach(() => focusManager.setFocused(undefined));

/** O sistema avisa os ouvintes do AppState (mock do jest-preset do RN). */
async function appFica(estado: AppStateStatus) {
  const ouvintes = jest
    .mocked(AppState.addEventListener)
    .mock.calls.filter(([evento]) => evento === 'change')
    .map(([, ouvinte]) => ouvinte);
  await act(async () => ouvintes.forEach((ouvinte) => ouvinte(estado)));
}

/** O gesto de puxar a lista: o RefreshControl chama `onRefresh`. */
async function puxarParaAtualizar(testID: string) {
  const lista = screen.getByTestId(testID);
  await act(async () => lista.props.refreshControl.props.onRefresh());
}

/** Texto do badge da aba Notícias, ou null sem badge. */
function badgeNoticias() {
  const botao = screen.getByRole('button', { name: /^Notícias, tab/ });
  return within(botao).queryByText(/^\d+$/)?.props.children ?? null;
}

/** Item de GET /notificacoes. */
function notificacao(titulo: string, lida: boolean): Notificacao {
  return {
    origem: 'atualizacao',
    id_noticia: null,
    id_midia: 'ANI-0001',
    tipo_midia: 'anime',
    tipo: 'episodio',
    titulo,
    midia_nome: 'Frieren',
    mensagem: 'Novidade em anime da sua lista: Frieren',
    lida,
    data_criacao: '2026-11-06T10:00:00Z',
  };
}

const semNoticias = pagina<Noticia>([]);

const inverno: Noticia = {
  id_noticia: 'NOT-0001',
  titulo: 'Temporada de inverno',
  conteudo: 'Os lançamentos de janeiro.',
  autor: 'Admin',
  categoria: 'geral',
  tags: ['anime'],
  imagem_url: null,
  data_publicacao: '2026-11-06T10:00:00Z',
  data_edicao: null,
};

/** Item de GET /notificacoes que entrega uma Notícia. */
function notificacaoDeNoticia(lida: boolean): Notificacao {
  return {
    origem: 'noticia',
    id_noticia: inverno.id_noticia,
    id_midia: null,
    tipo_midia: null,
    tipo: 'noticia',
    titulo: inverno.titulo,
    midia_nome: null,
    mensagem: 'Nova Notícia no MediaList',
    lida,
    data_criacao: '2026-11-06T11:00:00Z',
  };
}

describe('badge de Notificações não lidas', () => {
  it('a aba Notícias mostra quantas Notificações estão não lidas', async () => {
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /notificacoes': {
        status: 200,
        corpo: {
          notificacoes: [
            notificacao('Episódio 12', false),
            notificacao('Episódio 11', false),
            notificacao('Episódio 10', true),
          ],
        },
      },
    });

    await entrar();

    await waitFor(() => expect(badgeNoticias()).toBe(2));
  });

  it('"Marcar todas como lidas" avisa o servidor e zera o badge', async () => {
    let lidas = false;
    const api = simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /noticias?por_pagina=20': semNoticias,
      'GET /notificacoes': () => ({
        status: 200,
        corpo: { notificacoes: [notificacao('Episódio 12', lidas), notificacao('Episódio 11', lidas)] },
      }),
      'PUT /notificacoes/marcar-todas-lidas': () => {
        lidas = true;
        return { status: 200, corpo: { mensagem: '2 notificações marcadas como lidas' } };
      },
    });
    await entrar();

    await fireEvent.press(await aba('Notícias'));
    await fireEvent.press(await screen.findByRole('tab', { name: 'Notificações' }));
    expect(await screen.findByText('Episódio 12')).toBeOnTheScreen();

    await waitFor(() => expect(badgeNoticias()).toBe(2));
    await fireEvent.press(screen.getByRole('button', { name: 'Marcar todas como lidas' }));

    await waitFor(() => expect(badgeNoticias()).toBeNull());
    expect(api.para('PUT /notificacoes/marcar-todas-lidas')[0].autorizacao).toBe('Bearer A1');
  });

  it('o badge atualiza quando o app volta para o primeiro plano', async () => {
    let novas = 1;
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /notificacoes': () => ({
        status: 200,
        corpo: { notificacoes: Array.from({ length: novas }, (_, i) => notificacao(`Episódio ${i}`, false)) },
      }),
    });
    await entrar();
    await waitFor(() => expect(badgeNoticias()).toBe(1));

    await appFica('background');
    novas = 3;
    await appFica('active');

    await waitFor(() => expect(badgeNoticias()).toBe(3));
  });

  it('puxar a lista de Notificações busca de novo e atualiza o badge', async () => {
    let novas = 1;
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /noticias?por_pagina=20': semNoticias,
      'GET /notificacoes': () => ({
        status: 200,
        corpo: { notificacoes: Array.from({ length: novas }, (_, i) => notificacao(`Episódio ${i}`, false)) },
      }),
    });
    await entrar();
    await fireEvent.press(await aba('Notícias'));
    await fireEvent.press(await screen.findByRole('tab', { name: 'Notificações' }));
    await screen.findByText('Episódio 0');

    novas = 2;
    await puxarParaAtualizar('lista-notificacoes');

    expect(await screen.findByText('Episódio 1')).toBeOnTheScreen();
    await waitFor(() => expect(badgeNoticias()).toBe(2));
  });
});

describe('Notícias', () => {
  it('lista as Notícias publicadas com autor e data', async () => {
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /notificacoes': { status: 200, corpo: { notificacoes: [] } },
      'GET /noticias?por_pagina=20': pagina<Noticia>([
        {
          id_noticia: 'NOT-0001',
          titulo: 'Temporada de inverno',
          conteudo: 'Os lançamentos de janeiro.',
          autor: 'Admin',
          categoria: 'geral',
          tags: ['anime'],
          imagem_url: null,
          data_publicacao: '2026-11-06T10:00:00Z',
          data_edicao: null,
        },
      ]),
    });
    await entrar();

    await fireEvent.press(await aba('Notícias'));

    expect(await screen.findByText('Temporada de inverno')).toBeOnTheScreen();
    expect(screen.getByText('Por Admin · 06/11/2026')).toBeOnTheScreen();
    expect(badgeNoticias()).toBeNull();
  });
});

describe('Notificação de Notícia', () => {
  it('conta no badge, aparece como Notícia e tocar abre a Notícia', async () => {
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /noticias?por_pagina=20': semNoticias,
      'GET /notificacoes': {
        status: 200,
        corpo: { notificacoes: [notificacaoDeNoticia(false), notificacao('Episódio 11', true)] },
      },
      'GET /noticias/NOT-0001': { status: 200, corpo: inverno },
    });
    const app = await entrar();
    await waitFor(() => expect(badgeNoticias()).toBe(1));

    await fireEvent.press(await aba('Notícias'));
    await fireEvent.press(await screen.findByRole('tab', { name: 'Notificações' }));
    const item = await screen.findByRole('link', { name: /Temporada de inverno/ });
    expect(within(item).getByText('Notícia · 06/11/2026')).toBeOnTheScreen();
    await fireEvent.press(item);

    expect(await screen.findByText('Os lançamentos de janeiro.')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/noticia/NOT-0001');
  });

  it('a Notícia que não existe mostra o erro', async () => {
    simularFetch({
      'GET /notificacoes': { status: 200, corpo: { notificacoes: [] } },
      'GET /noticias/NOT-0009': {
        status: 404,
        corpo: { erro: 'Notícia não encontrada', codigo: 'nao_encontrado' },
      },
    });
    await abrirLogado('/noticia/NOT-0009');

    expect(await screen.findByText('Notícia não encontrada')).toBeOnTheScreen();
  });
});


describe('Notificação de Atualização', () => {
  it('aparece com o nome da Mídia e tocar abre a Mídia', async () => {
    const frieren = anime({ id_midia: 'ANI-0001' });
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /noticias?por_pagina=20': semNoticias,
      'GET /notificacoes': { status: 200, corpo: { notificacoes: [notificacao('Episódio 12 de Frieren foi ao ar', false)] } },
      'GET /midias/ANI-0001': { status: 200, corpo: frieren },
      'GET /midias/ANI-0001/distribuicao': { status: 200, corpo: { distribuicao: [] } },
      [rotaAvaliacoes('ANI-0001')]: paginaAvaliacoes([]),
      [rotaNotas('ANI-0001')]: respostaNotas(),
      'GET /lista': { status: 200, corpo: { lista: [] } },
    });
    const app = await entrar();

    await fireEvent.press(await aba('Notícias'));
    await fireEvent.press(await screen.findByRole('tab', { name: 'Notificações' }));
    const item = await screen.findByRole('link', { name: /Episódio 12 de Frieren foi ao ar/ });
    expect(within(item).getByText('Frieren · 06/11/2026')).toBeOnTheScreen();
    await fireEvent.press(item);

    expect(await screen.findByRole('header', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/midia/ANI-0001');
  });
});
