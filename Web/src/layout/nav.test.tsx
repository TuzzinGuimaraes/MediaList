import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { simularLargura } from '../testes/ambiente';
import { abrirLogado } from '../testes/app';

const rotasDaLista = { 'GET /lista': { status: 200, corpo: { lista: [] } }, 'GET /midias/trending': { status: 200, corpo: { midias: [] } } };

describe('nav no topo, do desktop ao tablet', () => {
  it('no desktop, os itens ficam à vista, sem o botão de menu', async () => {
    await abrirLogado('/lista', { rotas: rotasDaLista });

    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Explorar' })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('abaixo de 1024px, os itens vão para um menu, que fecha ao navegar', async () => {
    simularLargura(800);
    const { user, historico } = await abrirLogado('/lista', { rotas: rotasDaLista });

    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).queryByRole('link', { name: 'Explorar' })).not.toBeInTheDocument();

    const menu = within(nav).getByRole('button', { name: 'Menu' });
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(within(nav).getByRole('link', { name: 'Minha Lista' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(nav).getByRole('link', { name: 'Notícias' }));

    await waitFor(() => expect(historico.location.pathname).toBe('/noticias'));
    expect(within(nav).queryByRole('link', { name: 'Explorar' })).not.toBeInTheDocument();
  });

  it('a nav acompanha a janela redimensionada', async () => {
    await abrirLogado('/lista', { rotas: rotasDaLista });

    act(() => simularLargura(900));

    expect(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });
});
