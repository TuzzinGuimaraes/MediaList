import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { erro } from '../testes/fetchSimulado';
import { abrirApp, loginOk, preencherLogin, usuarioAna } from '../testes/app';

// O olho dos campos de senha: começa oculta, alterna e volta a ocultar ao enviar.

const tipo = (rotulo: string) => (screen.getByLabelText(rotulo) as HTMLInputElement).type;

describe('mostrar senha', () => {
  it('no login, o olho alterna com aria-pressed e enviar oculta de novo', async () => {
    const { user } = abrirApp('/entrar', {
      rotas: { 'POST /auth/login': erro(401, 'nao_autenticado', 'Email ou senha incorretos') },
    });
    await user.type(await screen.findByLabelText('Email'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'errada');
    expect(tipo('Senha')).toBe('password');

    const olho = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(olho).toHaveAttribute('aria-pressed', 'false');
    await user.click(olho);
    expect(tipo('Senha')).toBe('text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha incorretos');
    expect(tipo('Senha')).toBe('password');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('o olho não envia o formulário', async () => {
    const { user, api } = abrirApp('/entrar');
    await user.type(await screen.findByLabelText('Senha'), 'segredo1');
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(api.para('POST /auth/login')).toHaveLength(0);
    expect(tipo('Senha')).toBe('text');
  });

  it('no cadastro, a senha tem o olho', async () => {
    const { user } = abrirApp('/registro');
    await user.type(await screen.findByLabelText('Senha'), 'segredo1');

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(tipo('Senha')).toBe('text');
  });

  it('na troca de senha, os três campos têm o olho e enviar oculta todos', async () => {
    const comTroca = { ...loginOk(), corpo: { ...(loginOk().corpo as object), deve_trocar_senha: true } };
    const { user } = abrirApp('/', { rotas: { 'POST /auth/login': comTroca } });
    await preencherLogin(user, usuarioAna.email, 'Tk7pQ2mX');
    await screen.findByRole('heading', { name: 'Defina sua nova senha' });
    const campos = ['Senha temporária', 'Nova senha', 'Confirme a nova senha'] as const;
    await user.type(screen.getByLabelText(campos[0]), 'Tk7pQ2mX');
    await user.type(screen.getByLabelText(campos[1]), '12345');
    await user.type(screen.getByLabelText(campos[2]), '12345');

    const olhos = screen.getAllByRole('button', { name: 'Mostrar senha' });
    expect(olhos).toHaveLength(3);
    for (const olho of olhos) await user.click(olho);
    expect(campos.map(tipo)).toEqual(['text', 'text', 'text']);

    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A nova senha precisa ter pelo menos 6 caracteres.');
    expect(campos.map(tipo)).toEqual(['password', 'password', 'password']);
  });
});
