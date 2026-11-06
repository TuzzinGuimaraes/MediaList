import path from 'node:path';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { loginOk, simularFetch } from './fetchSimulado';

const APP = path.resolve(__dirname, '../../app');

async function abrirApp() {
  return renderRouter(APP, { initialUrl: '/' });
}

async function preencherLogin(email: string, senha: string) {
  await fireEvent.changeText(await screen.findByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Senha'), senha);
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
}

/** Botão da barra de abas (o React Navigation rotula como "Perfil, tab, 5 of 5"). */
function aba(nome: string) {
  return screen.findByRole('button', { name: new RegExp(`^${nome}, tab`) });
}

describe('sessão autenticada', () => {
  it('sem sessão, abre no login; com email e senha certos, entra nas abas', async () => {
    const api = simularFetch({ 'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }) });

    await abrirApp();
    await preencherLogin('ana@exemplo.com', 'segredo1');

    expect(await aba('Início')).toBeOnTheScreen();
    expect(api.para('POST /auth/login')[0].corpo).toEqual({
      email: 'ana@exemplo.com',
      senha: 'segredo1',
    });
  });
});
