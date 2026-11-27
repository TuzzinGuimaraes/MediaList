import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import type { Avaliacao, ItemLista, MidiaDetalhe, RelacaoDaMidia, RespostaDistribuicao } from '../api/tipos';
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
    relacoes?: RelacaoDaMidia[];
  } = {},
): Record<string, Resposta> {
  const id = midia.id_midia;
  const distribuicao: RespostaDistribuicao = { distribuicao: extras.distribuicao ?? [] };
  return {
    [`GET /midias/${id}`]: { status: 200, corpo: midia },
    [`GET /midias/${id}/relacoes`]: { status: 200, corpo: { relacoes: extras.relacoes ?? [] } },
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

  it('mostra as Atualizações recentes com título e data, na ordem da API (mais recentes primeiro)', async () => {
    const atualizacao = (titulo: string, data: string): MidiaDetalhe['atualizacoes'][number] => ({
      id_midia: 'MID-ANM-2026-20053',
      tipo_midia: 'anime',
      tipo_atualizacao: 'episodio',
      titulo,
      descricao: null,
      dados_adicionais: {},
      data_atualizacao: data,
    });
    const frieren = anime({
      atualizacoes: [
        atualizacao('Episódio 2 de Sousou no Frieren foi ao ar', '2026-11-27T12:00:00Z'),
        atualizacao('Episódio 1 de Sousou no Frieren foi ao ar', '2026-11-20T12:00:00Z'),
      ],
    });
    simularFetch(detalhe(frieren));

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByRole('header', { name: 'Atualizações' })).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/^Atualização: /).map((e) => e.props.accessibilityLabel)).toEqual([
      'Atualização: Episódio 2 de Sousou no Frieren foi ao ar, 27/11/2026',
      'Atualização: Episódio 1 de Sousou no Frieren foi ao ar, 20/11/2026',
    ]);
  });

  it('sem Atualizações, a seção some', async () => {
    const frieren = anime();
    simularFetch(detalhe(frieren));

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByRole('header', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Atualizações' })).not.toBeOnTheScreen();
  });

  it('Mídia inexistente mostra a mensagem da API', async () => {
    simularFetch({ 'GET /midias/MID-NADA': erro(404, 'nao_encontrado', 'Mídia não encontrada') });

    await abrirDetalhe('MID-NADA');

    expect(await screen.findByRole('alert')).toHaveTextContent('Mídia não encontrada');
  });
});


describe('detalhe: destaque do episódio', () => {
  const emExibicao = anime({ status_anime: 'em_exibicao', numero_episodios: 12, episodios_lancados: 7 });

  it('anime Assistindo e atrasado mostra onde o Usuário parou e o +1 grava o Progresso', async () => {
    let lista = [item(emExibicao, { status_consumo: 'assistindo', progresso_atual: 5, progresso_total: 12 })];
    const api = simularFetch({
      ...detalhe(emExibicao),
      'GET /lista': () => ({ status: 200, corpo: { lista } }),
      [`PUT /lista/${lista[0].id_lista}/progresso`]: (req) => {
        lista = lista.map((i) => ({ ...i, ...req.corpo }));
        return { status: 200, corpo: { mensagem: 'Progresso atualizado com sucesso!' } };
      },
    });

    await abrirDetalhe(emExibicao.id_midia);

    expect(await screen.findByText('Você parou no ep. 5; saiu o 7')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Mais um em Sousou no Frieren' }));

    expect(await screen.findByText('Você parou no ep. 6; saiu o 7')).toBeOnTheScreen();
    expect(api.para(`PUT /lista/${lista[0].id_lista}/progresso`)[0].corpo).toEqual({ progresso_atual: 6 });
    expect(screen.getByLabelText('Progresso: 6 de 12')).toBeOnTheScreen();
  });

  it('em dia, sem destaque', async () => {
    simularFetch(
      detalhe(emExibicao, {
        lista: [item(emExibicao, { status_consumo: 'assistindo', progresso_atual: 7, progresso_total: 12 })],
      }),
    );

    await abrirDetalhe(emExibicao.id_midia);

    expect(await screen.findByLabelText('Na sua Lista: Em progresso')).toBeOnTheScreen();
    expect(screen.queryByText(/saiu o/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Mais um em/ })).not.toBeOnTheScreen();
  });

  it('atrasado mas Pausado, sem destaque', async () => {
    simularFetch(
      detalhe(emExibicao, {
        lista: [item(emExibicao, { status_consumo: 'pausado', progresso_atual: 2, progresso_total: 12 })],
      }),
    );

    await abrirDetalhe(emExibicao.id_midia);

    expect(await screen.findByLabelText('Na sua Lista: Pausado')).toBeOnTheScreen();
    expect(screen.queryByText(/saiu o/)).not.toBeOnTheScreen();
  });
});



