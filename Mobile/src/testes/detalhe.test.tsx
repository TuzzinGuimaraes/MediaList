import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { type Resposta, simularFetch } from './fetchSimulado';
import { anime, jogo, manga } from './midias';
import { APP, abrirLogado } from './sessao';

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

const abrirDetalhe = (id: string) => abrirLogado(`/midia/${id}`);

describe('detalhe da Mídia', () => {
  it('anime: título, sinopse, lançamento, Gêneros, episódios, Nota média e Total de avaliações', async () => {
    const frieren = anime({ nota_media: 9.25, total_avaliacoes: 3, nota_fonte: 8.4, origem_nota: 'AniList' });
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
    expect(screen.getByLabelText('Nota dos Usuários: 9.3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota AniList: 8.4')).toBeOnTheScreen();
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

  it('sem Avaliações mostra só a Nota da fonte', async () => {
    const frieren = anime({ nota_media: null, total_avaliacoes: null, nota_fonte: 9.1, origem_nota: 'AniList' });
    simularFetch(detalhe(frieren));

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByLabelText('Total de avaliações: 0')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Nota dos Usuários/)).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Nota AniList: 9.1')).toBeOnTheScreen();
    expect(screen.getByText('Ainda sem Avaliações.')).toBeOnTheScreen();
  });

  it('jogo com nota da RAWG e Avaliações mostra as duas', async () => {
    const hollow = jogo({ nota_media: 8, total_avaliacoes: 1, nota_fonte: 9.2, origem_nota: 'RAWG' });
    simularFetch(detalhe(hollow, { notas: [8] }));

    await abrirDetalhe(hollow.id_midia);

    expect(await screen.findByLabelText('Nota dos Usuários: 8.0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota RAWG: 9.2')).toBeOnTheScreen();
  });

  it('sem nenhuma nota, não mostra nota alguma', async () => {
    const hollow = jogo({ nota_media: null, total_avaliacoes: null, nota_fonte: null, origem_nota: null });
    simularFetch(detalhe(hollow));

    await abrirDetalhe(hollow.id_midia);

    expect(await screen.findByLabelText('Total de avaliações: 0')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Nota (dos Usuários|AniList|RAWG|da fonte)/)).not.toBeOnTheScreen();
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

    expect(await screen.findByRole('button', { name: 'Adicionar à Lista' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Na sua Lista/)).not.toBeOnTheScreen();
    expect(screen.queryByText('Fora da sua Lista.')).not.toBeOnTheScreen();
  });

  it('na Lista, o botão grande vira "Editar na Lista" e abre o editor do Item', async () => {
    const frieren = anime();
    simularFetch(
      detalhe(frieren, {
        lista: [{ ...frieren, id_lista: 'LST-1', status_consumo: 'assistindo', progresso_atual: 3, progresso_total: null }],
      }),
    );

    await abrirDetalhe(frieren.id_midia);

    await fireEvent.press(await screen.findByRole('button', { name: 'Editar na Lista' }));
    expect(screen.getByRole('radio', { name: 'Em progresso' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Adicionar à Lista' })).not.toBeOnTheScreen();
  });

  it('sem título em português, o alternativo é o inglês', async () => {
    const frieren = anime({ titulo_portugues: null, titulo_ingles: "Frieren: Beyond Journey's End" });
    simularFetch(detalhe(frieren));

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByRole('header', { name: '葬送のフリーレン' })).toBeOnTheScreen();
    expect(screen.getByText("Frieren: Beyond Journey's End")).toBeOnTheScreen();
  });

  it('título igual em todas as línguas não se repete', async () => {
    const hollow = jogo({ titulo_portugues: 'Hollow Knight', titulo_ingles: 'Hollow Knight' });
    simularFetch(detalhe(hollow));

    await abrirDetalhe(hollow.id_midia);

    expect(await screen.findByRole('header', { name: 'Hollow Knight' })).toBeOnTheScreen();
    expect(screen.getAllByText('Hollow Knight')).toHaveLength(1);
  });

  it('selos: Tipo, Status do Item e "Em exibição"', async () => {
    const frieren = anime({ status_anime: 'em_exibicao' });
    simularFetch(
      detalhe(frieren, {
        lista: [{ ...frieren, id_lista: 'LST-1', status_consumo: 'pausado', progresso_atual: 3, progresso_total: null }],
      }),
    );

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByText('Em exibição')).toBeOnTheScreen();
    expect(screen.getByText('Anime')).toBeOnTheScreen();
    // O selo de Status e o valor de "Na sua Lista".
    expect(screen.getAllByText('Pausado')).toHaveLength(2);
  });

  it('deep link sem sessão vai ao login sem chamar a API', async () => {
    const api = simularFetch(detalhe(anime()));

    await renderRouter(APP, { initialUrl: `/midia/${anime().id_midia}` });

    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
    expect(api.chamadas).toEqual([]);
  });

  it.each([
    ['as Avaliações', (id: string) => `GET /avaliacoes/${id}`],
    ['a distribuição por Estado', (id: string) => `GET /midias/${id}/distribuicao`],
    ['a Lista pessoal', () => 'GET /lista'],
  ])('se falha ao carregar %s, o detalhe mostra o erro e "Tentar de novo" recarrega', async (_parte, rota) => {
    const frieren = anime();
    const normais = detalhe(frieren);
    const chave = rota(frieren.id_midia);
    let falhando = true;
    simularFetch({
      ...normais,
      [chave]: () => (falhando ? { status: 500, corpo: { erro: 'Falha no servidor' } } : (normais[chave] as Resposta)),
    });

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByRole('header', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent('Falha no servidor');

    falhando = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeOnTheScreen());
  });

  it('Mídia inexistente mostra a mensagem da API', async () => {
    simularFetch({ 'GET /midias/MID-NADA': { status: 404, corpo: { erro: 'Mídia não encontrada' } } });

    await abrirDetalhe('MID-NADA');

    expect(await screen.findByRole('alert')).toHaveTextContent('Mídia não encontrada');
  });
});
