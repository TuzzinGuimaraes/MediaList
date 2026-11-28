// Avisos de Notícias por push (spec noticias-avisos, ticket 03): permissão depois do login,
// registro/renovação/remoção do token, liga/desliga no Perfil e o toque no aviso abrindo a Notícia.
import { isRunningInExpoGo } from 'expo';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Noticia } from '../api/tipos';
import { paginaAvaliacoes, respostaNotas, rotaAvaliacoes, rotaNotas } from './contrato';
import { loginOk, simularFetch } from './fetchSimulado';
import { rotasDoInicio } from './inicio';
import { anime } from './midias';
import { aba, abrirLogado, entrarPeloLogin } from './sessao';

const avisos = Notifications as unknown as {
  __definir(estado: Record<string, unknown>): void;
  __tocar(resposta: unknown): void;
};

const concedida = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };
const indeterminada = { status: 'undetermined', granted: false, canAskAgain: true, expires: 'never' };
const negada = { status: 'denied', granted: false, canAskAgain: true, expires: 'never' };
const TOKEN = 'ExponentPushToken[aparelho-da-ana]';

// No Jest o manifesto vem vazio; no APK o projectId vem do app.json (extra.eas).
jest.mock('expo-constants', () => {
  const real = jest.requireActual('expo-constants').default;
  return {
    __esModule: true,
    default: Object.create(real, {
      expoConfig: { get: () => ({ ...real.expoConfig, extra: { eas: { projectId: 'a8e4c013-6733-4d93-a985-66090f3c8a0b' } } }) },
    }),
  };
});
jest.mock('expo', () => ({ ...jest.requireActual('expo'), isRunningInExpoGo: jest.fn(() => false) }));
const expoGo = jest.mocked(isRunningInExpoGo);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  expoGo.mockReturnValue(false);
});

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

const vazio = { itens: [], pagina: 1, por_pagina: 20, total: 0 };

function api(extra: Record<string, unknown> = {}) {
  return simularFetch({
    'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
    'POST /auth/logout': { status: 200, corpo: { mensagem: 'ok' } },
    'PUT /push/token': { status: 200, corpo: { mensagem: 'Token registrado' } },
    'DELETE /push/token': { status: 200, corpo: { mensagem: 'Token removido' } },
    'GET /noticias/NOT-0001': { status: 200, corpo: inverno },
    'GET /notificacoes': { status: 200, corpo: { notificacoes: [] } },
    'GET /noticias?por_pagina=20': { status: 200, corpo: vazio },
    ...extra,
  } as never);
}

function resposta(data: Record<string, unknown>) {
  return { actionIdentifier: 'expo.modules.notifications.actions.DEFAULT', notification: { request: { content: { data } } } };
}

describe('permissão e token', () => {
  it('pede a permissão depois do login, cria o canal padrão e registra o token', async () => {
    avisos.__definir({ permissao: indeterminada, respostaAoPedido: concedida });
    const fetch = api();

    await entrarPeloLogin();

    await waitFor(() => expect(fetch.para('PUT /push/token')).toHaveLength(1));
    expect(fetch.para('PUT /push/token')[0]).toMatchObject({
      autorizacao: 'Bearer A1',
      corpo: { token: TOKEN, plataforma: 'android' },
    });
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.anything());
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'a8e4c013-6733-4d93-a985-66090f3c8a0b',
    });
  });

  it('negada, não registra e não pede de novo ao reabrir o app', async () => {
    avisos.__definir({ permissao: indeterminada, respostaAoPedido: negada });
    const fetch = api();

    const app = await entrarPeloLogin();
    await waitFor(() => expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1));
    app.unmount();

    avisos.__definir({ permissao: negada, respostaAoPedido: concedida });
    await abrirLogado('/');
    await aba('Início');
    await act(async () => {});

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(fetch.para('PUT /push/token')).toHaveLength(0);
  });

  it('já concedida, renova o token ao abrir sem pedir de novo', async () => {
    avisos.__definir({ permissao: concedida });
    const fetch = api();

    await abrirLogado('/');

    await waitFor(() => expect(fetch.para('PUT /push/token')).toHaveLength(1));
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('no Expo Go não pede permissão nem registra', async () => {
    expoGo.mockReturnValue(true);
    avisos.__definir({ permissao: indeterminada, respostaAoPedido: concedida });
    const fetch = api();

    await entrarPeloLogin();
    await act(async () => {});

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(fetch.para('PUT /push/token')).toHaveLength(0);
  });

  it('o logout remove o token antes de revogar a sessão', async () => {
    avisos.__definir({ permissao: concedida });
    const fetch = api({
      'GET /auth/me': { status: 200, corpo: { usuario: { id_usuario: 'USR-1', nome_completo: 'Ana', email: 'a@b.c', foto_perfil: null }, deve_trocar_senha: false } },
      'GET /usuario/permissoes': { status: 200, corpo: { permissoes: { nivel_acesso: 'usuario' } } },
      'GET /usuario/estatisticas': { status: 200, corpo: { estatisticas: [], resumo: { total_midias: 0, concluidos: 0, em_andamento: 0, favoritos: 0 } } },
      'GET /lista': { status: 200, corpo: { lista: [] } },
      'GET /integracoes': { status: 200, corpo: { integracoes: [] } },
      'GET /preferencias': { status: 200, corpo: { preferencias: { tema: 'light', idioma: 'pt-BR', notificacoes_ativas: true, avisar_noticias: true, avisar_episodios: true } } },
      'GET /usuario/conquistas/destaques': { status: 200, corpo: { destaques: [], automaticos: true, total: { conquistas: 0, jogos: 0 } } },
    });

    await abrirLogado('/perfil');
    await waitFor(() => expect(fetch.para('PUT /push/token')).toHaveLength(1));
    await fireEvent.press(await screen.findByRole('button', { name: 'Sair' }));

    await screen.findByRole('button', { name: 'Entrar' });
    const ordem = fetch.chamadas.map((c) => `${c.metodo} ${c.caminho}`);
    expect(ordem.indexOf('DELETE /push/token')).toBeGreaterThan(-1);
    expect(ordem.indexOf('DELETE /push/token')).toBeLessThan(ordem.indexOf('POST /auth/logout'));
    expect(fetch.para('DELETE /push/token')[0]).toMatchObject({ autorizacao: 'Bearer A1', corpo: { token: TOKEN } });
  });
});

