import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { abrirLogado, adminBia } from '../testes/app';

describe('guarda de admin', () => {
  it('Usuário comum que abre /admin vai para o Início', async () => {
    const { historico } = await abrirLogado('/admin');

    expect(historico.location.pathname).toBe('/');
    expect(screen.queryByRole('heading', { name: 'Administração' })).not.toBeInTheDocument();
  });

  it('Usuário comum não vê Administração no menu da conta', async () => {
    const { user } = await abrirLogado('/');

    await user.click(screen.getByRole('button', { name: 'Conta' }));

    expect(screen.queryByRole('menuitem', { name: 'Administração' })).not.toBeInTheDocument();
  });

  it('admin abre /admin', async () => {
    await abrirLogado('/admin', { usuario: adminBia });

    expect(await screen.findByRole('heading', { name: 'Administração' })).toBeInTheDocument();
  });

  it('admin chega à Administração pelo menu da conta', async () => {
    const { user, historico } = await abrirLogado('/', { usuario: adminBia });

    await user.click(screen.getByRole('button', { name: 'Conta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Administração' }));

    expect(await screen.findByRole('heading', { name: 'Administração' })).toBeInTheDocument();
    expect(historico.location.pathname).toBe('/admin');
  });
});
