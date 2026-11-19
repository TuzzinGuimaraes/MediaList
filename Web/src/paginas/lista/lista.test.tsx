import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { abrirLogado } from '../../testes/app';
import { erro } from '../../testes/fetchSimulado';
import { rotasDaLista, umaMidia, umItem } from './fixtures';

describe('Minha Lista', () => {
  it('mostra uma aba por Status com a contagem, e a aba ativa com o título e os Itens dela', async () => {
    const itens = [
      umItem({ titulo_original: 'Frieren', status_consumo: 'assistindo' }),
      umItem({ titulo_original: 'Berserk', tipo: 'manga', status_consumo: 'lendo', numero_episodios: null, numero_capitulos: 380, progresso_total: 380 }),
      umItem({ titulo_original: 'Mushishi', status_consumo: 'planejado', progresso_atual: 0 }),
    ];
    await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    const abas = await screen.findByRole('tablist', { name: 'Status da Lista' });
    expect(within(abas).getByRole('tab', { name: 'Em progresso 2' })).toHaveAttribute('aria-selected', 'true');
    expect(within(abas).getByRole('tab', { name: 'Planejado 1' })).toBeInTheDocument();
    expect(within(abas).getByRole('tab', { name: 'Concluído 0' })).toBeInTheDocument();
    expect(within(abas).queryByRole('tab', { name: /Platinado/ })).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Em progresso · 2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Anime · 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mangá · 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Frieren' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Berserk' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Mushishi' })).not.toBeInTheDocument();
  });
});


