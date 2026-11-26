import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Esquemas } from '../../api/tipos';
import { abrirLogado } from '../../testes/app';
import { erro, type Requisicao, type Resposta, type Rotas } from '../../testes/fetchSimulado';
import { item, midia, rotasDoInicio } from '../inicio/dadosDeTeste';

type Midia = Esquemas['Midia'];

// 14/11/2026: a Temporada atual é Outono 2026.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 14, 12) });
});
afterEach(() => {
  vi.useRealTimers();
});

const anime = (id: string, titulo: string, extra: Partial<Midia> = {}) =>
  midia(id, titulo, { temporada_estacao: 'outono', temporada_ano: 2026, temporada_estimada: false, formato: 'TV', ...extra });

function pagina(itens: Midia[], { pagina = 1, total = itens.length, por_pagina = 50 } = {}): Resposta {
  const corpo: Esquemas['PaginaMidia'] = { itens, pagina, por_pagina, total };
  return { status: 200, corpo };
}

function facetas(maisAntiga: Esquemas['Temporada'] | null = { estacao: 'verao', ano: 2025 }): Resposta {
  const corpo: Esquemas['RespostaFacetas'] = { plataformas: [], estudios: [], temporada_mais_antiga: maisAntiga };
  return { status: 200, corpo };
}

type Opcoes = { midias?: (req: Requisicao) => Resposta; lista?: Esquemas['ItemLista'][]; maisAntiga?: Esquemas['Temporada'] | null };

function rotas({ midias = () => pagina([]), lista = [], maisAntiga }: Opcoes = {}): Rotas {
  return {
    'GET /midias': midias,
    'GET /midias/facetas': facetas(maisAntiga),
    'GET /lista': { status: 200, corpo: { lista } },
  };
}

function ultimaBusca(api: { para(rota: string): Requisicao[] }) {
  const chamadas = api.para('GET /midias');
  return Object.fromEntries(chamadas[chamadas.length - 1]!.query);
}

function naUrl(historico: { location: { search: string } }) {
  return Object.fromEntries(new URLSearchParams(historico.location.search));
}