function relacao(titulo: string, dados: Partial<RelacaoDaMidia> = {}): RelacaoDaMidia {
  return {
    relacao: 'SEQUEL',
    tipo: 'anime',
    titulo,
    poster_url: null,
    data_lancamento: null,
    id_midia: `MID-${titulo.replace(/\s+/g, '-')}`,
    link_fonte: null,
    status_consumo: null,
    ...dados,
  };
}

describe('detalhe: Relações', () => {
  it('sem Relações, a seção some', async () => {
    const frieren = anime();
    const api = simularFetch(detalhe(frieren));

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByText(frieren.sinopse!)).toBeOnTheScreen();
    await waitFor(() => expect(api.para(`GET /midias/${frieren.id_midia}/relacoes`)).toHaveLength(1));
    expect(screen.queryByRole('header', { name: 'Relações' })).not.toBeOnTheScreen();
  });

  it('cartão do Catálogo abre o Detalhe; fora dele, o link https da fonte; cada um diz Relação, título, Tipo e Status', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const frieren = anime();
    const relacoes = [
      relacao('Mangá de Frieren', { relacao: 'SOURCE', tipo: 'manga', id_midia: null, link_fonte: 'https://anilist.co/manga/118586' }),
      relacao('Frieren 2', { status_consumo: 'assistindo', data_lancamento: '2026-01-10' }),
      relacao('Prequel inseguro', { relacao: 'PREQUEL', id_midia: null, link_fonte: 'http://anilist.co/anime/1' }),
    ];
    simularFetch({
      ...detalhe(frieren, { relacoes }),
      ...detalhe(anime({ id_midia: 'MID-Frieren-2', titulo_original: 'Frieren 2', titulo_portugues: null, titulo_ingles: null })),
    });

    await abrirDetalhe(frieren.id_midia);

    const secao = await screen.findByLabelText('Relações');
    // Prequel e Sequência antes do Original (ordem do domínio).
    expect(within(secao).getAllByLabelText(/: /).map((c) => c.props.accessibilityLabel)).toEqual([
      'Prequel: Prequel inseguro, Anime, fora do Catálogo',
      'Sequência: Frieren 2, Anime, Em progresso',
      'Original · mangá: Mangá de Frieren, Mangá, fora do Catálogo',
    ]);
    // Sem https, o cartão fica sem link.
    expect(within(secao).queryByRole('link', { name: /Prequel inseguro/ })).not.toBeOnTheScreen();

    await fireEvent.press(within(secao).getByRole('link', { name: 'Original · mangá: Mangá de Frieren, Mangá, fora do Catálogo' }));
    expect(abrir).toHaveBeenCalledWith('https://anilist.co/manga/118586');

    await fireEvent.press(within(secao).getByRole('link', { name: 'Sequência: Frieren 2, Anime, Em progresso' }));
    expect(await screen.findByRole('header', { name: 'Frieren 2' })).toBeOnTheScreen();
  });

  it('jogo com série grande: 12 cartões e "e mais N", que abre a lista completa', async () => {
    const hollow = jogo({ data_lancamento: '2001-01-01' });
    const serie = Array.from({ length: 15 }, (_, i) =>
      relacao(`Jogo ${2000 + i}`, { relacao: 'MESMA_SERIE', tipo: 'jogo', data_lancamento: `${2000 + i}-06-01` }),
    );
    simularFetch(detalhe(hollow, { relacoes: serie }));

    await abrirDetalhe(hollow.id_midia);

    const secao = await screen.findByLabelText('Relações');
    expect(within(secao).getAllByRole('link', { name: /^Mesma série/ })).toHaveLength(12);
    expect(within(secao).queryByRole('link', { name: /Jogo 2014/ })).not.toBeOnTheScreen();

    await fireEvent.press(within(secao).getByRole('button', { name: 'e mais 3' }));

    const lista = await screen.findByLabelText('Todos os jogos da série');
    expect(within(lista).getAllByRole('link', { name: /^Mesma série/ })).toHaveLength(15);
    expect(within(lista).getByRole('link', { name: 'Mesma série: Jogo 2014, Jogo' })).toBeOnTheScreen();
  });
});

