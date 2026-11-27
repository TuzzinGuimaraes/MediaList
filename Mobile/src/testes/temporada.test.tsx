import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { MidiaDetalhe, RespostaFacetas } from '../api/tipos';
import { pagina } from './contrato';
import { simularFetch } from './fetchSimulado';
import { rotasDoInicio } from './inicio';
import { anime, itemDaLista } from './midias';
import { trocarRecorte } from './recorte';
import { abrirLogado } from './sessao';

// 26/11/2026: a Temporada atual é Outono 2026; o seletor vai até Outono 2027.
beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 10, 26, 12),
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
});
afterEach(() => jest.useRealTimers());

function deOutono(dados: Partial<MidiaDetalhe>): MidiaDetalhe {
  return anime({ temporada_estacao: 'outono', temporada_ano: 2026, temporada_estimada: false, formato: 'TV', ...dados });
}

const frieren = deOutono({ data_lancamento: '2026-10-03', numero_episodios: 12, estudio: 'MADHOUSE' });
const dandadan = deOutono({
  id_midia: 'MID-ANM-2026-20100',
  titulo_portugues: 'Dandadan',
  estudio: 'Science SARU',
  numero_episodios: null,
  formato: null,
});
const filme = deOutono({
  id_midia: 'MID-ANM-2026-20200',
  titulo_portugues: 'Chainsaw Man: Reze',
  estudio: 'MAPPA',
  formato: 'MOVIE',
});
const estimado = deOutono({ id_midia: 'MID-ANM-2026-20300', titulo_portugues: 'Antigo', temporada_estimada: true });

/** A rota de uma página da Temporada, como a tela monta. */
function rota(estacao: string, ano: number, ordem = 'popularidade_fonte', numero = 1) {
  return `GET /midias?tipo=anime&temporada_estacao=${estacao}&temporada_ano=${ano}&ordem=${ordem}&pagina=${numero}&por_pagina=50`;
}

const facetas: { status: 200; corpo: RespostaFacetas } = {
  status: 200,
  corpo: { estudios: [], plataformas: [], temporada_mais_antiga: { estacao: 'verao', ano: 2026 } },
};

function rotas(extras: Record<string, unknown> = {}) {
  return {
    'GET /midias/facetas?tipo=anime': facetas,
    'GET /lista': { status: 200, corpo: { lista: [] } },
    [rota('outono', 2026)]: pagina([frieren, filme, dandadan], { por_pagina: 50 }),
    ...extras,
  } as Parameters<typeof simularFetch>[0];
}

const vazia = pagina([], { por_pagina: 50 });

const abrirTemporada = () => abrirLogado('/temporada');

