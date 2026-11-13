import path from 'node:path';
import { DeviceEventEmitter, Platform, ScrollView, TextInput } from 'react-native';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { guardarSessao } from '../auth/armazenamento';
import { type Requisicao, type Resposta, simularFetch, usuarioAna } from './fetchSimulado';
import { anime, jogo, manga } from './midias';
import { trocarRecorte } from './recorte';

const APP = path.resolve(__dirname, '../../app');

/** Item de GET /lista no formato real (conferido contra o backend local): a Mídia mais os campos do Item. */
function item(midia: { id_midia: string; tipo: string } & Record<string, unknown>, dados: Record<string, unknown> = {}) {
  return {
    ...midia,
    id_lista: `LST-${midia.id_midia}`,
    codigo_lista: 'LST20261106-00001',
    status_consumo: 'planejado',
    progresso_atual: 0,
    progresso_total: (midia.numero_episodios ?? midia.numero_capitulos ?? null) as number | null,
    nota_usuario: null,
    favorito: false,
    privado: false,
    data_inicio: null,
    data_conclusao: null,
    comentario: null,
    total_rewatches: 0,
    ...dados,
  };
}

const frieren = anime();
const fma = anime({ id_midia: 'MID-ANM-2026-20011', titulo_portugues: 'Fullmetal Alchemist', numero_episodios: 64 });
const jojo = manga();
const hollow = jogo();
const celeste = jogo({ id_midia: 'MID-JOG-2026-40002', titulo_original: 'Celeste' });

async function abrir(url: string) {
  await guardarSessao({ tokens: { access: 'A1', refresh: 'R1' }, usuario: usuarioAna as never });
  return renderRouter(APP, { initialUrl: url });
}

/** Servidor de mentira com estado: as escritas mudam o que o GET /lista devolve. */
function servidor(inicial: ReturnType<typeof item>[], extras: Record<string, Resposta | ((r: Requisicao) => Resposta | Promise<Resposta>)> = {}) {
  let lista = inicial;
  const mudar = (id: string, campos: Record<string, unknown>) => {
    lista = lista.map((i) => (i.id_lista === id ? { ...i, ...campos } : i));
  };
  const rotas: Record<string, any> = {
    'GET /lista': () => ({ status: 200, corpo: { lista } }),
    'GET /notificacoes': { status: 200, corpo: { notificacoes: [] } },
    'GET /usuario/estatisticas': { status: 200, corpo: { estatisticas: [], resumo: {} } },
  };
  for (const i of inicial) {
    rotas[`PUT /lista/${i.id_lista}/progresso`] = (req: Requisicao) => {
      const atual = lista.find((x) => x.id_lista === i.id_lista)!;
      const p = req.corpo.progresso_atual;
      const concluiu = atual.progresso_total !== null && p >= atual.progresso_total;
      mudar(i.id_lista, { progresso_atual: p, ...(concluiu ? { status_consumo: i.tipo === 'anime' ? 'completo' : 'lido' } : {}) });
      return { status: 200, corpo: { mensagem: 'Progresso atualizado com sucesso!' } };
    };
    rotas[`PUT /lista/${i.id_lista}`] = (req: Requisicao) => {
      mudar(i.id_lista, req.corpo);
      return { status: 200, corpo: { mensagem: 'Lista atualizada com sucesso!' } };
    };
    rotas[`DELETE /lista/${i.id_lista}`] = () => {
      lista = lista.filter((x) => x.id_lista !== i.id_lista);
      return { status: 200, corpo: { mensagem: 'Mídia removida da lista' } };
    };
  }
  const api = simularFetch({ ...rotas, ...extras });
  return { api, rotas, adicionar: (novo: ReturnType<typeof item>) => (lista = [novo, ...lista]) };
}

const aba = (nome: string, n: number) => screen.findByRole('button', { name: `${nome} (${n})` });
const linha = (titulo: string) => screen.findByLabelText(`Item ${titulo}`);

