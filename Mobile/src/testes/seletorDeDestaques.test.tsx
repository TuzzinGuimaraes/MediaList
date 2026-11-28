import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { ConquistaDoSeletor } from '../api/tipos';
import { erro } from './contrato';
import { type Resposta, simularFetch } from './fetchSimulado';
import { abrirLogado } from './sessao';

function obtida(codigo: string, dados: Partial<ConquistaDoSeletor> = {}): ConquistaDoSeletor {
  return {
    steam_appid: 367520,
    codigo,
    nome: `Conquista ${codigo}`,
    descricao: `Faça ${codigo}.`,
    icone: null,
    oculta: false,
    raridade: 50,
    obtida: true,
    obtida_em: '2020-12-10T15:32:36Z',
    destacada: false,
    id_lista: 'LST-J',
    id_midia: 'MID-J',
    jogo: 'Hollow Knight',
    ...dados,
  };
}

function pagina(itens: ConquistaDoSeletor[], numero = 1, total = itens.length): Resposta {
  return { status: 200, corpo: { itens, pagina: numero, por_pagina: 50, total } };
}

const PRIMEIRA = 'GET /usuario/conquistas?ordem=raridade&pagina=1';

const jogos: Resposta = {
  status: 200,
  corpo: {
    jogos: [
      { steam_appid: 504230, id_midia: 'MID-C', jogo: 'Celeste', obtidas: 3 },
      { steam_appid: 367520, id_midia: 'MID-J', jogo: 'Hollow Knight', obtidas: 12 },
    ],
  },
};

function rotas(extra: Record<string, Resposta | (() => Resposta)>) {
  return simularFetch({ 'GET /usuario/conquistas/jogos': jogos, ...extra });
}

/** A FlatList só avisa o fim uma vez por altura de conteúdo: cada rolagem usa uma altura nova. */
let alturaConteudo = 5000;

async function rolarAteOFim(lista: Parameters<typeof fireEvent.scroll>[0]) {
  alturaConteudo += 1000;
  const tamanho = { width: 400, height: 800 };
  await fireEvent(lista, 'layout', { nativeEvent: { layout: { x: 0, y: 0, ...tamanho } } });
  await fireEvent(lista, 'contentSizeChange', 400, alturaConteudo);
  await fireEvent.scroll(lista, {
    nativeEvent: {
      contentOffset: { x: 0, y: alturaConteudo - tamanho.height },
      contentSize: { width: 400, height: alturaConteudo },
      layoutMeasurement: tamanho,
    },
  });
}