describe('Minha Lista: abas, filtros e busca', () => {
  it('trocar de aba mostra os Itens daquele Status; o Concluído inclui os platinados no catálogo Jogos', async () => {
    localStorage.setItem('medialist.catalogo', 'jogos');
    const itens = [
      umItem({ titulo_original: 'Hades', tipo: 'jogo', status_consumo: 'platinado', progresso_total: null, numero_episodios: null }),
      umItem({ titulo_original: 'Celeste', tipo: 'jogo', status_consumo: 'zerado', progresso_total: null, numero_episodios: null }),
      umItem({ titulo_original: 'Frieren' }),
    ];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    await user.click(await screen.findByRole('tab', { name: 'Concluído 2' }));

    expect(screen.getByRole('heading', { name: 'Concluído · 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Hades' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Celeste' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Platinado 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Anime ·/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Frieren' })).not.toBeInTheDocument();
  });

  it('as setas do teclado movem entre as abas', async () => {
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista([umItem()]) });

    await user.click(await screen.findByRole('tab', { name: /Em progresso/ }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: /Planejado/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Planejado/ })).toHaveFocus();
  });

  it('o filtro de Gênero vale para todas as abas e as contagens o refletem', async () => {
    const itens = [
      umItem({ titulo_original: 'Frieren', generos_lista: ['Fantasia'] }),
      umItem({ titulo_original: 'Monster', generos_lista: ['Suspense'] }),
      umItem({ titulo_original: 'Mushishi', status_consumo: 'planejado', generos_lista: ['Fantasia'] }),
      umItem({ titulo_original: 'Perfect Blue', status_consumo: 'planejado', generos_lista: ['Suspense'] }),
    ];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    await user.click(await screen.findByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros da Lista' });
    await user.click(within(sheet).getByRole('radio', { name: 'Fantasia' }));
    await user.click(within(sheet).getByRole('button', { name: 'Ver Itens' }));

    expect(screen.getByRole('tab', { name: 'Em progresso 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Planejado 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Frieren' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Monster' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros, 1 ativo' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Pausado 0' }));
    expect(screen.getByText('Nenhum Item em Pausado com esses filtros.')).toBeInTheDocument();
  });

  it('a Ordem por Nota pessoal reordena os cards', async () => {
    const itens = [
      umItem({ titulo_original: 'Akira', nota_usuario: 6 }),
      umItem({ titulo_original: 'Berserk', nota_usuario: 9 }),
      umItem({ titulo_original: 'Cowboy Bebop', nota_usuario: null }),
    ];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    await user.click(await screen.findByRole('button', { name: 'Filtros' }));
    await user.click(screen.getByRole('radio', { name: 'Nota pessoal' }));

    const titulos = screen.getAllByRole('button', { name: /^Editar / }).map((b) => b.getAttribute('aria-label'));
    expect(titulos).toEqual(['Editar Berserk', 'Editar Akira', 'Editar Cowboy Bebop']);
  });

  it('a busca procura em todos os Status e mostra o Status em cada resultado', async () => {
    const itens = [
      umItem({ titulo_original: 'Shingeki no Kyojin', titulo_portugues: 'Ataque dos Titãs', status_consumo: 'completo', progresso_atual: 12 }),
      umItem({ titulo_original: 'Frieren' }),
    ];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    await user.click(await screen.findByRole('button', { name: 'Buscar na Lista' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar na Lista' }), 'titas');

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('1 resultado para “titas” em todos os Status')).toBeInTheDocument();
    const resultados = screen.getByRole('region', { name: 'Resultados da busca' });
    expect(within(resultados).getByRole('button', { name: 'Editar Ataque dos Titãs' })).toBeInTheDocument();
    expect(within(resultados).getByText('Concluído')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('tablist', { name: 'Status da Lista' })).toBeInTheDocument();
  });

  it('"Sugestões para você" mostra o Em alta que não está na Lista', async () => {
    const naLista = umItem({ titulo_original: 'Frieren' });
    const emAlta = [umaMidia({ id_midia: naLista.id_midia, titulo_original: 'Frieren' }), umaMidia({ titulo_original: 'Dandadan' })];
    await abrirLogado('/lista', { rotas: rotasDaLista([naLista], emAlta) });

    const sugestoes = await screen.findByRole('region', { name: 'Sugestões para você' });
    expect(within(sugestoes).getByRole('link', { name: /Dandadan/ })).toBeInTheDocument();
    expect(within(sugestoes).queryByRole('link', { name: /Frieren/ })).not.toBeInTheDocument();
  });
});


describe('Minha Lista: stepper do Progresso', () => {
  it('+1 aparece na hora e vai ao servidor como PUT /progresso', async () => {
    let liberar: () => void = () => {};
    const item = umItem({ titulo_original: 'Frieren', progresso_atual: 3 });
    const { user, api } = await abrirLogado('/lista', {
      rotas: {
        ...rotasDaLista([item]),
        [`PUT /lista/${item.id_lista}/progresso`]: () =>
          new Promise((r) => {
            liberar = () => r({ status: 200, corpo: { mensagem: 'ok' } });
          }),
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Mais um em Frieren' }));

    expect(screen.getByLabelText('Progresso: 4 de 12')).toBeInTheDocument();
    expect(api.para(`PUT /lista/${item.id_lista}/progresso`)[0]?.corpo).toEqual({ progresso_atual: 4 });
    liberar();
  });

  it('chegar ao total leva o Item a Concluído antes da resposta (ADR 0009)', async () => {
    const item = umItem({ titulo_original: 'Frieren', progresso_atual: 11 });
    const { user } = await abrirLogado('/lista', {
      rotas: {
        ...rotasDaLista([item]),
        [`PUT /lista/${item.id_lista}/progresso`]: () => new Promise(() => {}),
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Mais um em Frieren' }));

    expect(screen.getByRole('tab', { name: 'Concluído 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Em progresso 0' })).toBeInTheDocument();
  });

  it('um toque recusado é desfeito e o erro aparece', async () => {
    const item = umItem({ titulo_original: 'Frieren', progresso_atual: 3 });
    const { user } = await abrirLogado('/lista', {
      rotas: {
        ...rotasDaLista([item]),
        [`PUT /lista/${item.id_lista}/progresso`]: erro(400, 'dados_invalidos', 'Progresso acima do total.'),
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Mais um em Frieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Progresso acima do total.');
    expect(screen.getByLabelText('Progresso: 3 de 12')).toBeInTheDocument();
  });

  it('o − fica desativado no 0 e o + no total', async () => {
    const itens = [
      umItem({ titulo_original: 'Novo', progresso_atual: 0, status_consumo: 'assistindo' }),
      umItem({ titulo_original: 'Quase', progresso_atual: 12, status_consumo: 'assistindo' }),
    ];
    await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    expect(await screen.findByRole('button', { name: 'Menos um em Novo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mais um em Quase' })).toBeDisabled();
  });
});