describe('toque no aviso', () => {
  it('com o app aberto, abre a Notícia', async () => {
    api();
    await abrirLogado('/');
    await aba('Início');

    await act(async () => avisos.__tocar(resposta({ tipo: 'noticia', id_noticia: 'NOT-0001' })));

    expect(await screen.findByText('Temporada de inverno')).toBeOnTheScreen();
  });

  it('com o app fechado, abre a Notícia do aviso que abriu o app', async () => {
    avisos.__definir({ ultimaResposta: resposta({ tipo: 'noticia', id_noticia: 'NOT-0001' }) });
    api();

    await abrirLogado('/');

    expect(await screen.findByText('Temporada de inverno')).toBeOnTheScreen();
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('ignora aviso que não é de Notícia', async () => {
    const fetch = api();
    await abrirLogado('/');
    await aba('Início');

    await act(async () => avisos.__tocar(resposta({ tipo: 'outro' })));

    expect(fetch.para('GET /noticias/NOT-0001')).toHaveLength(0);
  });

  it('o aviso de episódio abre o anime', async () => {
    const frieren = anime();
    simularFetch({
      'GET /notificacoes': { status: 200, corpo: { notificacoes: [] } },
      'GET /noticias?por_pagina=20': { status: 200, corpo: vazio },
      [`GET /midias/${frieren.id_midia}`]: { status: 200, corpo: frieren },
      [`GET /midias/${frieren.id_midia}/distribuicao`]: { status: 200, corpo: { distribuicao: [] } },
      [`GET /midias/${frieren.id_midia}/relacoes`]: { status: 200, corpo: { relacoes: [] } },
      [rotaAvaliacoes(frieren.id_midia)]: paginaAvaliacoes([]),
      [rotaNotas(frieren.id_midia)]: respostaNotas(),
      'GET /lista': { status: 200, corpo: { lista: [] } },
    } as never);
    const app = await abrirLogado('/');
    await aba('Início');

    await act(async () => avisos.__tocar(resposta({ tipo: 'episodio', id_midia: frieren.id_midia })));

    expect(await screen.findByRole('header', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe(`/midia/${frieren.id_midia}`);
  });

  it('o aviso de vários episódios abre o Início, onde estão os atrasados', async () => {
    simularFetch({
      ...rotasDoInicio(),
      'GET /notificacoes': { status: 200, corpo: { notificacoes: [] } },
      'GET /noticias?por_pagina=20': { status: 200, corpo: vazio },
    } as never);
    const app = await abrirLogado('/noticias');
    await aba('Notícias');

    await act(async () => avisos.__tocar(resposta({ tipo: 'episodios' })));

    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(await screen.findByTestId('inicio')).toBeOnTheScreen();
  });
});
