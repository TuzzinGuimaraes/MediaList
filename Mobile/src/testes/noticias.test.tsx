import path from 'node:path';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { loginOk, simularFetch } from './fetchSimulado';

const APP = path.resolve(__dirname, '../../app');

/** Botão da barra de abas (o React Navigation rotula como "Notícias, tab, 4 of 5"). */
function aba(nome: string) {
  return screen.findByRole('button', { name: new RegExp(`^${nome}, tab`) });
}

async function entrar() {
  await renderRouter(APP, { initialUrl: '/' });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'ana@exemplo.com');
  await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo1');
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
  await aba('Início');
}

/** Formato de GET /notificacoes (Backend/routes/midias.py cria; Flask serializa a data em RFC 1123). */
function notificacao(titulo: string, lida: boolean) {
  return {
    id_usuario: 'USR-20261106-00007',
    id_midia: 'ANI-0001',
    tipo_midia: 'anime',
    tipo: 'episodio',
    titulo,
    midia_nome: 'Frieren',
    anime_nome: 'Frieren',
    mensagem: 'Novidade em anime da sua lista: Frieren',
    lida,
    data_criacao: 'Fri, 06 Nov 2026 10:00:00 GMT',
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

    await waitFor(async () => expect(within(await aba('Notícias')).getByText('2')).toBeOnTheScreen());
  });
});