describe('aba Lista', () => {
  // Desfaz o Platform.OS e os espiões do teste de teclado do Android.
  afterEach(() => jest.restoreAllMocks());

  it('abas por Estado de consumo com contador, filtradas pelo Recorte; Platinado também conta em Concluído', async () => {
    servidor([
      item(frieren, { status_consumo: 'assistindo', progresso_atual: 12 }),
      item(jojo, { status_consumo: 'lendo', progresso_atual: 40 }),
      item(fma, { status_consumo: 'completo', progresso_atual: 64 }),
      item(hollow, { status_consumo: 'platinado', progresso_atual: 60 }),
      item(celeste, { status_consumo: 'zerado', progresso_atual: 20 }),
    ]);

    await abrir('/lista');

    expect(await aba('Em progresso', 2)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Concluído (1)' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Platinado/ })).not.toBeOnTheScreen();
    expect(await linha('Sousou no Frieren')).toBeOnTheScreen();
    expect(screen.getByLabelText('Item JoJo no Kimyou na Bouken')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Item Fullmetal Alchemist')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Concluído (1)' }));
    expect(await linha('Fullmetal Alchemist')).toBeOnTheScreen();

    await trocarRecorte('Jogos');
    expect(await aba('Concluído', 2)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Platinado (1)' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Item Hollow Knight')).toBeOnTheScreen();
    expect(screen.getByLabelText('Item Celeste')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Item Fullmetal Alchemist')).not.toBeOnTheScreen();
  });

  it('cada linha mostra o selo do Tipo de mídia, também no rótulo de acessibilidade', async () => {
    servidor([
      item(frieren, { status_consumo: 'assistindo', progresso_atual: 12 }),
      item(jojo, { status_consumo: 'lendo', progresso_atual: 40 }),
    ]);

    await abrir('/lista');

    expect(within(await linha('Sousou no Frieren')).getByText('Anime')).toBeOnTheScreen();
    expect(within(await linha('JoJo no Kimyou na Bouken')).getByText('Mangá')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Editar Sousou no Frieren, Anime' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Editar JoJo no Kimyou na Bouken, Mangá' })).toBeOnTheScreen();
  });

  it('+1 aparece na hora e é desfeito se o servidor recusar', async () => {
    let responder!: (r: Resposta) => void;
    const { api } = servidor([item(frieren, { status_consumo: 'assistindo', progresso_atual: 12 })], {
      'PUT /lista/LST-MID-ANM-2026-20053/progresso': () => new Promise<Resposta>((r) => (responder = r)),
    });

    await abrir('/lista');
    const l = await linha('Sousou no Frieren');
    expect(within(l).getByLabelText('Progresso: 12 de 28')).toBeOnTheScreen();

    await fireEvent.press(within(l).getByRole('button', { name: 'Mais um em Sousou no Frieren' }));

    expect(await within(l).findByLabelText('Progresso: 13 de 28')).toBeOnTheScreen();
    expect(api.para('PUT /lista/LST-MID-ANM-2026-20053/progresso')[0].corpo).toEqual({ progresso_atual: 13 });

    responder({ status: 400, corpo: { erro: 'Progresso não pode ser maior que o total da mídia (28)' } });

    expect(await within(l).findByLabelText('Progresso: 12 de 28')).toBeOnTheScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent('Progresso não pode ser maior que o total da mídia (28)');
  });

  it('toques seguidos: o primeiro falha e o segundo passa, fica só o +1 que deu certo', async () => {
    const PUT = 'PUT /lista/LST-MID-ANM-2026-20053/progresso';
    let falhar!: () => void;
    let chamadas = 0;
    const s = servidor([item(frieren, { status_consumo: 'assistindo', progresso_atual: 12 })], {
      [PUT]: (req: Requisicao) =>
        chamadas++ === 0
          ? new Promise<Resposta>((r) => (falhar = () => r({ status: 500, corpo: { erro: 'Erro ao atualizar progresso' } })))
          : s.rotas[PUT](req),
    });

    await abrir('/lista');
    const l = await linha('Sousou no Frieren');
    const mais = within(l).getByRole('button', { name: 'Mais um em Sousou no Frieren' });

    await fireEvent.press(mais);
    expect(await within(l).findByLabelText('Progresso: 13 de 28')).toBeOnTheScreen();
    await fireEvent.press(mais);
    expect(await within(l).findByLabelText('Progresso: 14 de 28')).toBeOnTheScreen();

    falhar();

    await waitFor(() => expect(s.api.para(PUT)).toHaveLength(2));
    await waitFor(() => expect(s.api.para('GET /lista').length).toBeGreaterThan(1));
    expect(await within(l).findByLabelText('Progresso: 13 de 28')).toBeOnTheScreen();
    expect(s.api.para(PUT)[1].corpo).toEqual({ progresso_atual: 13 });
  });

  it('− e + respeitam 0 e o total; atingir o total leva a Concluído', async () => {
    const { api } = servidor([
      item(frieren, { status_consumo: 'assistindo', progresso_atual: 27 }),
      item(jojo, { status_consumo: 'lendo', progresso_atual: 0 }),
    ]);

    await abrir('/lista');
    const jojoLinha = await linha('JoJo no Kimyou na Bouken');
    expect(within(jojoLinha).getByRole('button', { name: 'Menos um em JoJo no Kimyou na Bouken' })).toBeDisabled();

    const l = await linha('Sousou no Frieren');
    await fireEvent.press(within(l).getByRole('button', { name: 'Mais um em Sousou no Frieren' }));

    // Concluído na hora (otimista) e confirmado pela Lista refeita.
    expect(await aba('Concluído', 1)).toBeOnTheScreen();
    expect(await aba('Em progresso', 1)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Concluído (1)' }));
    const concluido = await linha('Sousou no Frieren');
    expect(within(concluido).getByLabelText('Progresso: 28 de 28')).toBeOnTheScreen();
    expect(within(concluido).getByRole('button', { name: 'Mais um em Sousou no Frieren' })).toBeDisabled();
    await waitFor(() => expect(api.para('GET /lista').length).toBeGreaterThan(1));
    expect(api.para('PUT /lista/LST-MID-ANM-2026-20053/progresso')).toHaveLength(1);
  });

  it('− num Concluído no total o leva a Em progresso na hora, antes da resposta (ADR 0009)', async () => {
    const aot = anime({ id_midia: 'MID-ANM-2026-20099', titulo_portugues: 'Ataque dos Titãs', numero_episodios: 10 });
    const { api } = servidor([item(aot, { status_consumo: 'completo', progresso_atual: 10, data_conclusao: '2026-01-02' })], {
      'PUT /lista/LST-MID-ANM-2026-20099/progresso': () => new Promise<Resposta>(() => {}),
    });

    await abrir('/lista');
    await fireEvent.press(await aba('Concluído', 1));
    const l = await linha('Ataque dos Titãs');
    await fireEvent.press(within(l).getByRole('button', { name: 'Menos um em Ataque dos Titãs' }));

    await fireEvent.press(await aba('Em progresso', 1));
    const rebaixado = await linha('Ataque dos Titãs');
    expect(within(rebaixado).getByLabelText('Progresso: 9 de 10')).toBeOnTheScreen();
    expect(api.para('PUT /lista/LST-MID-ANM-2026-20099/progresso')[0].corpo).toEqual({ progresso_atual: 9 });
  });

  it('o stepper não muda a posição do Item: a ordem é a da API', async () => {
    servidor([
      item(fma, { status_consumo: 'assistindo', progresso_atual: 3 }),
      item(frieren, { status_consumo: 'assistindo', progresso_atual: 12 }),
    ]);

    await abrir('/lista');
    const ordem = async () => (await screen.findAllByLabelText(/^Item /)).map((l) => l.props.accessibilityLabel as string);
    const antes = await ordem();
    await fireEvent.press(within(await linha('Sousou no Frieren')).getByRole('button', { name: 'Mais um em Sousou no Frieren' }));

    expect(await within(await linha('Sousou no Frieren')).findByLabelText('Progresso: 13 de 28')).toBeOnTheScreen();
    expect(await ordem()).toEqual(antes);
  });

  it('editor: escolher Concluído leva o Progresso ao total', async () => {
    servidor([item(frieren, { status_consumo: 'assistindo', progresso_atual: 3 })]);

    await abrir('/lista');
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar Sousou no Frieren, Anime' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Concluído' }));

    expect(screen.getByLabelText('Episódios (de 28)')).toHaveDisplayValue('28');
    await fireEvent.changeText(screen.getByLabelText('Episódios (de 28)'), '20');
    expect(screen.getByRole('radio', { name: 'Em progresso' })).toBeChecked();
  });

  it('editor: sair de Concluído devolve o Progresso de antes; Item que abriu concluído zera', async () => {
    const aot = anime({ id_midia: 'MID-ANM-2026-20099', titulo_portugues: 'Ataque dos Titãs', numero_episodios: 10 });
    servidor([
      item(frieren, { status_consumo: 'assistindo', progresso_atual: 3 }),
      item(aot, { status_consumo: 'completo', progresso_atual: 10 }),
    ]);

    await abrir('/lista');
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar Sousou no Frieren, Anime' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Concluído' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Pausado' }));
    expect(screen.getByRole('radio', { name: 'Pausado' })).toBeChecked();
    expect(screen.getByLabelText('Episódios (de 28)')).toHaveDisplayValue('3');
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));

    await fireEvent.press(await aba('Concluído', 1));
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar Ataque dos Titãs, Anime' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Em progresso' }));
    expect(screen.getByRole('radio', { name: 'Em progresso' })).toBeChecked();
    expect(screen.getByLabelText('Episódios (de 10)')).toHaveDisplayValue('0');
  });

  it('jogo mostra horas e não tem stepper', async () => {
    servidor([item(hollow, { status_consumo: 'jogando', progresso_atual: 42 })]);

    await abrir('/lista');
    await trocarRecorte('Jogos');

    const l = await linha('Hollow Knight');
    expect(within(l).getByText('42 h')).toBeOnTheScreen();
    expect(within(l).queryByRole('button', { name: /Mais um/ })).not.toBeOnTheScreen();
  });

  it('editor só oferece os Rótulos válidos para o Tipo e grava via PUT', async () => {
    const { api } = servidor([
      item(hollow, { status_consumo: 'jogando', progresso_atual: 42 }),
      item(frieren, { status_consumo: 'assistindo', progresso_atual: 3 }),
    ]);

    await abrir('/lista');
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar Sousou no Frieren, Anime' }));
    const estados = within(screen.getByLabelText('Estado de consumo'));
    expect(estados.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
      'Planejado',
      'Em progresso',
      'Pausado',
      'Abandonado',
      'Concluído',
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));

    await trocarRecorte('Jogos');
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar Hollow Knight, Jogo' }));
    expect(screen.getByLabelText('Horas jogadas')).toHaveDisplayValue('42');
    await fireEvent.press(screen.getByRole('radio', { name: 'Platinado' }));
    await fireEvent.changeText(screen.getByLabelText('Nota pessoal'), '9,5');
    await fireEvent.changeText(screen.getByLabelText('Recontagem'), '1');
    await fireEvent.changeText(screen.getByLabelText('Início'), '01/10/2026');
    await fireEvent.changeText(screen.getByLabelText('Comentário'), 'Panteão feito');
    await fireEvent.press(screen.getByRole('switch', { name: 'Favorito' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(await aba('Platinado', 1)).toBeOnTheScreen();
    expect(api.para('PUT /lista/LST-MID-JOG-2026-40001')[0].corpo).toEqual({
      status_consumo: 'platinado',
      progresso_atual: 42,
      nota_usuario: 9.5,
      favorito: true,
      privado: false,
      data_inicio: '2026-10-01',
      data_conclusao: null,
      total_rewatches: 1,
      comentario: 'Panteão feito',
    });
    expect(screen.queryByLabelText('Editor do Item de lista')).not.toBeOnTheScreen();
  });

  it('Android: o editor sobe com o teclado e rola até o campo em foco, com o rodapé visível', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const rolar = jest.spyOn(ScrollView.prototype, 'scrollTo');
    // O campo em foco, como o RN o mede dentro do conteúdo rolável do sheet.
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
      measureLayout: (_relativo: unknown, medido: (x: number, y: number, w: number, h: number) => void) => medido(0, 420, 100, 40),
    } as never);
    servidor([item(frieren, { status_consumo: 'assistindo', progresso_atual: 3 })]);

    await abrir('/lista');
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar Sousou no Frieren, Anime' }));
    const sheet = screen.getByLabelText('Editor do Item de lista');
    expect(sheet).toHaveStyle({ marginBottom: 0 });

    await act(async () => DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 500 } }));

    expect(sheet).toHaveStyle({ marginBottom: 300 });
    expect(rolar).toHaveBeenLastCalledWith({ y: 408, animated: true });
    expect(within(sheet).getByRole('button', { name: 'Salvar' })).toBeOnTheScreen();

    await act(async () => DeviceEventEmitter.emit('keyboardDidHide', { endCoordinates: { height: 0, screenY: 800 } }));
    expect(sheet).toHaveStyle({ marginBottom: 0 });
  });

  it('editor valida antes de enviar', async () => {
    const { api } = servidor([item(frieren, { status_consumo: 'assistindo', progresso_atual: 3 })]);

    await abrir('/lista');
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar Sousou no Frieren, Anime' }));
    await fireEvent.changeText(screen.getByLabelText('Episódios (de 28)'), '29');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('O Progresso vai de 0 a 28.');
    expect(api.para('PUT /lista/LST-MID-ANM-2026-20053')).toHaveLength(0);
  });

  it('remover pede confirmação e tira o Item da Lista', async () => {
    const { api } = servidor([item(frieren, { status_consumo: 'assistindo', progresso_atual: 3 })]);

    await abrir('/lista');
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar Sousou no Frieren, Anime' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remover' }));
    expect(screen.getByText(/Remover esta Mídia da sua Lista\?/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Manter' }));
    expect(api.para('DELETE /lista/LST-MID-ANM-2026-20053')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Remover' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remover da Lista' }));

    expect(await aba('Em progresso', 0)).toBeOnTheScreen();
    expect(api.para('DELETE /lista/LST-MID-ANM-2026-20053')).toHaveLength(1);
    expect(screen.queryByLabelText('Item Sousou no Frieren')).not.toBeOnTheScreen();
  });
});