describe('detalhe: sugestão de Sequência', () => {
  const frieren = anime();
  const concluido = item(frieren, { status_consumo: 'completo', progresso_atual: 28, progresso_total: 28 });

  it('anime Concluído: a Sequência fora da Lista em destaque; "Planejado" grava na Lista e o destaque some', async () => {
    let planejada = false;
    const api = simularFetch({
      ...detalhe(frieren, { lista: [concluido] }),
      [`GET /midias/${frieren.id_midia}/relacoes`]: () => ({
        status: 200,
        corpo: { relacoes: [relacao('Frieren 2', { status_consumo: planejada ? 'planejado' : null })] },
      }),
      'POST /lista/adicionar': () => {
        planejada = true;
        return { status: 201, corpo: { mensagem: 'ok', id_lista: 'LST-2' } };
      },
      'GET /midias/MID-Frieren-2/distribuicao': { status: 200, corpo: { distribuicao: [] } },
    });

    await abrirDetalhe(frieren.id_midia);

    const destaque = await screen.findByLabelText('Continue com a Sequência');
    expect(within(destaque).getByRole('link', { name: 'Sequência: Frieren 2, Anime' })).toBeOnTheScreen();

    await fireEvent.press(within(destaque).getByRole('button', { name: 'Planejado, Frieren 2' }));

    expect(api.para('POST /lista/adicionar').map((c) => c.corpo)).toEqual([
      { id_midia: 'MID-Frieren-2', status_consumo: 'planejado' },
    ]);
    await waitFor(() => expect(screen.queryByLabelText('Continue com a Sequência')).not.toBeOnTheScreen());
  });

  it('Sequência fora do Catálogo: no destaque com o link da fonte, sem o botão', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const fora = relacao('Frieren 3', { id_midia: null, link_fonte: 'https://anilist.co/anime/3' });
    simularFetch(detalhe(frieren, { lista: [concluido], relacoes: [fora] }));

    await abrirDetalhe(frieren.id_midia);

    const destaque = await screen.findByLabelText('Continue com a Sequência');
    expect(within(destaque).queryByRole('button')).not.toBeOnTheScreen();
    await fireEvent.press(within(destaque).getByRole('link', { name: 'Sequência: Frieren 3, Anime, fora do Catálogo' }));
    expect(abrir).toHaveBeenCalledWith('https://anilist.co/anime/3');
  });

  it('sem Concluído, sem destaque', async () => {
    simularFetch(
      detalhe(frieren, {
        lista: [item(frieren, { status_consumo: 'assistindo', progresso_atual: 3, progresso_total: 28 })],
        relacoes: [relacao('Frieren 2')],
      }),
    );

    await abrirDetalhe(frieren.id_midia);

    expect(await screen.findByLabelText('Relações')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Continue com a Sequência')).not.toBeOnTheScreen();
  });
});