describe('Escolher destaques', () => {
  it('lista as obtidas da mais rara, com o jogo, o selo Rara e os jogos do filtro', async () => {
    rotas({ [PRIMEIRA]: pagina([obtida('Rara', { raridade: 2.5 }), obtida('Comum', { jogo: 'Celeste' })]) });

    await abrirLogado('/destaques');

    expect(await screen.findByRole('header', { name: 'Escolher destaques' })).toBeOnTheScreen();
    const rara = await screen.findByLabelText('Conquista Rara, Hollow Knight, obtida em 10/12/2020, 2,5% dos jogadores, rara');
    expect(within(rara).getByText('Rara')).toBeOnTheScreen();
    expect(within(rara).getByText('Hollow Knight')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Conquista Comum, Celeste/)).toBeOnTheScreen();
    const filtroJogo = screen.getByLabelText('Jogo');
    expect(within(filtroJogo).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Todos os jogos',
      'Celeste',
      'Hollow Knight',
    ]);
  });

  it('busca, filtro por jogo, só as destacadas e a ordem vão na consulta', async () => {
    const vazia = pagina([]);
    const api = rotas({
      [PRIMEIRA]: pagina([obtida('A')]),
      'GET /usuario/conquistas?ordem=raridade&pagina=1&busca=a%C3%A7%C3%A3o': vazia,
      'GET /usuario/conquistas?ordem=raridade&pagina=1&busca=a%C3%A7%C3%A3o&steam_appid=504230': vazia,
      'GET /usuario/conquistas?ordem=raridade&pagina=1&busca=a%C3%A7%C3%A3o&steam_appid=504230&so_destacadas=true': vazia,
      'GET /usuario/conquistas?ordem=data&pagina=1&busca=a%C3%A7%C3%A3o&steam_appid=504230&so_destacadas=true': vazia,
    });

    await abrirLogado('/destaques');
    await screen.findByLabelText(/^Conquista A,/);
    await fireEvent.changeText(screen.getByLabelText('Buscar pelo nome'), 'ação');
    await waitFor(() =>
      expect(api.para('GET /usuario/conquistas?ordem=raridade&pagina=1&busca=a%C3%A7%C3%A3o')).toHaveLength(1),
    );
    await fireEvent.press(within(screen.getByLabelText('Jogo')).getByRole('button', { name: 'Celeste' }));
    await fireEvent(screen.getByRole('switch', { name: 'Só as destacadas' }), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Mais recentes' }));

    await waitFor(() =>
      expect(
        api.para('GET /usuario/conquistas?ordem=data&pagina=1&busca=a%C3%A7%C3%A3o&steam_appid=504230&so_destacadas=true'),
      ).toHaveLength(1),
    );
    expect(await screen.findByText('Nenhuma conquista obtida com esses filtros.')).toBeOnTheScreen();
  });

  it('rolar até o fim carrega a página seguinte, até o total', async () => {
    // A FlatList só avisa o fim com o último item montado: a página falsa é curta, e o total diz que há mais.
    const primeira = Array.from({ length: 5 }, (_, i) => obtida(`P${i}`));
    const api = rotas({
      [PRIMEIRA]: pagina(primeira, 1, 51),
      'GET /usuario/conquistas?ordem=raridade&pagina=2': pagina([obtida('Ultima')], 2, 51),
    });

    await abrirLogado('/destaques');
    const lista = await screen.findByLabelText('Conquistas obtidas');
    await screen.findByLabelText(/^Conquista P0,/);

    await rolarAteOFim(lista);

    expect(await screen.findByLabelText(/^Conquista Ultima,/)).toBeOnTheScreen();
    expect(api.para('GET /usuario/conquistas?ordem=raridade&pagina=2')).toHaveLength(1);
    await rolarAteOFim(lista);
    expect(api.para('GET /usuario/conquistas?ordem=raridade&pagina=2')).toHaveLength(1);
    expect(api.chamadas.filter((c) => c.caminho.includes('pagina=3'))).toHaveLength(0);
  });

  it('destacar e tirar ali gravam e relêem o seletor e os destaques do Perfil', async () => {
    let destacada = false;
    const api = rotas({
      [PRIMEIRA]: () => pagina([obtida('A', { destacada })]),
      'PUT /usuario/conquistas/destaques/367520/A': () => {
        destacada = true;
        return { status: 200, corpo: { mensagem: 'ok' } };
      },
      'DELETE /usuario/conquistas/destaques/367520/A': () => {
        destacada = false;
        return { status: 200, corpo: { mensagem: 'ok' } };
      },
    });

    await abrirLogado('/destaques');
    await fireEvent.press(await screen.findByRole('button', { name: 'Destacar no Perfil' }));

    expect(api.para('PUT /usuario/conquistas/destaques/367520/A')).toHaveLength(1);
    await fireEvent.press(await screen.findByRole('button', { name: 'Tirar do Perfil' }));
    expect(api.para('DELETE /usuario/conquistas/destaques/367520/A')).toHaveLength(1);
    expect(await screen.findByRole('button', { name: 'Destacar no Perfil' })).toBeOnTheScreen();
    expect(api.para(PRIMEIRA).length).toBeGreaterThanOrEqual(3);
  });

  it('a sétima mostra o aviso para tirar outra antes', async () => {
    rotas({
      [PRIMEIRA]: pagina([obtida('A')]),
      'PUT /usuario/conquistas/destaques/367520/A': erro(409, 'limite_de_destaques', 'Limite'),
    });

    await abrirLogado('/destaques');
    await fireEvent.press(await screen.findByRole('button', { name: 'Destacar no Perfil' }));

    expect(await screen.findByText('O Perfil já tem 6 destaques. Tire um antes de destacar outro.')).toBeOnTheScreen();
  });
});