describe('Temporada', () => {
  it('abre na Temporada atual, pelos mais esperados', async () => {
    const { api } = await abrirLogado('/temporada', { rotas: rotas({ midias: () => pagina([anime('A1', 'Frieren')]) }) });

    expect(await screen.findByRole('heading', { name: 'Outono 2026' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Frieren/ })).toHaveAttribute('href', '/midia/A1');
    expect(ultimaBusca(api)).toEqual({
      tipo: 'anime',
      temporada_estacao: 'outono',
      temporada_ano: '2026',
      ordem: 'popularidade_fonte',
      pagina: '1',
      por_pagina: '50',
    });
  });

  it('anterior, próxima e atual trocam a Temporada na URL', async () => {
    const { user, historico, api } = await abrirLogado('/temporada', { rotas: rotas() });
    await screen.findByRole('heading', { name: 'Outono 2026' });

    await user.click(screen.getByRole('button', { name: 'Próxima: Inverno 2027' }));
    expect(await screen.findByRole('heading', { name: 'Inverno 2027' })).toBeInTheDocument();
    expect(naUrl(historico)).toEqual({ estacao: 'inverno', ano: '2027' });
    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ temporada_estacao: 'inverno', temporada_ano: '2027' }));

    await user.click(screen.getByRole('button', { name: 'Anterior: Outono 2026' }));
    await user.click(await screen.findByRole('button', { name: 'Anterior: Verão 2026' }));
    expect(await screen.findByRole('heading', { name: 'Verão 2026' })).toBeInTheDocument();
    expect(naUrl(historico)).toEqual({ estacao: 'verao', ano: '2026' });

    await user.click(screen.getByRole('button', { name: 'Atual' }));
    expect(await screen.findByRole('heading', { name: 'Outono 2026' })).toBeInTheDocument();
    expect(naUrl(historico)).toEqual({});
  });

  it('o seletor vai da mais antiga do Catálogo até 4 à frente; nas pontas, o atalho desliga', async () => {
    const { user, historico } = await abrirLogado('/temporada?estacao=verao&ano=2027', { rotas: rotas() });
    await screen.findByRole('heading', { name: 'Verão 2027' });

    const seletor = screen.getByRole('combobox', { name: 'Temporada' });
    const opcoes = await waitFor(() => {
      const nomes = within(seletor).getAllByRole('option').map((o) => o.textContent);
      expect(nomes[0]).toBe('Verão 2025');
      return nomes;
    });
    expect(opcoes.at(-1)).toBe('Outono 2027');
    expect(opcoes).toHaveLength(10);

    await user.selectOptions(seletor, 'Outono 2027');
    expect(await screen.findByRole('heading', { name: 'Outono 2027' })).toBeInTheDocument();
    expect(naUrl(historico)).toEqual({ estacao: 'outono', ano: '2027' });
    expect(screen.getByRole('button', { name: /^Próxima/ })).toBeDisabled();

    await user.selectOptions(seletor, 'Verão 2025');
    expect(await screen.findByRole('heading', { name: 'Verão 2025' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Anterior/ })).toBeDisabled();
  });

  it('ordena por Estreia e por Nota da fonte, com a ordem na URL', async () => {
    const { user, historico, api } = await abrirLogado('/temporada', { rotas: rotas() });
    await screen.findByRole('heading', { name: 'Outono 2026' });

    await user.click(screen.getByRole('radio', { name: 'Estreia' }));
    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ ordem: 'estreia' }));
    expect(naUrl(historico)).toEqual({ ordem: 'estreia' });

    await user.click(screen.getByRole('radio', { name: 'Nota da fonte' }));
    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ ordem: 'nota_fonte' }));

    await user.click(screen.getByRole('radio', { name: 'Mais esperados' }));
    expect(naUrl(historico)).toEqual({});
  });

  it('traz a Temporada inteira, página por página', async () => {
    const primeiras = Array.from({ length: 50 }, (_, i) => anime(`A${i}`, `Anime ${i}`));
    const { api } = await abrirLogado('/temporada', {
      rotas: rotas({
        midias: (req) =>
          req.query.get('pagina') === '2' ? pagina([anime('B1', 'Último da temporada')], { pagina: 2, total: 51 }) : pagina(primeiras, { total: 51 }),
      }),
    });

    expect(await screen.findByRole('link', { name: /Último da temporada/ })).toBeInTheDocument();
    expect(api.para('GET /midias').map((r) => r.query.get('pagina'))).toEqual(['1', '2']);
  });

  it('séries na grade principal; filmes, especiais e OVAs em "Filmes e especiais"', async () => {
    await abrirLogado('/temporada', {
      rotas: rotas({
        midias: () =>
          pagina([
            anime('A1', 'Série de TV'),
            anime('A2', 'Um filme', { formato: 'MOVIE' }),
            anime('A3', 'Formato desconhecido', { formato: null }),
            anime('A4', 'Uma OVA', { formato: 'OVA' }),
          ]),
      }),
    });

    const grade = await screen.findByRole('list', { name: 'Séries' });
    expect(within(grade).getAllByRole('link').map((l) => l.textContent)).toEqual([
      expect.stringContaining('Série de TV'),
      expect.stringContaining('Formato desconhecido'),
    ]);
    const filmes = screen.getByRole('region', { name: 'Filmes e especiais' });
    expect(within(filmes).getByRole('link', { name: /Um filme/ })).toBeInTheDocument();
    expect(within(filmes).getByRole('link', { name: /Uma OVA/ })).toBeInTheDocument();
  });

  it('o cartão mostra estreia, estúdio e episódios, e o selo da Temporada estimada', async () => {
    await abrirLogado('/temporada', {
      rotas: rotas({
        midias: () =>
          pagina([
            anime('A1', 'Frieren', { data_lancamento: '2026-10-03', estudio: 'Madhouse', numero_episodios: 28 }),
            anime('A2', 'Estimado', { temporada_estimada: true }),
          ]),
      }),
    });

    const frieren = (await screen.findByRole('link', { name: /Frieren/ })).closest('li')!;
    expect(within(frieren).getByText('Estreia 03/10/2026')).toBeInTheDocument();
    expect(within(frieren).getByText('Madhouse')).toBeInTheDocument();
    expect(within(frieren).getByText('28 episódios')).toBeInTheDocument();
    expect(within(frieren).queryByText('temporada estimada')).not.toBeInTheDocument();

    const estimado = screen.getByRole('link', { name: /Estimado/ }).closest('li')!;
    expect(within(estimado).getByText('temporada estimada')).toHaveAttribute('title', 'pela data de estreia; pode estar errada');
  });

  it('"Planejado" põe o anime na Lista e vira "Na Lista"', async () => {
    const frieren = anime('A1', 'Frieren');
    const lista: Esquemas['ItemLista'][] = [];
    const { user, api } = await abrirLogado('/temporada', {
      rotas: {
        ...rotas({ midias: () => pagina([frieren]) }),
        'GET /lista': () => ({ status: 200, corpo: { lista } }),
        'POST /lista/adicionar': () => {
          lista.push(item(frieren, { status_consumo: 'planejado' }));
          return { status: 201, corpo: { mensagem: 'ok', id_lista: 'L-A1' } };
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Pôr Frieren em Planejado' }));

    expect(api.para('POST /lista/adicionar')[0]!.corpo).toEqual({ id_midia: 'A1', status_consumo: 'planejado' });
    const cartao = screen.getByRole('link', { name: /Frieren/ }).closest('li')!;
    expect(await within(cartao).findByText('Na Lista')).toBeInTheDocument();
    expect(within(cartao).queryByRole('button', { name: /Planejado/ })).not.toBeInTheDocument();
  });

  it('o anime que já está na Lista mostra "Na Lista"', async () => {
    const tenho = anime('A2', 'Já tenho');
    await abrirLogado('/temporada', { rotas: rotas({ midias: () => pagina([tenho]), lista: [item(tenho)] }) });

    const cartao = (await screen.findByRole('link', { name: /Já tenho/ })).closest('li')!;
    expect(await within(cartao).findByText('Na Lista')).toBeInTheDocument();
  });

  it('avisa quando a gravação falha', async () => {
    const { user } = await abrirLogado('/temporada', {
      rotas: {
        ...rotas({ midias: () => pagina([anime('A1', 'Frieren')]) }),
        'POST /lista/adicionar': erro(400, 'dados_invalidos', 'Não deu para gravar'),
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Pôr Frieren em Planejado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu para gravar');
  });

  it('diz quando a Temporada não tem animes no Catálogo', async () => {
    await abrirLogado('/temporada?estacao=inverno&ano=2027', { rotas: rotas() });

    expect(await screen.findByText('Nenhum anime de Inverno 2027 no Catálogo.')).toBeInTheDocument();
  });
});

describe('Atalhos para a Temporada', () => {
  const rotasDoExplorar: Rotas = {
    'GET /midias': () => pagina([]),
    'GET /generos': { status: 200, corpo: { generos: [] } },
    'GET /midias/facetas': facetas(),
  };

  it('o Explorar leva à Temporada atual no catálogo de anime, e não no de jogos', async () => {
    const { user } = await abrirLogado('/explorar', { rotas: rotasDoExplorar });

    expect(await screen.findByRole('link', { name: 'Temporada Outono 2026' })).toHaveAttribute('href', '/temporada');
    await user.click(screen.getByRole('button', { name: 'Jogos' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Temporada/ })).not.toBeInTheDocument());
  });

  it('o Início também, só no catálogo de anime', async () => {
    const frieren = anime('A1', 'Frieren');
    const zelda = midia('J1', 'Zelda', { tipo: 'jogo' });
    const { user } = await abrirLogado('/', { rotas: rotasDoInicio({ emAlta: [frieren, zelda] }) });

    expect(await screen.findByRole('link', { name: 'Temporada Outono 2026' })).toHaveAttribute('href', '/temporada');
    await user.click(screen.getByRole('button', { name: 'Jogos' }));
    await screen.findByRole('heading', { name: 'Zelda' });
    expect(screen.queryByRole('link', { name: /^Temporada/ })).not.toBeInTheDocument();
  });
});
