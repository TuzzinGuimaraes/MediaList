import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { TextInput } from 'react-native';

import { type Resposta, loginOk, simularFetch, usuarioAna } from './fetchSimulado';
import { APP } from './sessao';

// O teclado navega (next) e envia (go); os campos de senha têm o olho de mostrar/ocultar.

/** Rótulos dos campos que receberam `focus()` (o mock do TextInput guarda a instância). */
function focados(): string[] {
  const focus = TextInput.prototype.focus as unknown as jest.Mock;
  return focus.mock.contexts.map((c: { props: { accessibilityLabel?: string } }) => c.props.accessibilityLabel ?? '');
}

const oculta = (rotulo: string) => screen.getByLabelText(rotulo).props.secureTextEntry;

async function abrirLogin() {
  const api = simularFetch({ 'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }) });
  await renderRouter(APP, { initialUrl: '/' });
  await screen.findByLabelText('Email');
  return api;
}

describe('login pelo teclado', () => {
  it('"next" no email foca a senha e "go" na senha entra', async () => {
    const api = await abrirLogin();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo1');

    expect(screen.getByLabelText('Email').props.returnKeyType).toBe('next');
    await fireEvent(screen.getByLabelText('Email'), 'submitEditing');
    expect(focados()).toEqual(['Senha']);

    expect(screen.getByLabelText('Senha').props.returnKeyType).toBe('go');
    await fireEvent(screen.getByLabelText('Senha'), 'submitEditing');
    await waitFor(() => expect(api.para('POST /auth/login')).toHaveLength(1));
    expect(api.para('POST /auth/login')[0].corpo).toEqual({ email: 'ana@exemplo.com', senha: 'segredo1' });
  });
});

describe('mostrar senha no login', () => {
  it('começa oculta, o olho alterna e enviar oculta de novo', async () => {
    simularFetch({ 'POST /auth/login': { status: 401, corpo: { erro: 'Email ou senha incorretos', codigo: 'nao_autenticado' } } });
    await renderRouter(APP, { initialUrl: '/' });
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'ana@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'errada');
    expect(oculta('Senha')).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(oculta('Senha')).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(oculta('Senha')).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar senha' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha incorretos');
    expect(oculta('Senha')).toBe(true);
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeOnTheScreen();
  });

  it('sair da tela oculta a senha', async () => {
    await abrirLogin();
    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(oculta('Senha')).toBe(false);

    await fireEvent.press(screen.getByText('Não tem conta? Criar conta'));
    await screen.findByLabelText('Confirmar senha');
    await act(() => router.back());

    await waitFor(() => expect(oculta('Senha')).toBe(true));
  });
});

describe('cadastro', () => {
  it('o teclado passa nome → email → senha → confirmação e envia; as duas senhas têm o olho', async () => {
    const registro: Resposta = { status: 201, corpo: { mensagem: 'ok', id_usuario: usuarioAna.id } };
    const api = simularFetch({ 'POST /auth/registro': registro, 'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }) });
    await renderRouter(APP, { initialUrl: '/registro' });

    await fireEvent.changeText(await screen.findByLabelText('Nome'), 'Ana Souza');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo1');
    await fireEvent.changeText(screen.getByLabelText('Confirmar senha'), 'segredo1');

    for (const rotulo of ['Nome', 'Email', 'Senha']) {
      expect(screen.getByLabelText(rotulo).props.returnKeyType).toBe('next');
      await fireEvent(screen.getByLabelText(rotulo), 'submitEditing');
    }
    expect(focados()).toEqual(['Email', 'Senha', 'Confirmar senha']);

    const olhos = screen.getAllByRole('button', { name: 'Mostrar senha' });
    expect(olhos).toHaveLength(2);
    await fireEvent.press(olhos[1]);
    expect(oculta('Senha')).toBe(true);
    expect(oculta('Confirmar senha')).toBe(false);

    expect(screen.getByLabelText('Confirmar senha').props.returnKeyType).toBe('go');
    await fireEvent(screen.getByLabelText('Confirmar senha'), 'submitEditing');
    await waitFor(() => expect(api.para('POST /auth/registro')).toHaveLength(1));
  });
});
