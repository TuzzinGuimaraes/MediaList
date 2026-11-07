import path from 'node:path';
import { renderRouter, screen } from 'expo-router/testing-library';

import { guardarSessao } from '../auth/armazenamento';
import { type Resposta, simularFetch, usuarioAna } from './fetchSimulado';
import { anime, jogo, manga } from './midias';

const APP = path.resolve(__dirname, '../../app');

type Fixture = ReturnType<typeof anime>;

function detalhe(
  midia: Fixture | ReturnType<typeof manga> | ReturnType<typeof jogo>,
  extras: {
    lista?: unknown[];
    notas?: number[];
    distribuicao?: { status_consumo: string; total: number }[];
  } = {},
): Record<string, Resposta> {
  const id = midia.id_midia;
  return {
    [`GET /midias/${id}`]: { status: 200, corpo: midia },
    [`GET /midias/${id}/distribuicao`]: { status: 200, corpo: { distribuicao: extras.distribuicao ?? [] } },
    [`GET /avaliacoes/${id}`]: {
      status: 200,
      corpo: {
        avaliacoes: (extras.notas ?? []).map((nota, i) => ({
          id_avaliacao: `AVL-${i}`,
          id_usuario: `USR-${i}`,
          id_midia: id,
          nota,
          titulo_avaliacao: null,
          texto_avaliacao: null,
        })),
      },
    },
    'GET /lista': { status: 200, corpo: { lista: extras.lista ?? [] } },
  };
}

async function abrirDetalhe(id: string) {
  await guardarSessao({ tokens: { access: 'A1', refresh: 'R1' }, usuario: usuarioAna as never });
  return renderRouter(APP, { initialUrl: `/midia/${id}` });
}

describe('detalhe da Mídia', () => {
  it('anime: título, sinopse, lançamento, Gêneros, episódios, Nota média e Total de avaliações', async () => {
    const frieren = anime({ nota_media: 9.25, total_avaliacoes: 3 });
    simularFetch(detalhe(frieren, { notas: [9, 9, 10] }));

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByRole('header', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(screen.getByText('葬送のフリーレン')).toBeOnTheScreen();
    expect(screen.getByText(frieren.sinopse)).toBeOnTheScreen();
    expect(screen.getByLabelText('Lançamento: 29/09/2023')).toBeOnTheScreen();
    expect(screen.getByLabelText('Gêneros: Aventura, Drama, Fantasia')).toBeOnTheScreen();
    expect(screen.getByLabelText('Episódios: 28')).toBeOnTheScreen();
    expect(screen.getByLabelText('Estúdio: MADHOUSE')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Capítulos/)).not.toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Plataformas/)).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Nota média: 9.3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total de avaliações: 3')).toBeOnTheScreen();
  });

  it('mangá mostra capítulos, volumes e demografia', async () => {
    const jojo = manga();
    simularFetch(detalhe(jojo));

    await abrirDetalhe(jojo.id_midia);

    expect(await screen.findByLabelText('Capítulos: 95')).toBeOnTheScreen();
    expect(screen.getByLabelText('Volumes: 24')).toBeOnTheScreen();
    expect(screen.getByLabelText('Demografia: Shounen')).toBeOnTheScreen();
    expect(screen.getByLabelText('Autor: Hirohiko Araki')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Episódios/)).not.toBeOnTheScreen();
  });

  it('jogo mostra plataformas e desenvolvedor', async () => {
    const hollow = jogo();
    simularFetch(detalhe(hollow));

    await abrirDetalhe(hollow.id_midia);

    expect(await screen.findByRole('header', { name: 'Hollow Knight' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Plataformas: PC, Switch, PS4')).toBeOnTheScreen();
    expect(screen.getByLabelText('Desenvolvedor: Team Cherry')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Episódios/)).not.toBeOnTheScreen();
  });

  it('sem Avaliações não mostra Nota média, mesmo com nota vinda da Importação', async () => {
    const frieren = anime({ nota_media: 9.1, total_avaliacoes: 0 });
    simularFetch(detalhe(frieren));

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByLabelText('Total de avaliações: 0')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Nota média/)).not.toBeOnTheScreen();
    expect(screen.queryByText('9.1')).not.toBeOnTheScreen();
    expect(screen.getByText('Ainda sem Avaliações.')).toBeOnTheScreen();
  });

  it('mostra a distribuição das notas das Avaliações', async () => {
    const frieren = anime({ total_avaliacoes: 3 });
    simularFetch(detalhe(frieren, { notas: [9, 9.4, 6] }));

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByLabelText('Nota 9: 2 avaliações')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota 6: 1 avaliação')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota 10: 0 avaliações')).toBeOnTheScreen();
  });

  it('mostra quantos Usuários têm a Mídia em cada Estado de consumo', async () => {
    const frieren = anime();
    simularFetch(
      detalhe(frieren, {
        distribuicao: [
          { status_consumo: 'assistindo', total: 4 },
          { status_consumo: 'completo', total: 2 },
        ],
      }),
    );

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByLabelText('Em progresso: 4')).toBeOnTheScreen();
    expect(screen.getByLabelText('Concluído: 2')).toBeOnTheScreen();
  });

  it('se a Mídia está na Lista pessoal, mostra o Estado de consumo atual', async () => {
    const hollow = jogo();
    simularFetch(
      detalhe(hollow, {
        lista: [{ ...hollow, id_lista: 'LST-1', status_consumo: 'zerado', progresso_atual: null, progresso_total: null }],
      }),
    );

    await abrirDetalhe(hollow.id_midia);

    expect(await screen.findByLabelText('Na sua Lista: Concluído')).toBeOnTheScreen();
  });

  it('fora da Lista pessoal, não mostra Estado de consumo', async () => {
    const frieren = anime();
    simularFetch(
      detalhe(frieren, {
        lista: [{ ...jogo(), id_lista: 'LST-1', status_consumo: 'jogando', progresso_atual: null, progresso_total: null }],
      }),
    );

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByText('Fora da sua Lista.')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Na sua Lista/)).not.toBeOnTheScreen();
  });

  it('deep link sem sessão vai ao login sem chamar a API', async () => {
    const api = simularFetch(detalhe(anime()));

    await renderRouter(APP, { initialUrl: `/midia/${anime().id_midia}` });

    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
    expect(api.chamadas).toEqual([]);
  });

  it('Mídia inexistente mostra a mensagem da API', async () => {
    simularFetch({ 'GET /midias/MID-NADA': { status: 404, corpo: { erro: 'Mídia não encontrada' } } });

    await abrirDetalhe('MID-NADA');

    expect(await screen.findByRole('alert')).toHaveTextContent('Mídia não encontrada');
  });
});
