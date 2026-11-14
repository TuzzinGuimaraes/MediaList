// Login simulado dos testes de tela. Dois caminhos:
// - `abrirLogado(url)`: a sessão já está guardada (como ao reabrir o app) e a tela abre direto;
// - `entrarPeloLogin()`: passa pela tela de login. Precisa da rota `POST /auth/login`
//   no `simularFetch` (ver `loginOk`).
import path from 'node:path';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { guardarSessao } from '../auth/armazenamento';
import { usuarioAna } from './fetchSimulado';

export const APP = path.resolve(__dirname, '../../app');

/** Guarda a sessão da Ana e abre o app em `url`. */
export async function abrirLogado(url = '/') {
  await guardarSessao({ tokens: { access: 'A1', refresh: 'R1' }, usuario: usuarioAna as never });
  return renderRouter(APP, { initialUrl: url });
}

/** Botão da barra de abas (o React Navigation rotula como "Perfil, tab, 5 of 5"). */
export function aba(nome: string) {
  return screen.findByRole('button', { name: new RegExp(`^${nome}, tab`) });
}

/** Preenche a tela de login e toca em Entrar. */
export async function preencherLogin(email: string, senha: string) {
  await fireEvent.changeText(await screen.findByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Senha'), senha);
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
}

/** Abre o app sem sessão, entra com a Ana e espera as abas. */
export async function entrarPeloLogin() {
  const app = await renderRouter(APP, { initialUrl: '/' });
  await preencherLogin('ana@exemplo.com', 'segredo1');
  await aba('Início');
  return app;
}