describe('adicionar pelo detalhe', () => {
  function detalhe(midia: ReturnType<typeof anime>) {
    const id = midia.id_midia;
    return {
      [`GET /midias/${id}`]: { status: 200, corpo: midia },
      [`GET /midias/${id}/distribuicao`]: { status: 200, corpo: { distribuicao: [] } },
      [`GET /avaliacoes/${id}`]: { status: 200, corpo: { avaliacoes: [] } },
    };
  }

  it('abre o editor em Planejado, envia POST e o detalhe passa a refletir o Item', async () => {
    const { api, adicionar } = servidor([], {
      ...detalhe(frieren),
      'POST /lista/adicionar': (req) => {
        adicionar(item(frieren, { ...req.corpo }));
        return { status: 201, corpo: { id_lista: 'LST-MID-ANM-2026-20053', mensagem: 'Mídia adicionada à lista!' } };
      },
    });

    await abrir(`/midia/${frieren.id_midia}`);
    expect(await screen.findByText('Fora da sua Lista.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar à Lista' }));

    expect(screen.getByRole('radio', { name: 'Planejado' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: 'Platinado' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Em progresso' }));
    await fireEvent.changeText(screen.getByLabelText('Episódios (de 28)'), '2');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByLabelText('Na sua Lista: Em progresso')).toBeOnTheScreen();
    expect(screen.getByLabelText('Progresso: 2 de 28')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Editar na Lista' })).toBeOnTheScreen();
    expect(api.para('POST /lista/adicionar')[0].corpo).toMatchObject({
      id_midia: frieren.id_midia,
      status_consumo: 'assistindo',
      progresso_atual: 2,
      nota_usuario: null,
      favorito: false,
      privado: false,
    });
  });

  it('erro da API fica no editor, sem fechá-lo', async () => {
    servidor([], {
      ...detalhe(frieren),
      'POST /lista/adicionar': { status: 400, corpo: { erro: 'Mídia já está na lista do usuário' } },
    });

    await abrir(`/midia/${frieren.id_midia}`);
    await fireEvent.press(await screen.findByRole('button', { name: 'Adicionar à Lista' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Mídia já está na lista do usuário');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeOnTheScreen();
  });
});
