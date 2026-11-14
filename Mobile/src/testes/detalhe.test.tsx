import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import type { Avaliacao, ItemLista, MidiaDetalhe, RespostaDistribuicao } from '../api/tipos';
import { AVALIACOES_POR_PAGINA } from '../api/avaliacoes';
import { erro, paginaAvaliacoes, respostaNotas, rotaAvaliacoes, rotaNotas } from './contrato';
import { type Resposta, simularFetch } from './fetchSimulado';
import { anime, itemDaLista as item, jogo, manga } from './midias';
import { APP, abrirLogado } from './sessao';

/** Avaliações de Usuários diferentes, uma por nota. */
function avaliacoesCom(idMidia: string, notas: number[], primeira = 0): Avaliacao[] {
  return notas.map((nota, i) => ({
    id_avaliacao: `AVL-${primeira + i}`,
    id_usuario: `USR-${primeira + i}`,
    id_midia: idMidia,
    nome_completo: `Usuário ${primeira + i}`,
    foto_perfil: null,
    nota,
    titulo_avaliacao: null,
    texto_avaliacao: null,
    data_avaliacao: '2026-11-05T10:00:00Z',
    data_edicao: null,
  }));
}

function detalhe(
  midia: MidiaDetalhe,
  extras: {
    lista?: ItemLista[];
    /** Notas das Avaliações da 1ª página. */
    notas?: number[];
    /** Faixas de GET /midias/<id>/notas. */
    totais?: Partial<Record<number, number>>;
    distribuicao?: RespostaDistribuicao['distribuicao'];
  } = {},
): Record<string, Resposta> {
  const id = midia.id_midia;
  const distribuicao: RespostaDistribuicao = { distribuicao: extras.distribuicao ?? [] };
  return {
    [`GET /midias/${id}`]: { status: 200, corpo: midia },
    [`GET /midias/${id}/distribuicao`]: { status: 200, corpo: distribuicao },
    [rotaAvaliacoes(id)]: paginaAvaliacoes(avaliacoesCom(id, extras.notas ?? [])),
    [rotaNotas(id)]: respostaNotas(extras.totais),
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
    expect(screen.getByText(frieren.sinopse!)).toBeOnTheScreen();
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
    simularFetch(detalhe(frieren, { totais: { 9: 2, 6: 1 } }));

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByLabelText('Nota 9: 2 avaliações')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota 6: 1 avaliação')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota 10: 0 avaliações')).toBeOnTheScreen();
  });

  it('pede só a 1ª página de Avaliações; a distribuição de todas vem pronta de /notas', async () => {
    const frieren = anime({ total_avaliacoes: 52 });
    const id = frieren.id_midia;
    const api = simularFetch({
      ...detalhe(frieren, { totais: { 9: 51, 3: 1 } }),
      [rotaAvaliacoes(id)]: paginaAvaliacoes(avaliacoesCom(id, Array(AVALIACOES_POR_PAGINA).fill(9)), 52),
    });

    await abrirDetalhe(id);

    expect(await screen.findByLabelText('Nota 9: 51 avaliações')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota 3: 1 avaliação')).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/^Avaliação de /)).toHaveLength(AVALIACOES_POR_PAGINA);
    expect(api.chamadas.filter((c) => c.caminho.startsWith('/avaliacoes/'))).toHaveLength(1);
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
        lista: [item(hollow, { id_lista: 'LST-1', status_consumo: 'zerado', progresso_atual: null, progresso_total: null })],
      }),
    );

    await abrirDetalhe(hollow.id_midia);

    expect(await screen.findByLabelText('Na sua Lista: Concluído')).toBeOnTheScreen();
  });

  it('fora da Lista pessoal, não mostra Estado de consumo', async () => {
    const frieren = anime();
    simularFetch(
      detalhe(frieren, {
        lista: [item(jogo(), { id_lista: 'LST-1', status_consumo: 'jogando', progresso_atual: null, progresso_total: null })],
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
        lista: [item(frieren, { id_lista: 'LST-1', status_consumo: 'assistindo', progresso_atual: 3, progresso_total: null })],
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

  it('selos: Tipo, Status do Item e "Em exibição"; a Situação aparece com o nome legível', async () => {
    const frieren = anime({ status_anime: 'em_exibicao' });
    simularFetch(
      detalhe(frieren, {
        lista: [item(frieren, { id_lista: 'LST-1', status_consumo: 'pausado', progresso_atual: 3, progresso_total: null })],
      }),
    );

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByLabelText('Situação: Em exibição')).toBeOnTheScreen();
    // O selo sobre o pôster e o valor da Situação.
    expect(screen.getAllByText('Em exibição')).toHaveLength(2);
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
    ['as Avaliações', (id: string) => rotaAvaliacoes(id)],
    ['as notas', (id: string) => rotaNotas(id)],
    ['a distribuição por Estado', (id: string) => `GET /midias/${id}/distribuicao`],
    ['a Lista pessoal', () => 'GET /lista'],
  ])('se falha ao carregar %s, o detalhe mostra o erro e "Tentar de novo" recarrega', async (_parte, rota) => {
    const frieren = anime();
    const normais = detalhe(frieren);
    const chave = rota(frieren.id_midia);
    let falhando = true;
    simularFetch({
      ...normais,
      [chave]: () => (falhando ? erro(500, 'erro_interno', 'Falha no servidor') : (normais[chave] as Resposta)),
    });

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByRole('header', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent('Falha no servidor');

    falhando = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeOnTheScreen());
  });

  it('Mídia inexistente mostra a mensagem da API', async () => {
    simularFetch({ 'GET /midias/MID-NADA': erro(404, 'nao_encontrado', 'Mídia não encontrada') });

    await abrirDetalhe('MID-NADA');

    expect(await screen.findByRole('alert')).toHaveTextContent('Mídia não encontrada');
  });
});
