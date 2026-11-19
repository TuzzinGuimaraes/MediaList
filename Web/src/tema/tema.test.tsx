import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { simularEsquemaDeCor } from '../testes/ambiente';
import { abrirLogado } from '../testes/app';

const html = () => document.documentElement;

describe('troca de tema', () => {
  it('o escuro é o padrão, mesmo com o sistema no claro', async () => {
    simularEsquemaDeCor('claro');
    await abrirLogado('/perfil');

    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeChecked();
    expect(html()).not.toHaveClass('claro');
  });

  it('escolher Claro aplica na hora e vale ao reabrir', async () => {
    const { user, tela } = await abrirLogado('/perfil');

    await user.click(screen.getByRole('radio', { name: 'Claro' }));
    expect(html()).toHaveClass('claro');

    tela.unmount();
    html().className = '';
    await abrirLogado('/perfil');

    expect(screen.getByRole('radio', { name: 'Claro' })).toBeChecked();
    expect(html()).toHaveClass('claro');
  });

  it('Sistema segue o esquema do sistema operacional, inclusive quando ele muda', async () => {
    const { user } = await abrirLogado('/perfil');

    await user.click(screen.getByRole('radio', { name: 'Sistema' }));
    expect(html()).not.toHaveClass('claro');

    simularEsquemaDeCor('claro');
    await waitFor(() => expect(html()).toHaveClass('claro'));
  });

  it('preferência guardada inválida cai no escuro', async () => {
    localStorage.setItem('medialist.tema', 'roxo');
    await abrirLogado('/perfil');

    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeChecked();
  });
});
