import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { abrirLogado } from '../../testes/app';
import { midia, rotasDoInicio } from './dadosDeTeste';

afterEach(() => {
  vi.useRealTimers();
});

/** "Reduzir movimento" ligado no sistema; o resto do `matchMedia` segue o do ambiente. */
function simularReduzirMovimento() {
  const original = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((consulta) =>
    consulta.includes('prefers-reduced-motion') ? { ...original(consulta), matches: true } : original(consulta),
  );
}

const frieren = midia('ANI-1', 'Sousou no Frieren', { nota_media: 9.1, generos_lista: ['Aventura', 'Drama'] });
const berserk = midia('MAN-1', 'Berserk', { tipo: 'manga', nota_media: 9.3 });

describe('Início: destaque', () => {
  it('mostra a Mídia de maior nota de Em alta, juntando os Tipos do catálogo', async () => {
    await abrirLogado('/', { rotas: rotasDoInicio({ emAlta: [frieren, berserk] }) });

    const destaques = await screen.findByRole('region', { name: 'Destaques' });
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();
    expect(within(destaques).getByRole('link', { name: 'Detalhes: Berserk' })).toHaveAttribute('href', '/midia/MAN-1');
  });

  it('troca a cada 6 s e volta ao primeiro depois do último', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await abrirLogado('/', { rotas: rotasDoInicio({ emAlta: [frieren, berserk] }) });
    const destaques = await screen.findByRole('region', { name: 'Destaques' });

    act(() => vi.advanceTimersByTime(5900));
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(100));
    expect(within(destaques).getByRole('heading', { name: 'Sousou no Frieren' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6000));
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();
  });

  it('pausa com o mouse em cima e com o foco dentro', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await abrirLogado('/', { rotas: rotasDoInicio({ emAlta: [frieren, berserk] }) });
    const destaques = await screen.findByRole('region', { name: 'Destaques' });

    fireEvent.mouseEnter(destaques);
    act(() => vi.advanceTimersByTime(12000));
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();

    fireEvent.mouseLeave(destaques);
    act(() => within(destaques).getByRole('link', { name: 'Detalhes: Berserk' }).focus());
    act(() => vi.advanceTimersByTime(12000));
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();
  });

  it('com "reduzir movimento", não troca sozinho; os pontos trocam à mão', async () => {
    simularReduzirMovimento();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await abrirLogado('/', { rotas: rotasDoInicio({ emAlta: [frieren, berserk] }) });
    const destaques = await screen.findByRole('region', { name: 'Destaques' });

    act(() => vi.advanceTimersByTime(12000));
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();

    fireEvent.click(within(destaques).getByRole('button', { name: 'Destaque 2: Sousou no Frieren' }));
    expect(within(destaques).getByRole('heading', { name: 'Sousou no Frieren' })).toBeInTheDocument();
  });
});
