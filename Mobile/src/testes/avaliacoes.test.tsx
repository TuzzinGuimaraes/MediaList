import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { type Resposta, simularFetch, usuarioAna } from './fetchSimulado';
import { anime } from './midias';
import { abrirLogado } from './sessao';

/** Item de GET /avaliacoes/<id> no formato real (conferido contra o backend local). */
function avaliacao(dados: Record<string, unknown> = {}) {
  return {
    id_avaliacao: 'AVL-1793977663-0000000001',
    codigo_avaliacao: 'AVL20261106-00001',
    id_midia: 'MID-ANM-2026-20053',
    id_usuario: 'USR-20261106-00099',
    nome_completo: 'Bruno Lima',
    foto_perfil: null,
    nota: 8.5,
    titulo_avaliacao: 'Melancólico e bonito',
    texto_avaliacao: 'O tempo passa diferente para uma elfa.',
    data_avaliacao: '2026-11-05T10:00:00',
    data_edicao: null,
    likes: 0,
    dislikes: 0,
    generos_lista: [],
    ...dados,
  };
}

const minha = (dados: Record<string, unknown> = {}) =>
  avaliacao({
    id_avaliacao: 'AVL-MINHA',
    id_usuario: usuarioAna.id,
    nome_completo: usuarioAna.nome,
    nota: 7,
    titulo_avaliacao: 'Bom',
    texto_avaliacao: 'Gostei.',
    ...dados,
  });

const frieren = anime({ nota_media: 8.5, total_avaliacoes: 1 });
const ID = frieren.id_midia;

function rotas(avaliacoes: unknown[], extras: Record<string, Resposta | ((r: any) => Resposta)> = {}) {
  return {
    [`GET /midias/${ID}`]: { status: 200, corpo: frieren },
    [`GET /midias/${ID}/distribuicao`]: { status: 200, corpo: { distribuicao: [] } },
    [`GET /avaliacoes/${ID}`]: { status: 200, corpo: { avaliacoes } },
    'GET /lista': { status: 200, corpo: { lista: [] } },
    ...extras,
  };
}

const abrirDetalhe = () => abrirLogado(`/midia/${ID}`);

