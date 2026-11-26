import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { consultaDoCalendario } from '@dominio/calendario';

import type { EpisodioDoCalendario as Episodio } from '@dominio/tipos';

import type { Esquemas } from '../../api/tipos';
import { abrirLogado } from '../../testes/app';
import { simularLargura } from '../../testes/ambiente';
import type { Rotas } from '../../testes/fetchSimulado';
import { item, midia } from '../inicio/dadosDeTeste';

// Sábado, 14/11/2026, 12:00 no fuso do teste: a Temporada atual é Outono 2026. As horas dos
// episódios são montadas no mesmo fuso que o navegador (simulado) informa.
const AGORA = new Date(2026, 10, 14, 12);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: AGORA });
});
afterEach(() => {
  vi.useRealTimers();
});

const FUSO = Intl.DateTimeFormat().resolvedOptions().timeZone;

function episodio(id: string, titulo: string, numero: number, quando: Date, exibido = false): Episodio {
  return {
    id_midia: id,
    tipo: 'anime',
    titulo_original: titulo,
    titulo_ingles: null,
    titulo_portugues: null,
    poster_url: null,
    episodio: numero,
    instante: quando.toISOString(),
    exibido,
  };
}

const frieren = midia('A1', 'Frieren');
const dandadan = midia('A2', 'Dandadan');
const pausado = midia('A3', 'Pausado');

const EPISODIOS = [
  episodio('A1', 'Frieren', 10, new Date(2026, 10, 14, 8), true),
  episodio('A2', 'Dandadan', 5, new Date(2026, 10, 14, 22, 30)),
  episodio('A3', 'Pausado', 3, new Date(2026, 10, 16, 20)),
  episodio('A1', 'Frieren', 11, new Date(2026, 10, 20, 18)),
];

type Opcoes = { episodios?: Episodio[]; lista?: Esquemas['ItemLista'][] };

function rotas({ episodios = EPISODIOS, lista = [] }: Opcoes = {}): Rotas {
  return {
    'GET /midias': { status: 200, corpo: { itens: [], pagina: 1, por_pagina: 50, total: 0 } },
    'GET /midias/facetas': { status: 200, corpo: { plataformas: [], estudios: [], temporada_mais_antiga: { estacao: 'verao', ano: 2025 } } },
    'GET /midias/calendario': { status: 200, corpo: { episodios } },
    'GET /lista': { status: 200, corpo: { lista } },
  };
}

const LISTA = [item(frieren), item(pausado, { status_consumo: 'pausado' })];