describe('Temporada', () => {
  it('abre na atual, com as séries na grade e os filmes em "Filmes e especiais"', async () => {
    simularFetch(rotas());

    await abrirTemporada();

    expect(await screen.findByRole('button', { name: 'Escolher temporada, Outono 2026' })).toBeOnTheScreen();
    const series = await screen.findByLabelText('Séries');
    expect(within(series).getByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
    expect(within(series).getByRole('link', { name: 'Dandadan, Anime' })).toBeOnTheScreen();
    const filmes = screen.getByLabelText('Filmes e especiais');
    expect(within(filmes).getByRole('link', { name: 'Chainsaw Man: Reze, Anime' })).toBeOnTheScreen();
    expect(within(series).queryByRole('link', { name: 'Chainsaw Man: Reze, Anime' })).not.toBeOnTheScreen();
  });

  it('o cartão mostra estreia, estúdio e episódios', async () => {
    simularFetch(rotas());

    await abrirTemporada();

    const cartao = await screen.findByLabelText('Cartão de Sousou no Frieren');
    expect(within(cartao).getByText('Estreia 03/10/2026')).toBeOnTheScreen();
    expect(within(cartao).getByText('MADHOUSE')).toBeOnTheScreen();
    expect(within(cartao).getByText('12 episódios')).toBeOnTheScreen();
  });

  it('os atalhos trocam a temporada; a anterior para na mais antiga e "Atual" volta', async () => {
    const api = simularFetch(
      rotas({
        [rota('inverno', 2027)]: pagina([deOutono({ titulo_portugues: 'Do inverno' })], { por_pagina: 50 }),
        [rota('verao', 2026)]: pagina([deOutono({ titulo_portugues: 'Do verão' })], { por_pagina: 50 }),
      }),
    );
    await abrirTemporada();
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });
    expect(screen.queryByRole('button', { name: 'Temporada atual' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Próxima, Inverno 2027' }));
    expect(await screen.findByRole('link', { name: 'Do inverno, Anime' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Temporada atual' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Anterior, Verão 2026' }));
    expect(await screen.findByRole('link', { name: 'Do verão, Anime' })).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Anterior/ })).toBeDisabled());
    expect(api.para(rota('verao', 2026))).toHaveLength(1);
  });

  it('o seletor escolhe estação e ano, até 4 temporadas à frente', async () => {
    const api = simularFetch(rotas({ [rota('primavera', 2027)]: vazia, [rota('outono', 2027)]: vazia }));
    await abrirTemporada();
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher temporada, Outono 2026' }));
    await fireEvent.press(await screen.findByRole('radio', { name: '2027' }));
    expect(screen.queryByRole('radio', { name: '2028' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: '2025' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Primavera' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver resultados' }));

    expect(await screen.findByRole('button', { name: 'Escolher temporada, Primavera 2027' })).toBeOnTheScreen();
    await waitFor(() => expect(api.para(rota('primavera', 2027))).toHaveLength(1));

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher temporada, Primavera 2027' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Outono' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver resultados' }));
    expect(await screen.findByRole('button', { name: 'Escolher temporada, Outono 2027' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Próxima/ })).toBeDisabled();
  });

  it('a ordem padrão é "Mais esperados"; Estreia e Nota da fonte entram na requisição', async () => {
    const api = simularFetch(
      rotas({
        [rota('outono', 2026, 'estreia')]: pagina([dandadan, frieren], { por_pagina: 50 }),
        [rota('outono', 2026, 'nota_fonte')]: pagina([frieren], { por_pagina: 50 }),
      }),
    );
    await abrirTemporada();
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });
    expect(screen.getByRole('button', { name: 'Mais esperados', selected: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Estreia' }));
    await waitFor(() => {
      const titulos = within(screen.getByLabelText('Séries'))
        .getAllByRole('link')
        .map((c) => c.props.accessibilityLabel);
      expect(titulos).toEqual(['Dandadan, Anime', 'Sousou no Frieren, Anime']);
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Nota da fonte' }));
    await waitFor(() => expect(api.para(rota('outono', 2026, 'nota_fonte'))).toHaveLength(1));
  });

  it('traz todas as páginas da temporada', async () => {
    const cheia = Array.from({ length: 50 }, (_, i) =>
      deOutono({ id_midia: `MID-ANM-2026-${10000 + i}`, titulo_portugues: `Anime ${i + 1}` }),
    );
    simularFetch(
      rotas({
        [rota('outono', 2026)]: pagina(cheia, { por_pagina: 50, total: 51 }),
        [rota('outono', 2026, 'popularidade_fonte', 2)]: pagina([filme], { pagina: 2, por_pagina: 50 }),
      }),
    );

    await abrirTemporada();

    expect(await screen.findByRole('link', { name: 'Chainsaw Man: Reze, Anime' })).toBeOnTheScreen();
  });

  it('"Planejado" põe o anime na Lista e o cartão passa a dizer "Na Lista"', async () => {
    let lista: ReturnType<typeof itemDaLista>[] = [];
    const api = simularFetch(
      rotas({
        'GET /lista': () => ({ status: 200, corpo: { lista } }),
        'POST /lista/adicionar': () => {
          lista = [itemDaLista(frieren, { status_consumo: 'planejado' })];
          return { status: 201, corpo: { mensagem: 'ok', id_lista: 'LST-1' } };
        },
        'GET /usuario/estatisticas': { status: 200, corpo: { estatisticas: [] } },
        'GET /midias/MID-ANM-2026-20053/distribuicao': { status: 200, corpo: { distribuicao: [] } },
        'GET /midias/MID-ANM-2026-20053/relacoes': { status: 200, corpo: { relacoes: [] } },
      }),
    );
    await abrirTemporada();
    const cartao = await screen.findByLabelText('Cartão de Sousou no Frieren');

    await fireEvent.press(within(cartao).getByRole('button', { name: 'Planejado, Sousou no Frieren' }));

    expect(await within(cartao).findByText('Na Lista')).toBeOnTheScreen();
    expect(within(cartao).queryByRole('button', { name: /^Planejado/ })).not.toBeOnTheScreen();
    expect(api.para('POST /lista/adicionar')[0]?.corpo).toEqual({ id_midia: frieren.id_midia, status_consumo: 'planejado' });
  });

  it('o anime que já está na Lista mostra "Na Lista"', async () => {
    simularFetch(rotas({ 'GET /lista': { status: 200, corpo: { lista: [itemDaLista(frieren)] } } }));

    await abrirTemporada();

    const cartao = await screen.findByLabelText('Cartão de Sousou no Frieren');
    expect(await within(cartao).findByText('Na Lista')).toBeOnTheScreen();
    expect(within(screen.getByLabelText('Cartão de Dandadan')).getByRole('button', { name: 'Planejado, Dandadan' })).toBeOnTheScreen();
  });

  it('a temporada estimada tem selo, e tocar nele explica', async () => {
    simularFetch(rotas({ [rota('outono', 2026)]: pagina([frieren, estimado], { por_pagina: 50 }) }));
    await abrirTemporada();
    const cartao = await screen.findByLabelText('Cartão de Antigo');
    expect(within(screen.getByLabelText('Cartão de Sousou no Frieren')).queryByText('temporada estimada')).not.toBeOnTheScreen();
    expect(within(cartao).queryByText('pela data de estreia; pode estar errada')).not.toBeOnTheScreen();

    await fireEvent.press(within(cartao).getByRole('button', { name: 'temporada estimada' }));

    expect(within(cartao).getByText('pela data de estreia; pode estar errada')).toBeOnTheScreen();
  });

  it('temporada sem animes no Catálogo diz isso', async () => {
    simularFetch(rotas({ [rota('inverno', 2027)]: vazia }));
    await abrirTemporada();
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });

    await fireEvent.press(screen.getByRole('button', { name: 'Próxima, Inverno 2027' }));

    expect(await screen.findByText('Nenhum anime de Inverno 2027 no Catálogo.')).toBeOnTheScreen();
  });

  it('abre na temporada do link', async () => {
    simularFetch(rotas({ [rota('verao', 2026, 'estreia')]: pagina([frieren], { por_pagina: 50 }) }));

    await abrirLogado('/temporada?estacao=verao&ano=2026&ordem=estreia');

    expect(await screen.findByRole('button', { name: 'Escolher temporada, Verão 2026' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Estreia', selected: true })).toBeOnTheScreen();
  });
});

describe('Atalho da Temporada', () => {
  function explorar() {
    return {
      ...rotas(),
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': pagina([], { por_pagina: 24 }),
      'GET /midias?tipo=jogo&ordem=nota_media&pagina=1&por_pagina=24': pagina([], { por_pagina: 24 }),
      'GET /generos?tipo=anime': { status: 200, corpo: { generos: [] } },
      'GET /generos?tipo=jogo': { status: 200, corpo: { generos: [] } },
    } as Parameters<typeof simularFetch>[0];
  }

  it('no Explorar, abre a Temporada; some no Recorte de jogos', async () => {
    simularFetch(explorar());
    const app = await abrirLogado('/explorar');

    await fireEvent.press(await screen.findByRole('link', { name: 'Temporada de anime: Outono 2026' }));

    expect(await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/temporada');
  });

  it('no Explorar de jogos, não aparece', async () => {
    simularFetch(explorar());
    await abrirLogado('/explorar');
    await screen.findByRole('link', { name: 'Temporada de anime: Outono 2026' });

    await trocarRecorte('Jogos');

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /^Temporada de anime/ })).not.toBeOnTheScreen(),
    );
  });

  it('no Início, abre a Temporada; some no Recorte de jogos', async () => {
    const frierenEmAlta = anime();
    simularFetch({
      ...rotasDoInicio(),
      ...rotas(),
      'GET /midias/trending?tipo=anime&limite=10': { status: 200, corpo: { midias: [frierenEmAlta] } },
    } as Parameters<typeof simularFetch>[0]);
    const app = await abrirLogado();

    const atalho = await screen.findByRole('link', { name: 'Temporada de anime: Outono 2026' });
    await trocarRecorte('Jogos');
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /^Temporada de anime/ })).not.toBeOnTheScreen(),
    );
    await trocarRecorte('Anime & Mangá');
    await fireEvent.press(await screen.findByRole('link', { name: 'Temporada de anime: Outono 2026' }));

    expect(atalho).toBeDefined();
    expect(await screen.findByRole('button', { name: 'Escolher temporada, Outono 2026' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/temporada');
  });
});
