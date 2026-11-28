import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { ConquistaDoItem, ItemLista } from '../api/tipos';
import { erro, paginaAvaliacoes, respostaNotas, rotaAvaliacoes, rotaNotas } from './contrato';
import { type Resposta, simularFetch } from './fetchSimulado';
import { itemDaLista, jogo } from './midias';
import { abrirLogado } from './sessao';

const hollow = jogo();
const ID = hollow.id_midia;

function conquista(codigo: string, dados: Partial<ConquistaDoItem> = {}): ConquistaDoItem {
  return {
    steam_appid: 367520,
    codigo,
    nome: `Conquista ${codigo}`,
    descricao: `Faça ${codigo}.`,
    icone: `https://steamcdn-a.akamaihd.net/${codigo}.jpg`,
    oculta: false,
    raridade: 50,
    obtida: false,
    obtida_em: null,
    destacada: false,
    ...dados,
  };
}

const lista = [
  conquista('Recente', { obtida: true, obtida_em: '2020-12-12T10:00:00Z', raridade: 3.24 }),
  conquista('Segredo', { nome: null, descricao: null, oculta: true, raridade: 40 }),
];

type Status = ItemLista['status_consumo'];

const item = (status_consumo: Status, conquistas: ItemLista['conquistas']) =>
  itemDaLista(hollow, { id_lista: 'LST-J', status_consumo, conquistas });

function rotas(itens: () => ItemLista[]): Record<string, Resposta | (() => Resposta)> {
  return {
    [`GET /midias/${ID}`]: { status: 200, corpo: hollow },
    [`GET /midias/${ID}/relacoes`]: { status: 200, corpo: { relacoes: [] } },
    [`GET /midias/${ID}/distribuicao`]: { status: 200, corpo: { distribuicao: [] } },
    [rotaAvaliacoes(ID)]: paginaAvaliacoes([]),
    [rotaNotas(ID)]: respostaNotas(),
    'GET /lista': () => ({ status: 200, corpo: { lista: itens() } }),
    'GET /lista/LST-J/conquistas': { status: 200, corpo: { conquistas: lista } },
  };
}

describe('detalhe: conquistas da Steam', () => {
  it('"34/50 conquistas" abre a tela da lista, com nome, descrição, data, raridade e o selo Rara', async () => {
    simularFetch(rotas(() => [item('jogando', { obtidas: 34, total: 50 })]));

    await abrirLogado(`/midia/${ID}`);
    await fireEvent.press(await screen.findByRole('button', { name: '34/50 conquistas' }));

    expect(await screen.findByRole('header', { name: 'Conquistas' })).toBeOnTheScreen();
    const obtida = await screen.findByLabelText(
      'Conquista Recente, Hollow Knight, obtida em 12/12/2020, 3,2% dos jogadores, rara',
    );
    expect(within(obtida).getByText('Faça Recente.')).toBeOnTheScreen();
    expect(within(obtida).getByText('Obtida em 12/12/2020')).toBeOnTheScreen();
    expect(within(obtida).getByText('3,2% dos jogadores')).toBeOnTheScreen();
    expect(within(obtida).getByText('Rara')).toBeOnTheScreen();
    const oculta = screen.getByLabelText('Conquista oculta, Hollow Knight, não obtida, 40,0% dos jogadores');
    expect(within(oculta).getByText('Conquista oculta')).toBeOnTheScreen();
    expect(within(oculta).queryByText('Rara')).not.toBeOnTheScreen();
  });

  it('mostra "0/50 conquistas" quando há conquistas e nenhuma obtida', async () => {
    simularFetch(rotas(() => [item('na_fila', { obtidas: 0, total: 50 })]));

    await abrirLogado(`/midia/${ID}`);

    expect(await screen.findByRole('button', { name: '0/50 conquistas' })).toBeOnTheScreen();
  });

  it('jogo sem dado de conquistas não mostra nada', async () => {
    simularFetch(rotas(() => [item('jogando', null)]));

    await abrirLogado(`/midia/${ID}`);

    await screen.findByRole('button', { name: 'Editar na Lista' });
    expect(screen.queryByRole('button', { name: /conquistas/ })).not.toBeOnTheScreen();
  });

  it('com todas as conquistas, "Marcar Platinado" grava o Estado Platinado e o destaque some', async () => {
    let status: Status = 'zerado';
    const api = simularFetch({
      ...rotas(() => [item(status, { obtidas: 2, total: 2 })]),
      'PUT /lista/LST-J': () => {
        status = 'platinado';
        return { status: 200, corpo: { mensagem: 'ok' } };
      },
    });

    await abrirLogado(`/midia/${ID}`);
    const destaque = await screen.findByLabelText('Você tem todas as conquistas');
    await fireEvent.press(within(destaque).getByRole('button', { name: 'Marcar Platinado' }));

    await waitFor(() => expect(api.para('PUT /lista/LST-J').map((c) => c.corpo)).toEqual([{ status_consumo: 'platinado' }]));
    await waitFor(() => expect(screen.queryByLabelText('Você tem todas as conquistas')).not.toBeOnTheScreen());
  });

  it('"Destacar no Perfil" nas obtidas grava o destaque e relê a lista; a destacada ganha "Tirar do Perfil"', async () => {
    let destacada = false;
    const api = simularFetch({
      ...rotas(() => [item('jogando', { obtidas: 1, total: 2 })]),
      'GET /lista/LST-J/conquistas': () => ({ status: 200, corpo: { conquistas: [{ ...lista[0]!, destacada }, lista[1]!] } }),
      'PUT /usuario/conquistas/destaques/367520/Recente': () => {
        destacada = true;
        return { status: 200, corpo: { mensagem: 'ok' } };
      },
      'DELETE /usuario/conquistas/destaques/367520/Recente': () => {
        destacada = false;
        return { status: 200, corpo: { mensagem: 'ok' } };
      },
    });

    await abrirLogado(`/midia/${ID}`);
    await fireEvent.press(await screen.findByRole('button', { name: '1/2 conquistas' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Destacar no Perfil' }));

    expect(api.para('PUT /usuario/conquistas/destaques/367520/Recente')).toHaveLength(1);
    // Só a obtida tem o botão.
    expect(await screen.findAllByRole('button', { name: 'Tirar do Perfil' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Destacar no Perfil' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tirar do Perfil' }));

    expect(api.para('DELETE /usuario/conquistas/destaques/367520/Recente')).toHaveLength(1);
    expect(await screen.findByRole('button', { name: 'Destacar no Perfil' })).toBeOnTheScreen();
  });

  it('a sétima mostra o aviso para tirar outra antes', async () => {
    simularFetch({
      ...rotas(() => [item('jogando', { obtidas: 1, total: 2 })]),
      'PUT /usuario/conquistas/destaques/367520/Recente': erro(409, 'limite_de_destaques', 'Limite'),
    });

    await abrirLogado(`/midia/${ID}`);
    await fireEvent.press(await screen.findByRole('button', { name: '1/2 conquistas' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Destacar no Perfil' }));

    expect(await screen.findByText('O Perfil já tem 6 destaques. Tire um antes de destacar outro.')).toBeOnTheScreen();
  });

  it('em Platinado, sem destaque', async () => {
    simularFetch(rotas(() => [item('platinado', { obtidas: 2, total: 2 })]));

    await abrirLogado(`/midia/${ID}`);

    await screen.findByRole('button', { name: '2/2 conquistas' });
    expect(screen.queryByLabelText('Você tem todas as conquistas')).not.toBeOnTheScreen();
  });
});