describe('Calendário da Temporada', () => {
  it('a aba fica na URL e pede os 7 dias de Hoje em diante, no fuso do navegador', async () => {
    const { user, historico, api } = await abrirLogado('/temporada', { rotas: rotas() });

    await user.click(await screen.findByRole('tab', { name: 'Calendário' }));

    expect(new URLSearchParams(historico.location.search).get('aba')).toBe('calendario');
    expect(screen.getByRole('tab', { name: 'Calendário' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(api.para('GET /midias/calendario')).toHaveLength(1));
    expect(Object.fromEntries(api.para('GET /midias/calendario')[0]!.query)).toEqual(consultaDoCalendario(AGORA, FUSO));

    await user.click(screen.getByRole('tab', { name: 'Animes' }));
    expect(new URLSearchParams(historico.location.search).get('aba')).toBeNull();
  });

  it('só a Temporada atual tem a aba', async () => {
    const { api } = await abrirLogado('/temporada?estacao=inverno&ano=2027&aba=calendario', { rotas: rotas() });

    expect(await screen.findByRole('heading', { name: 'Inverno 2027' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Calendário' })).not.toBeInTheDocument();
    expect(api.para('GET /midias/calendario')).toHaveLength(0);
  });

  it('mostra os 7 dias com a hora local, o "foi ao ar", a nota do horário e o dia vazio', async () => {
    await abrirLogado('/temporada?aba=calendario', { rotas: rotas() });

    const hoje = await screen.findByRole('region', { name: 'Hoje' });
    const dias = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(dias).toEqual(['Hoje', 'Amanhã', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira']);

    const exibido = within(hoje).getByRole('link', { name: /Frieren/ }).closest('li')!;
    expect(within(exibido).getByText('08:00')).toBeInTheDocument();
    expect(within(exibido).getByText('foi ao ar')).toBeInTheDocument();
    const proximo = within(hoje).getByRole('link', { name: /Dandadan/ }).closest('li')!;
    expect(within(proximo).getByText('22:30')).toBeInTheDocument();
    expect(within(proximo).getByText('Ep. 5')).toBeInTheDocument();
    expect(within(proximo).queryByText('foi ao ar')).not.toBeInTheDocument();
    expect(within(hoje).getByText(/^agora/i)).toBeInTheDocument();

    expect(within(screen.getByRole('region', { name: 'Amanhã' })).getByText('Nenhum episódio neste dia.')).toBeInTheDocument();
    expect(screen.getByText(/horário da exibição no Japão/)).toBeInTheDocument();
  });

  it('o marcador "agora" traz a hora local', async () => {
    await abrirLogado('/temporada?aba=calendario', { rotas: rotas() });

    const hoje = await screen.findByRole('region', { name: 'Hoje' });
    expect(within(hoje).getByRole('listitem', { name: 'Agora, 12:00' })).toBeInTheDocument();
  });

  it('sem nenhum episódio na semana, um aviso só, sem a faixa e sem "Ver todos os animes"', async () => {
    await abrirLogado('/temporada?aba=calendario', { rotas: rotas({ episodios: [] }) });

    expect(await screen.findByText('Nenhum episódio nos próximos 7 dias.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Dias' })).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum episódio neste dia.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver todos os animes' })).not.toBeInTheDocument();
  });

  it('tocar no episódio abre o Detalhe', async () => {
    await abrirLogado('/temporada?aba=calendario', { rotas: rotas() });

    const hoje = await screen.findByRole('region', { name: 'Hoje' });
    expect(within(hoje).getByRole('link', { name: /Dandadan/ })).toHaveAttribute('href', '/midia/A2');
  });

  it('"Só os meus" começa ligado para quem tem um dos seus na semana, sem Pausado', async () => {
    const { user } = await abrirLogado('/temporada?aba=calendario', { rotas: rotas({ lista: LISTA }) });

    const filtro = await screen.findByRole('checkbox', { name: 'Só os meus' });
    await waitFor(() => expect(filtro).toBeChecked());
    const hoje = screen.getByRole('region', { name: 'Hoje' });
    expect(within(hoje).getByRole('link', { name: /Frieren/ })).toBeInTheDocument();
    expect(within(hoje).queryByRole('link', { name: /Dandadan/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pausado/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Amanhã' })).getByText('Nenhum dos seus sai neste dia.')).toBeInTheDocument();

    await user.click(filtro);
    expect(within(hoje).getByRole('link', { name: /Dandadan/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pausado/ })).toBeInTheDocument();
  });

  it('sem nenhum dos seus na semana, o filtro começa desligado', async () => {
    await abrirLogado('/temporada?aba=calendario', { rotas: rotas({ lista: [item(pausado, { status_consumo: 'pausado' })] }) });

    await screen.findByRole('region', { name: 'Hoje' });
    expect(screen.getByRole('checkbox', { name: 'Só os meus' })).not.toBeChecked();
    expect(screen.getByRole('link', { name: /Dandadan/ })).toBeInTheDocument();
  });

  it('avisa quando o filtro esconde a semana inteira', async () => {
    const soDandadan = [episodio('A2', 'Dandadan', 5, new Date(2026, 10, 14, 22, 30))];
    const { user } = await abrirLogado('/temporada?aba=calendario', {
      rotas: rotas({ episodios: soDandadan, lista: [item(frieren)] }),
    });

    const filtro = await screen.findByRole('checkbox', { name: 'Só os meus' });
    expect(filtro).not.toBeChecked();
    await user.click(filtro);
    expect(screen.getByText('Nenhum dos seus animes sai nos próximos 7 dias.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver todos os animes' }));
    expect(screen.getByRole('link', { name: /Dandadan/ })).toBeInTheDocument();
  });

  it('"A seguir dos seus" mostra o próximo dos seus, mesmo com o filtro desligado', async () => {
    const { user } = await abrirLogado('/temporada?aba=calendario', { rotas: rotas({ lista: LISTA }) });

    const bloco = await screen.findByRole('complementary', { name: 'A seguir dos seus' });
    expect(within(bloco).getByRole('link', { name: /Frieren/ })).toHaveAttribute('href', '/midia/A1');
    expect(within(bloco).getByText('Ep. 11 · Sexta-feira, 18:00')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Só os meus' }));
    expect(screen.getByRole('complementary', { name: 'A seguir dos seus' })).toBeInTheDocument();
  });

  it('sem nenhum dos seus para sair, "A seguir dos seus" some', async () => {
    await abrirLogado('/temporada?aba=calendario', { rotas: rotas() });

    await screen.findByRole('region', { name: 'Hoje' });
    expect(screen.queryByRole('complementary', { name: 'A seguir dos seus' })).not.toBeInTheDocument();
  });

  it('"Planejado" põe o anime na Lista e vira "Na Lista"; os da Lista já mostram "Na Lista"', async () => {
    const lista = [item(frieren)];
    const { user, api } = await abrirLogado('/temporada?aba=calendario', {
      rotas: {
        ...rotas(),
        'GET /lista': () => ({ status: 200, corpo: { lista } }),
        'POST /lista/adicionar': () => {
          lista.push(item(dandadan, { status_consumo: 'planejado' }));
          return { status: 201, corpo: { mensagem: 'ok', id_lista: 'L-A2' } };
        },
      },
    });

    await user.click(await screen.findByRole('checkbox', { name: 'Só os meus' }));
    const hoje = screen.getByRole('region', { name: 'Hoje' });
    const linhaFrieren = within(hoje).getByRole('link', { name: /Frieren/ }).closest('li')!;
    expect(within(linhaFrieren).getByText('Na Lista')).toBeInTheDocument();

    await user.click(within(hoje).getByRole('button', { name: 'Pôr Dandadan em Planejado' }));
    expect(api.para('POST /lista/adicionar')[0]!.corpo).toEqual({ id_midia: 'A2', status_consumo: 'planejado' });
    const linhaDandadan = within(hoje).getByRole('link', { name: /Dandadan/ }).closest('li')!;
    expect(await within(linhaDandadan).findByText('Na Lista')).toBeInTheDocument();
  });

  it('a faixa de dias traz a contagem de cada dia', async () => {
    await abrirLogado('/temporada?aba=calendario', { rotas: rotas() });

    const faixa = await screen.findByRole('navigation', { name: 'Dias' });
    expect(within(faixa).getByRole('button', { name: 'Hoje, 14/11, 2 episódios' })).toHaveAttribute('aria-current', 'true');
    expect(within(faixa).getByRole('button', { name: 'Amanhã, 15/11, nenhum episódio' })).toBeInTheDocument();
    expect(within(faixa).getByRole('button', { name: 'Segunda-feira, 16/11, 1 episódio' })).toBeInTheDocument();
  });

  it('a Semana fica guardada no navegador; no desktop, sem a faixa e com a contagem na coluna', async () => {
    const { user } = await abrirLogado('/temporada?aba=calendario', { rotas: rotas() });

    expect(await screen.findByRole('radio', { name: 'Agenda' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Semana' }));
    expect(screen.getByRole('radio', { name: 'Semana' })).toBeChecked();
    expect(localStorage.getItem('medialist.calendario.vista')).toBe('semana');
    expect(screen.queryByRole('navigation', { name: 'Dias' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Hoje' })).getByRole('heading')).toHaveTextContent('Hoje · 2');
    expect(within(screen.getByRole('region', { name: 'Hoje' })).getByRole('link', { name: /Dandadan/ })).toHaveAttribute('href', '/midia/A2');
  });

  it('no celular, a Semana tem a faixa de dias', async () => {
    simularLargura(390);
    const { user } = await abrirLogado('/temporada?aba=calendario', { rotas: rotas() });
    await user.click(await screen.findByRole('radio', { name: 'Semana' }));
    expect(screen.getByRole('navigation', { name: 'Dias' })).toBeInTheDocument();
  });

  it('abre na visualização guardada', async () => {
    localStorage.setItem('medialist.calendario.vista', 'semana');
    await abrirLogado('/temporada?aba=calendario', { rotas: rotas() });

    expect(await screen.findByRole('radio', { name: 'Semana' })).toBeChecked();
  });
});
