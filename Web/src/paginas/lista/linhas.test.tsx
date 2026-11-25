import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { abrirLogado, usuarioAna } from '../../testes/app';
import { rotasDaLista, umItem } from './fixtures';
import { chaveDasPreferencias } from './preferencias';

const salvo = () => JSON.parse(localStorage.getItem(chaveDasPreferencias(usuarioAna.id)) ?? '{}') as Record<string, unknown>;
const salvar = (p: Record<string, unknown>) => localStorage.setItem(chaveDasPreferencias(usuarioAna.id), JSON.stringify(p));
const alternador = () => within(screen.getByRole('group', { name: 'Formato da Lista' }));
/** Os títulos das linhas de uma tabela, na ordem da tela. */
const titulos = (tabela: HTMLElement) =>
  within(tabela)
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('link')[0]?.textContent);
const coluna = (tabela: HTMLElement, nome: string) => within(tabela).getByRole('columnheader', { name: new RegExp(`^${nome}`) });

const jogo = (campos: Parameters<typeof umItem>[0]) =>
  umItem({ tipo: 'jogo', status_consumo: 'jogando', progresso_total: null, numero_episodios: null, status_anime: null, ...campos });

describe('Minha Lista: alternador de formato', () => {
  it('abre na grade; trocar para linhas grava a escolha e a põe na URL', async () => {
    const { user, historico } = await abrirLogado('/lista', { rotas: rotasDaLista([umItem({ titulo_original: 'Frieren' })]) });

    expect(await screen.findByRole('list', { name: 'Em progresso, Anime' })).toBeInTheDocument();
    expect(alternador().getByRole('button', { name: 'Grade de capas' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(alternador().getByRole('button', { name: 'Linhas compactas' }));

    expect(alternador().getByRole('button', { name: 'Linhas compactas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('table', { name: 'Em progresso, Anime' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Em progresso, Anime' })).not.toBeInTheDocument();
    expect(salvo().formato).toBe('compacta');
    expect(historico.location.search).toBe('?formato=compacta');

    await user.click(alternador().getByRole('button', { name: 'Grade de capas' }));
    expect(salvo().formato).toBe('grade');
    expect(historico.location.search).toBe('');
  });

  it('sem formato na URL, vale o salvo', async () => {
    salvar({ formato: 'texto' });
    await abrirLogado('/lista', { rotas: rotasDaLista([umItem({ titulo_original: 'Frieren' })]) });

    expect(await screen.findByRole('table', { name: 'Em progresso, Anime' })).toBeInTheDocument();
    expect(alternador().getByRole('button', { name: 'Só texto' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('o formato da URL vence o salvo e passa a ser o salvo; valor estranho é ignorado', async () => {
    salvar({ formato: 'texto', ordem: 'titulo', inversa: false });
    await abrirLogado('/lista?formato=compacta', { rotas: rotasDaLista([umItem({ titulo_original: 'Frieren' })]) });

    expect(await screen.findByRole('table', { name: 'Em progresso, Anime' })).toBeInTheDocument();
    expect(alternador().getByRole('button', { name: 'Linhas compactas' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(salvo()).toEqual({ formato: 'compacta', ordem: 'titulo', inversa: false }));
  });

  it('formato desconhecido na URL fica com o salvo', async () => {
    salvar({ formato: 'texto' });
    await abrirLogado('/lista?formato=mosaico', { rotas: rotasDaLista([umItem({ titulo_original: 'Frieren' })]) });

    await screen.findByRole('table', { name: 'Em progresso, Anime' });
    expect(alternador().getByRole('button', { name: 'Só texto' })).toHaveAttribute('aria-pressed', 'true');
    expect(salvo().formato).toBe('texto');
  });
});

describe('Minha Lista: linhas', () => {
  it('linha compacta: título (link ao detalhe), nota, progresso, Status e quando foi atualizado', async () => {
    const hoje = new Date().toISOString();
    const itens = [
      umItem({ id_midia: 'MID-frieren', titulo_original: 'Frieren', nota_usuario: 9.5, progresso_atual: 12, progresso_total: 28, estudio: 'Madhouse', data_atualizacao: hoje }),
    ];
    salvar({ formato: 'compacta' });
    await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    const tabela = await screen.findByRole('table', { name: 'Em progresso, Anime' });
    const [linha] = within(tabela).getAllByRole('row').slice(1);
    const celulas = within(linha!).getAllByRole('cell');
    expect(within(celulas[0]!).getByRole('link')).toHaveAttribute('href', '/midia/MID-frieren');
    expect(celulas[0]).toHaveTextContent('Madhouse');
    expect(celulas[1]).toHaveTextContent('9,5');
    expect(celulas[2]).toHaveTextContent('12/28');
    expect(within(celulas[3]!).getByRole('button', { name: 'Status de Frieren: Em progresso. Mudar' })).toBeInTheDocument();
    expect(celulas[4]).toHaveTextContent('hoje');
  });

  it('abaixo de md, o menu de Status continua na linha (só some a coluna Atualizado)', async () => {
    salvar({ formato: 'texto' });
    await abrirLogado('/lista', { rotas: rotasDaLista([umItem({ titulo_original: 'Frieren' })]) });

    const tabela = await screen.findByRole('table', { name: 'Em progresso, Anime' });
    const [cabecalho, linha] = within(tabela).getAllByRole('row');
    const status = within(linha!).getAllByRole('cell')[3]!;
    // O jsdom não aplica o CSS: a célula do Status não pode ter o `hidden` das telas estreitas.
    expect(status.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(within(status).getByRole('button', { name: 'Status de Frieren: Em progresso. Mudar' })).toBeInTheDocument();
    const nomeDaColuna = within(cabecalho!).getAllByRole('columnheader')[3]!;
    expect(nomeDaColuna).toHaveTextContent('Status');
    expect(nomeDaColuna.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it('as linhas são virtualizadas, com a contagem de linhas da tabela inteira', async () => {
    salvar({ formato: 'texto' });
    const itens = Array.from({ length: 300 }, (_, i) => umItem({ titulo_original: `Obra ${String(i).padStart(3, '0')}` }));
    await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    const tabela = await screen.findByRole('table', { name: 'Em progresso, Anime' });
    expect(tabela).toHaveAttribute('aria-rowcount', '301');
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas.length).toBeGreaterThan(1);
    expect(linhas.length).toBeLessThan(60);
    expect(linhas[1]).toHaveAttribute('aria-rowindex', '2');
  });

  it('coluna de horas nos jogos; a Ordem padrão aparece em aria-sort (nota no anime, horas no jogo)', async () => {
    salvar({ formato: 'texto' });
    const itens = [umItem({ titulo_original: 'Frieren', nota_usuario: 9 }), jogo({ titulo_original: 'Hades', progresso_atual: 80 })];
    await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    const anime = await screen.findByRole('table', { name: 'Em progresso, Anime' });
    const jogos = screen.getByRole('table', { name: 'Em progresso, Jogos' });
    expect(coluna(anime, 'Nota')).toHaveAttribute('aria-sort', 'descending');
    expect(coluna(anime, 'Progresso')).toHaveAttribute('aria-sort', 'none');
    expect(coluna(jogos, 'Horas')).toHaveAttribute('aria-sort', 'descending');
    expect(coluna(jogos, 'Nota')).toHaveAttribute('aria-sort', 'none');
    expect(within(within(jogos).getAllByRole('row')[1]!).getByRole('img', { name: '80 h jogadas' })).toBeInTheDocument();
  });

  it('clicar no cabeçalho ordena por ele; de novo, inverte; a Ordem da coluna lateral acompanha e fica salva', async () => {
    salvar({ formato: 'texto' });
    const itens = [
      umItem({ titulo_original: 'Berserk', nota_usuario: 7 }),
      umItem({ titulo_original: 'Akira', nota_usuario: 8 }),
      umItem({ titulo_original: 'Cowboy Bebop', nota_usuario: 10 }),
    ];
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista(itens) });

    const tabela = await screen.findByRole('table', { name: 'Em progresso, Anime' });
    expect(titulos(tabela)).toEqual(['Cowboy Bebop', 'Akira', 'Berserk']);

    await user.click(within(coluna(tabela, 'Título')).getByRole('button'));
    expect(coluna(tabela, 'Título')).toHaveAttribute('aria-sort', 'ascending');
    expect(coluna(tabela, 'Nota')).toHaveAttribute('aria-sort', 'none');
    expect(titulos(tabela)).toEqual(['Akira', 'Berserk', 'Cowboy Bebop']);
    expect(screen.getByRole('combobox', { name: 'Ordem' })).toHaveValue('titulo');

    await user.click(within(coluna(tabela, 'Título')).getByRole('button'));
    expect(coluna(tabela, 'Título')).toHaveAttribute('aria-sort', 'descending');
    expect(titulos(tabela)).toEqual(['Cowboy Bebop', 'Berserk', 'Akira']);
    expect(salvo()).toMatchObject({ ordem: 'titulo', inversa: true });

    // Na Ordem padrão, clicar na coluna ativa (Nota) inverte sem sair do padrão.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordem' }), 'padrao');
    expect(coluna(tabela, 'Nota')).toHaveAttribute('aria-sort', 'descending');
    await user.click(within(coluna(tabela, 'Nota')).getByRole('button'));
    expect(coluna(tabela, 'Nota')).toHaveAttribute('aria-sort', 'ascending');
    expect(titulos(tabela)).toEqual(['Berserk', 'Akira', 'Cowboy Bebop']);
    expect(screen.getByRole('combobox', { name: 'Ordem' })).toHaveValue('padrao');
  });

  it('o Status muda pelo menu da linha', async () => {
    salvar({ formato: 'compacta' });
    const item = umItem({ titulo_original: 'Frieren' });
    const { user, api } = await abrirLogado('/lista', {
      rotas: { ...rotasDaLista([item]), [`PUT /lista/${item.id_lista}`]: { status: 200, corpo: { mensagem: 'ok' } } },
    });

    await user.click(await screen.findByRole('button', { name: 'Status de Frieren: Em progresso. Mudar' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Pausado' }));

    expect(api.para(`PUT /lista/${item.id_lista}`)[0]?.corpo).toMatchObject({ status_consumo: 'pausado' });
  });

  it('nas linhas, o Item que sai do Status leva o foco ao menu de Status do seguinte', async () => {
    salvar({ formato: 'texto' });
    const itens = [umItem({ titulo_original: 'Akira', nota_usuario: 9 }), umItem({ titulo_original: 'Berserk', nota_usuario: 8 })];
    const { user, api } = await abrirLogado('/lista', {
      rotas: { ...rotasDaLista(itens), [`PUT /lista/${itens[0]!.id_lista}`]: { status: 200, corpo: { mensagem: 'ok' } } },
    });
    await user.click(await screen.findByRole('button', { name: 'Em progresso 2' }));

    await user.click(screen.getByRole('button', { name: /^Status de Akira/ }));
    api.rotas['GET /lista'] = { status: 200, corpo: { lista: [{ ...itens[0]!, status_consumo: 'pausado' }, itens[1]] } };
    await user.click(screen.getByRole('menuitemradio', { name: 'Pausado' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^Status de Berserk/ })).toHaveFocus());
    expect(screen.getByText('Akira movido para Pausado')).toBeInTheDocument();
  });
});

describe('Minha Lista: cartão de destaque', () => {
  const frieren = () =>
    umItem({
      id_midia: 'MID-frieren',
      titulo_original: 'Frieren',
      sinopse: 'Uma elfa revisita a jornada depois da morte do herói.',
      nota_usuario: 10,
      progresso_atual: 12,
      progresso_total: 28,
      data_lancamento: '2023-09-29',
      banner_url: 'https://img/banner.jpg',
    });
  const linhaDe = (titulo: string) => screen.getAllByRole('row').find((r) => within(r).queryByText(titulo))!;

  it('abre com o mouse parado ~300 ms numa linha, com sinopse, dados e "Ver detalhes"; Esc fecha', async () => {
    salvar({ formato: 'compacta' });
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista([frieren()]) });

    await screen.findByRole('table', { name: 'Em progresso, Anime' });
    fireEvent.mouseEnter(linhaDe('Frieren'), { clientX: 200 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const cartao = await screen.findByRole('dialog', { name: 'Destaque: Frieren' });
    expect(cartao).not.toHaveAttribute('aria-modal');
    expect(cartao).toHaveTextContent('Uma elfa revisita a jornada');
    expect(cartao).toHaveTextContent('Anime · Finalizado · 2023');
    expect(cartao).toHaveTextContent('12/28');
    expect(cartao).toHaveTextContent('Em progresso');
    expect(within(cartao).getByRole('link', { name: 'Ver detalhes' })).toHaveAttribute('href', '/midia/MID-frieren');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sair da linha antes de 300 ms não abre; rolar a página fecha', async () => {
    salvar({ formato: 'texto' });
    await abrirLogado('/lista', { rotas: rotasDaLista([frieren()]) });

    await screen.findByRole('table', { name: 'Em progresso, Anime' });
    fireEvent.mouseEnter(linhaDe('Frieren'));
    fireEvent.mouseLeave(linhaDe('Frieren'));
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.mouseEnter(linhaDe('Frieren'));
    await screen.findByRole('dialog', { name: 'Destaque: Frieren' });
    await new Promise((r) => setTimeout(r, 200));
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('foco de teclado no título abre na hora; Tab entra no cartão, Esc fecha e devolve o foco ao título', async () => {
    salvar({ formato: 'texto' });
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista([frieren()]) });

    const tabela = await screen.findByRole('table', { name: 'Em progresso, Anime' });
    const link = within(tabela).getByRole('link', { name: /^Frieren/ });
    const antes = within(tabela).getByRole('button', { name: /^Título/ });
    antes.focus();
    // Tab até o link do título (passa pelos cabeçalhos ordenáveis).
    while (document.activeElement !== link) await user.tab();

    const cartao = screen.getByRole('dialog', { name: 'Destaque: Frieren' });
    expect(link).toHaveAttribute('aria-describedby', cartao.id);
    expect(link).toHaveFocus();

    await user.tab();
    expect(within(cartao).getByRole('link', { name: 'Ver detalhes' })).toHaveFocus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.tab();
    // Sai do cartão para o que vem depois do título na linha (o menu de Status) e o cartão fecha.
    expect(within(tabela).getByRole('button', { name: /^Status de Frieren/ })).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.tab({ shift: true });
    expect(link).toHaveFocus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.tab();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(link).toHaveFocus();
  });

  it('sem sinopse, diz que não tem; a grade não tem cartão', async () => {
    salvar({ formato: 'compacta' });
    const { user } = await abrirLogado('/lista', { rotas: rotasDaLista([umItem({ titulo_original: 'Akira' })]) });

    await screen.findByRole('table', { name: 'Em progresso, Anime' });
    fireEvent.mouseEnter(linhaDe('Akira'));
    expect(await screen.findByRole('dialog', { name: 'Destaque: Akira' })).toHaveTextContent('Sem sinopse.');

    await user.keyboard('{Escape}');
    await user.click(alternador().getByRole('button', { name: 'Grade de capas' }));
    fireEvent.mouseEnter(await screen.findByRole('link', { name: /^Akira/ }));
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
