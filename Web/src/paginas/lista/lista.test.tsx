import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { abrirLogado, usuarioAna } from '../../testes/app';
import { erro } from '../../testes/fetchSimulado';
import { rotasDaLista, umItem } from './fixtures';
import { chaveDasPreferencias } from './preferencias';

const coluna = () => screen.getByRole('complementary', { name: 'Busca, Status e filtros' });
const statusDaColuna = () => within(coluna()).getByRole('navigation', { name: 'Status' });
/** Os nomes dos cards, na ordem da tela (o nome do link começa pelo título). */
const cards = (dentro: HTMLElement = document.body) =>
  within(dentro)
    .queryAllByRole('listitem')
    .filter((li) => li.hasAttribute('aria-posinset'))
    .map((li) => within(li).getByRole('link').getAttribute('aria-label')?.split(',')[0]);
const secao = (nome: string) => screen.getByRole('region', { name: new RegExp(`^${nome}`) });

const jogo = (campos: Parameters<typeof umItem>[0]) =>
  umItem({ tipo: 'jogo', status_consumo: 'jogando', progresso_total: null, numero_episodios: null, status_anime: null, ...campos });

describe('Minha Lista: coluna e "Todos"', () => {
  it('abre em "Todos", separado por Status; os platinados só dentro do Concluído, com o selo', async () => {
    const itens = [
      umItem({ titulo_original: 'Frieren' }),
      umItem({ titulo_original: 'Mushishi', status_consumo: 'planejado', progresso_atual: 0 }),
      umItem({ titulo_original: 'Monster', status_consumo: 'completo', progresso_atual: 12 }),
      jogo({ titulo_original: 'Hades', status_consumo: 'platinado', progresso_atual: 80 }),
    ];
    await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    expect(await screen.findByRole('button', { name: 'Todos 4' })).toHaveAttribute('aria-current', 'true');
    const status = statusDaColuna();
    expect(within(status).getByRole('button', { name: 'Em progresso 1' })).toBeInTheDocument();
    expect(within(status).getByRole('button', { name: 'Concluído 2' })).toBeInTheDocument();
    expect(within(status).getByRole('button', { name: 'Platinado 1' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: 'Em progresso 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Planejado 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /^Pausado/ })).not.toBeInTheDocument();
    expect(cards(secao('Concluído'))).toEqual(['Monster', 'Hades']);
    // Platinado sem seção própria no "Todos": só dentro do Concluído, com o selo no Item.
    expect(screen.queryByRole('heading', { level: 2, name: /^Platinado/ })).not.toBeInTheDocument();
    const hades = within(secao('Concluído')).getByRole('link', { name: /^Hades, platinado/ });
    expect(within(hades).getByText('Platinado')).toBeInTheDocument();
    const somaDasSecoes = screen
      .getAllByRole('heading', { level: 2 })
      .reduce((n, h) => n + Number(h.textContent?.match(/\d+$/)?.[0] ?? 0), 0);
    expect(somaDasSecoes).toBe(4);
    // Com o Tipo "Todos", subseções por Tipo dentro de cada Status.
    expect(within(secao('Concluído')).getByRole('heading', { level: 3, name: 'Anime 1' })).toBeInTheDocument();
    expect(within(secao('Concluído')).getByRole('heading', { level: 3, name: 'Jogos 1' })).toBeInTheDocument();
  });

  it('o Status Platinado da coluna mostra só os platinados', async () => {
    const itens = [
      umItem({ titulo_original: 'Monster', status_consumo: 'completo', progresso_atual: 12 }),
      jogo({ titulo_original: 'Celeste', status_consumo: 'zerado', progresso_atual: 20 }),
      jogo({ titulo_original: 'Hades', status_consumo: 'platinado', progresso_atual: 80 }),
    ];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    await user.click(await screen.findByRole('button', { name: 'Platinado 1' }));
    expect(cards()).toEqual(['Hades']);
  });

  it('escolher um Status mostra só ele, e o cabeçalho diz qual é e quantos são', async () => {
    const itens = [umItem({ titulo_original: 'Frieren' }), umItem({ titulo_original: 'Mushishi', status_consumo: 'planejado' })];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    await user.click(await screen.findByRole('button', { name: 'Planejado 1' }));

    expect(screen.getByRole('button', { name: 'Planejado 1' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Todos 2' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Planejado', { selector: 'p span' })).toBeInTheDocument();
    expect(cards()).toEqual(['Mushishi']);
  });

  it('o Tipo filtra a Lista e as contagens de Status; sem subseções com um Tipo só', async () => {
    const itens = [
      umItem({ titulo_original: 'Frieren' }),
      umItem({ titulo_original: 'Berserk', tipo: 'manga', status_consumo: 'lendo', numero_capitulos: 380, progresso_total: 380 }),
      jogo({ titulo_original: 'Hades', progresso_atual: 80 }),
    ];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    const tipo = within(await screen.findByRole('group', { name: 'Tipo' }));
    expect(tipo.getByRole('radio', { name: 'Todos 3' })).toBeChecked();
    expect(tipo.getByRole('radio', { name: 'Anime 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Platinado/ })).toBeInTheDocument();

    await user.click(tipo.getByRole('radio', { name: 'Jogos 1' }));

    expect(cards()).toEqual(['Hades']);
    expect(screen.getByRole('button', { name: 'Todos 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Em progresso 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();

    await user.click(tipo.getByRole('radio', { name: 'Anime 1' }));
    // Platinado só existe em jogo.
    expect(screen.queryByRole('button', { name: /^Platinado/ })).not.toBeInTheDocument();
  });

  it('o Gênero vale para todos os Status e as contagens (de Status e de Tipo) o refletem', async () => {
    const itens = [
      umItem({ titulo_original: 'Frieren', generos_lista: ['Fantasia'] }),
      umItem({ titulo_original: 'Monster', generos_lista: ['Suspense'] }),
      umItem({ titulo_original: 'Mushishi', status_consumo: 'planejado', generos_lista: ['Fantasia'] }),
    ];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    await screen.findByRole('complementary', { name: 'Busca, Status e filtros' });
    await user.click(within(coluna()).getByRole('button', { name: 'Fantasia' }));

    expect(within(coluna()).getByRole('button', { name: 'Fantasia' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Em progresso 1' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Anime 2' })).toBeInTheDocument();
    expect(cards()).toEqual(['Frieren', 'Mushishi']);

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(cards()).toHaveLength(3);
  });
});

describe('Minha Lista: Ordem', () => {
  it('padrão: anime/mangá pela maior nota e jogos pelas mais horas, sem nota/horas no fim', async () => {
    const itens = [
      umItem({ titulo_original: 'Akira', nota_usuario: null }),
      umItem({ titulo_original: 'Monster', nota_usuario: 9 }),
      umItem({ titulo_original: 'Frieren', nota_usuario: 10 }),
      jogo({ titulo_original: 'Celeste', progresso_atual: 0 }),
      jogo({ titulo_original: 'Hades', progresso_atual: 80 }),
      jogo({ titulo_original: 'Elden Ring', progresso_atual: 140 }),
    ];
    await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    const emProgresso = await screen.findByRole('region', { name: /^Em progresso/ });
    expect(cards(within(emProgresso).getByRole('list', { name: 'Em progresso, Anime' }))).toEqual(['Frieren', 'Monster', 'Akira']);
    expect(cards(within(emProgresso).getByRole('list', { name: 'Em progresso, Jogos' }))).toEqual(['Elden Ring', 'Hades', 'Celeste']);
  });

  it('Ordem e direção ficam salvas por Usuário e valem ao voltar', async () => {
    const itens = [umItem({ titulo_original: 'Berserk' }), umItem({ titulo_original: 'Akira' }), umItem({ titulo_original: 'Cowboy Bebop' })];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Ordem' }), 'Título');
    expect(cards()).toEqual(['Akira', 'Berserk', 'Cowboy Bebop']);
    await user.click(screen.getByRole('button', { name: 'Direção: crescente. Inverter' }));
    expect(cards()).toEqual(['Cowboy Bebop', 'Berserk', 'Akira']);
    expect(screen.getByRole('button', { name: 'Direção: decrescente. Inverter' })).toBeInTheDocument();

    expect(JSON.parse(localStorage.getItem(chaveDasPreferencias(usuarioAna.id)) ?? '{}')).toEqual({
      formato: 'grade',
      ordem: 'titulo',
      inversa: true,
    });
  });

  it('lê a Ordem salva; valor estranho cai no padrão', async () => {
    localStorage.setItem(chaveDasPreferencias(usuarioAna.id), JSON.stringify({ ordem: 'titulo', inversa: 'sim', formato: 'mosaico' }));
    const itens = [umItem({ titulo_original: 'Berserk' }), umItem({ titulo_original: 'Akira' })];
    await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    expect(await screen.findByRole('combobox', { name: 'Ordem' })).toHaveValue('titulo');
    expect(cards()).toEqual(['Akira', 'Berserk']);
  });
});

describe('Minha Lista: busca', () => {
  it('filtra todos os Status e as contagens; sem resultado no Status atual, oferece "Ver N em Todos"', async () => {
    const itens = [
      umItem({ titulo_original: 'Frieren' }),
      umItem({ titulo_original: 'Fruits Basket', status_consumo: 'planejado' }),
      umItem({ titulo_original: 'Monster', status_consumo: 'pausado' }),
    ];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    await user.click(await screen.findByRole('button', { name: 'Pausado 1' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar na Lista' }), 'fr');

    expect(screen.getByRole('button', { name: 'Pausado 0' })).toBeInTheDocument();
    expect(screen.getByText('Nada em Pausado com “fr”.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver 2 em Todos' }));

    expect(screen.getByRole('button', { name: 'Todos 2' })).toHaveAttribute('aria-current', 'true');
    expect(cards()).toEqual(['Frieren', 'Fruits Basket']);
  });

  it('sem resultado em lugar nenhum: limpar a busca volta tudo', async () => {
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista([umItem({ titulo_original: 'Frieren' })]) });

    await user.type(await screen.findByRole('searchbox', { name: 'Buscar na Lista' }), 'zelda');
    expect(screen.getByText('Nada na Lista com “zelda”.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar busca e filtros' }));

    expect(cards()).toEqual(['Frieren']);
  });

  it('Lista vazia leva ao Explorar', async () => {
    await abrirLogado('/lista', { rotas: rotasDaLista([]) });
    expect(await screen.findByText('Sua Lista ainda está vazia.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar o catálogo' })).toHaveAttribute('href', '/explorar');
  });
});

describe('Minha Lista: card da grade', () => {
  it('nome, nota e Progresso/horas no card, que leva ao detalhe', async () => {
    const itens = [
      umItem({ id_midia: 'MID-frieren', titulo_original: 'Frieren', nota_usuario: 9.5, progresso_atual: 12, progresso_total: 28 }),
      jogo({ titulo_original: 'Hades', progresso_atual: 1020, favorito: true }),
    ];
    await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    const frieren = await screen.findByRole('link', { name: 'Frieren, nota 9,5, 12/28 ep' });
    expect(frieren).toHaveAttribute('href', '/midia/MID-frieren');
    expect(within(frieren).getByText('12/28')).toBeInTheDocument();
    expect(within(frieren).getByText('9,5')).toBeInTheDocument();
    const hades = screen.getByRole('link', { name: 'Hades, favorito, 1.020 h jogadas' });
    expect(within(hades).getByText('1.020 h')).toBeInTheDocument();
    expect(screen.getByText('1.020 h', { selector: 'p span' })).toBeInTheDocument();
  });

  it('a Lista é virtualizada: só as linhas perto da tela ficam no DOM', async () => {
    const itens = Array.from({ length: 300 }, (_, i) => umItem({ titulo_original: `Obra ${String(i).padStart(3, '0')}` }));
    await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    const grade = await screen.findByRole('list', { name: 'Em progresso, Anime' });
    const visiveis = within(grade).getAllByRole('listitem');
    expect(visiveis.length).toBeGreaterThan(0);
    expect(visiveis.length).toBeLessThan(50);
    expect(visiveis[0]).toHaveAttribute('aria-setsize', '300');
    expect(visiveis[0]).toHaveAttribute('aria-posinset', '1');
  });
});

describe('Minha Lista: menu de Status', () => {
  it('muda o Status na hora com PUT /lista/<id> e o Item vai para o outro Status', async () => {
    const item = umItem({ titulo_original: 'Frieren', progresso_atual: 5 });
    const { user, api } = await abrirLogado('/lista', {
      rotas: { ...rotasDaLista([item]), [`PUT /lista/${item.id_lista}`]: { status: 200, corpo: { mensagem: 'ok' } } },
    });

    await user.click(await screen.findByRole('button', { name: 'Status de Frieren: Em progresso. Mudar' }));
    const menu = screen.getByRole('menu', { name: 'Status de Frieren' });
    expect(within(menu).getByRole('menuitemradio', { name: 'Em progresso' })).toHaveAttribute('aria-checked', 'true');
    expect(within(menu).getByRole('menuitemradio', { name: 'Em progresso' })).toHaveFocus();
    expect(within(menu).queryByRole('menuitemradio', { name: 'Platinado' })).not.toBeInTheDocument();

    api.rotas['GET /lista'] = { status: 200, corpo: { lista: [{ ...item, status_consumo: 'completo', progresso_atual: 12 }] } };
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Concluído' }));

    expect(api.para(`PUT /lista/${item.id_lista}`)[0]?.corpo).toEqual({ status_consumo: 'completo', progresso_atual: 12 });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concluído 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Em progresso 0' })).toBeInTheDocument();
    expect(cards(secao('Concluído'))).toEqual(['Frieren']);
  });

  it('teclado: setas movem, Esc fecha e devolve o foco', async () => {
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista([umItem({ titulo_original: 'Frieren' })]) });

    const botao = await screen.findByRole('button', { name: /^Status de Frieren/ });
    botao.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Em progresso' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Planejado' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitemradio', { name: 'Concluído' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('recusado pelo servidor, o Item volta ao Status de antes e o erro aparece', async () => {
    const item = umItem({ titulo_original: 'Frieren' });
    const { user } = await abrirLogado('/lista', {
      rotas: { ...rotasDaLista([item]), [`PUT /lista/${item.id_lista}`]: erro(400, 'dados_invalidos', 'Status inválido para o Tipo.') },
    });

    await user.click(await screen.findByRole('button', { name: /^Status de Frieren/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Pausado' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Status inválido para o Tipo.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Em progresso 1' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Pausado 0' })).toBeInTheDocument();
  });
});