describe('Avaliações no detalhe da Mídia', () => {
  it('lista as Avaliações com autor, nota, título e texto', async () => {
    simularFetch(rotas([avaliacao()]));

    await abrirDetalhe();

    const item = await screen.findByLabelText('Avaliação de Bruno Lima');
    expect(within(item).getByText('8.5')).toBeOnTheScreen();
    expect(within(item).getByText('Melancólico e bonito')).toBeOnTheScreen();
    expect(within(item).getByText('O tempo passa diferente para uma elfa.')).toBeOnTheScreen();
    expect(within(item).getByText('05/11/2026')).toBeOnTheScreen();
  });

  it('mostra a data da Avaliação também quando vem em RFC 1123', async () => {
    simularFetch(rotas([avaliacao({ data_avaliacao: 'Thu, 05 Nov 2026 10:00:00 GMT' })]));

    await abrirDetalhe();

    const item = await screen.findByLabelText('Avaliação de Bruno Lima');
    expect(within(item).getByText('05/11/2026')).toBeOnTheScreen();
  });

  it('criar envia o payload certo e atualiza Nota média e Total de avaliações', async () => {
    let avaliacoes: unknown[] = [];
    let midia = anime({ nota_media: null, total_avaliacoes: null });
    const api = simularFetch({
      ...rotas([]),
      [`GET /midias/${ID}`]: () => ({ status: 200, corpo: midia }),
      [`GET /avaliacoes/${ID}`]: () => ({ status: 200, corpo: { avaliacoes } }),
      'POST /avaliacoes': (req) => {
        avaliacoes = [minha({ nota: 9, titulo_avaliacao: 'Obra-prima', texto_avaliacao: 'Chorei.' })];
        midia = { ...midia, nota_media: 9, total_avaliacoes: 1 };
        return {
          status: 201,
          corpo: { mensagem: 'Avaliação criada com sucesso!', id_avaliacao: 'AVL-MINHA', nota_media_atualizada: 9, total_avaliacoes: 1 },
        };
      },
    });

    await abrirDetalhe();
    await fireEvent.press(await screen.findByRole('button', { name: 'Escrever Avaliação' }));

    expect(screen.getByText(/pública/)).toBeOnTheScreen();
    expect(screen.getByText(/Nota pessoal/)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Nota (0 a 10)'), '9');
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Obra-prima');
    await fireEvent.changeText(screen.getByLabelText('Texto'), 'Chorei.');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByLabelText('Avaliação de Ana Souza')).toBeOnTheScreen();
    expect(api.para('POST /avaliacoes')).toHaveLength(1);
    expect(api.para('POST /avaliacoes')[0].corpo).toEqual({
      id_midia: ID,
      nota: 9,
      titulo_avaliacao: 'Obra-prima',
      texto_avaliacao: 'Chorei.',
    });
    expect(await screen.findByLabelText('Total de avaliações: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota dos Usuários: 9.0')).toBeOnTheScreen();
  });

  it('uma Avaliação nova refaz as listagens que ordenam pela Nota média e a Lista', async () => {
    const api = simularFetch({
      ...rotas([]),
      'GET /midias/trending?tipo=anime&limite=10': { status: 200, corpo: { midias: [frieren] } },
      'GET /midias/trending?tipo=manga&limite=10': { status: 200, corpo: { midias: [] } },
      'GET /midias/populares?tipo=anime': { status: 200, corpo: { midias: [] } },
      'GET /midias/populares?tipo=manga': { status: 200, corpo: { midias: [] } },
      'POST /avaliacoes': { status: 201, corpo: { mensagem: 'Avaliação criada com sucesso!', id_avaliacao: 'AVL-MINHA' } },
    });
    await abrirLogado('/');

    const emAlta = await screen.findByLabelText('Em alta');
    await fireEvent.press(within(emAlta).getByRole('link', { name: 'Sousou no Frieren, Anime' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Escrever Avaliação' }));
    await fireEvent.changeText(screen.getByLabelText('Nota (0 a 10)'), '9');
    const antes = {
      emAlta: api.para('GET /midias/trending?tipo=anime&limite=10').length,
      lista: api.para('GET /lista').length,
    };
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() =>
      expect(api.para('GET /midias/trending?tipo=anime&limite=10').length).toBeGreaterThan(antes.emAlta),
    );
    await waitFor(() => expect(api.para('GET /lista').length).toBeGreaterThan(antes.lista));
  });

  it('com Avaliação própria, não oferece uma segunda e edita a existente via PUT', async () => {
    let avaliacoes = [avaliacao(), minha()];
    const api = simularFetch({
      ...rotas([]),
      [`GET /avaliacoes/${ID}`]: () => ({ status: 200, corpo: { avaliacoes } }),
      'PUT /avaliacoes/AVL-MINHA': (req) => {
        avaliacoes = [avaliacao(), minha({ nota: 6.5, titulo_avaliacao: 'Revisto' })];
        return { status: 200, corpo: { mensagem: 'Avaliação atualizada com sucesso!', nota_media_atualizada: 7.5 } };
      },
    });

    await abrirDetalhe();
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar minha Avaliação' }));

    expect(screen.queryByRole('button', { name: 'Escrever Avaliação' })).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Nota (0 a 10)')).toHaveDisplayValue('7');
    expect(screen.getByLabelText('Título')).toHaveDisplayValue('Bom');
    expect(screen.getByLabelText('Texto')).toHaveDisplayValue('Gostei.');
    await fireEvent.changeText(screen.getByLabelText('Nota (0 a 10)'), '6,5');
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Revisto');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Revisto')).toBeOnTheScreen();
    expect(api.para('POST /avaliacoes')).toHaveLength(0);
    expect(api.para('PUT /avaliacoes/AVL-MINHA')[0].corpo).toEqual({
      nota: 6.5,
      titulo_avaliacao: 'Revisto',
      texto_avaliacao: 'Gostei.',
    });
    expect(api.para(`GET /midias/${ID}`).length).toBeGreaterThan(1);
  });

  it('apagar pede confirmação, envia DELETE e volta a oferecer escrever', async () => {
    let avaliacoes = [minha()];
    // Sem Avaliações a Nota média e o Total vêm null (calculados na leitura).
    let midia: Record<string, unknown> = anime({ nota_media: 7, total_avaliacoes: 1 });
    const api = simularFetch({
      ...rotas([]),
      [`GET /midias/${ID}`]: () => ({ status: 200, corpo: midia }),
      [`GET /avaliacoes/${ID}`]: () => ({ status: 200, corpo: { avaliacoes } }),
      'DELETE /avaliacoes/AVL-MINHA': () => {
        avaliacoes = [];
        midia = { ...midia, nota_media: null, total_avaliacoes: null };
        return { status: 200, corpo: { mensagem: 'Avaliação removida com sucesso' } };
      },
    });

    await abrirDetalhe();
    await fireEvent.press(await screen.findByRole('button', { name: 'Apagar minha Avaliação' }));
    expect(screen.getByText('Apagar sua Avaliação? Não dá para desfazer.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Manter' }));
    expect(api.para('DELETE /avaliacoes/AVL-MINHA')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Apagar minha Avaliação' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar' }));

    expect(await screen.findByRole('button', { name: 'Escrever Avaliação' })).toBeOnTheScreen();
    expect(api.para('DELETE /avaliacoes/AVL-MINHA')).toHaveLength(1);
    expect(screen.queryByLabelText('Avaliação de Ana Souza')).not.toBeOnTheScreen();
    expect(await screen.findByLabelText('Total de avaliações: 0')).toBeOnTheScreen();
  });

  it('nota fora da escala (8,55) não chega à API', async () => {
    const api = simularFetch(rotas([]));

    await abrirDetalhe();
    await fireEvent.press(await screen.findByRole('button', { name: 'Escrever Avaliação' }));
    await fireEvent.changeText(screen.getByLabelText('Nota (0 a 10)'), '8,55');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('A nota vai de 0 a 10, com no máximo uma casa decimal.');
    expect(api.para('POST /avaliacoes')).toHaveLength(0);
  });

  it('mostra o erro da API sem fechar o formulário', async () => {
    simularFetch({
      ...rotas([]),
      'POST /avaliacoes': { status: 409, corpo: { erro: 'Você já avaliou esta mídia' } },
    });

    await abrirDetalhe();
    await fireEvent.press(await screen.findByRole('button', { name: 'Escrever Avaliação' }));
    await fireEvent.changeText(screen.getByLabelText('Nota (0 a 10)'), '8');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você já avaliou esta mídia');
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeOnTheScreen();
  });
});
