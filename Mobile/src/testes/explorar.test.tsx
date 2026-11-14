import { userEvent } from '@testing-library/react-native';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { simularFetch } from './fetchSimulado';
import { anime, manga } from './midias';
import { trocarRecorte } from './recorte';
import { abrirLogado } from './sessao';

const abrirExplorar = () => abrirLogado('/explorar');

/** GET /midias como a API responde (conferido contra o backend local). */
function pagina(midias: unknown[], numero = 1, tipo = 'anime') {
  return { status: 200, corpo: { midias, pagina: numero, por_pagina: 24, tipo } };
}

function generos(...nomes: string[]) {
  return {
    status: 200,
    corpo: {
      generos: nomes.map((nome_genero, i) => ({
        id_genero: i + 1,
        nome_genero,
        descricao: null,
        aplicavel_a: ['anime', 'jogo', 'manga'],
      })),
    },
  };
}

const frieren = anime();
const fma = anime({ id_midia: 'MID-ANM-2026-20011', titulo_portugues: 'Fullmetal Alchemist: Brotherhood' });

describe('Explorar', () => {
  it('abre com os animes do Recorte animanga, pela nota', async () => {
    simularFetch({
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': pagina([frieren, fma]),
      'GET /generos?tipo=anime': generos('Ação', 'Drama'),
    });

    await abrirExplorar();

    const resultados = await screen.findByLabelText('Resultados');
    expect(await within(resultados).findByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
    expect(within(resultados).getByRole('link', { name: 'Fullmetal Alchemist: Brotherhood, Anime' })).toBeOnTheScreen();
  });

  it('Tipo, Gênero, ordem e busca entram na requisição; a busca espera a digitação parar', async () => {
    const jojo = manga();
    const api = simularFetch({
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': pagina([frieren]),
      'GET /generos?tipo=anime': generos('Ação', 'Drama'),
      'GET /midias?tipo=manga&ordem=nota_media&pagina=1&por_pagina=24': pagina([jojo], 1, 'manga'),
      'GET /generos?tipo=manga': generos('Ação', 'Seinen'),
      'GET /midias?tipo=manga&ordem=nota_media&genero=Seinen&pagina=1&por_pagina=24': pagina([jojo], 1, 'manga'),
      'GET /midias?tipo=manga&ordem=titulo&genero=Seinen&pagina=1&por_pagina=24': pagina([jojo], 1, 'manga'),
      'GET /midias?tipo=manga&ordem=titulo&genero=Seinen&busca=jojo&pagina=1&por_pagina=24': pagina([jojo], 1, 'manga'),
    });
    await abrirExplorar();
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });

    await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Mangá' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Seinen' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Título' }));
    expect(screen.getByRole('radio', { name: 'Seinen', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver resultados' }));
    await userEvent.setup().type(screen.getByLabelText('Buscar por título'), 'jojo');

    expect(screen.getByRole('button', { name: 'Filtros, 3 ativos' })).toBeOnTheScreen();
    await waitFor(() =>
      expect(
        api.para('GET /midias?tipo=manga&ordem=titulo&genero=Seinen&busca=jojo&pagina=1&por_pagina=24'),
      ).toHaveLength(1),
    );
    expect(api.chamadas.filter((c) => /busca=(j|jo|joj)&/.test(c.caminho))).toHaveLength(0);
    expect(await screen.findByRole('link', { name: 'JoJo no Kimyou na Bouken, Mangá' })).toBeOnTheScreen();
  });

  it('no Recorte jogos busca só jogos, sem escolha de Tipo; nada encontrado mostra estado vazio', async () => {
    const api = simularFetch({
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': pagina([frieren]),
      'GET /generos?tipo=anime': generos('Drama'),
      'GET /midias?tipo=jogo&ordem=nota_media&pagina=1&por_pagina=24': pagina([], 1, 'jogo'),
      'GET /generos?tipo=jogo': generos('Ação'),
    });
    await abrirExplorar();
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });

    await trocarRecorte('Jogos');

    expect(await screen.findByText('Nenhuma Mídia com esses filtros.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
    expect(await screen.findByRole('radio', { name: 'Ação' })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Anime' })).not.toBeOnTheScreen();
    expect(api.para('GET /midias?tipo=jogo&ordem=nota_media&pagina=1&por_pagina=24')).toHaveLength(1);
  });

  it('"Limpar filtros" volta Tipo, Gênero e ordem ao padrão e zera o contador', async () => {
    const api = simularFetch({
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': pagina([frieren]),
      'GET /generos?tipo=anime': generos('Ação', 'Drama'),
      'GET /midias?tipo=anime&ordem=nota_media&genero=Drama&pagina=1&por_pagina=24': pagina([frieren]),
      'GET /midias?tipo=anime&ordem=data_lancamento&genero=Drama&pagina=1&por_pagina=24': pagina([frieren]),
    });
    await abrirExplorar();
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });

    await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Drama' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Lançamento' }));
    expect(screen.getByRole('button', { name: 'Filtros, 2 ativos' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(screen.getByRole('radio', { name: 'Todos', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Nota', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver resultados' }));
    expect(screen.queryByRole('button', { name: 'Ver resultados' })).not.toBeOnTheScreen();
    expect(api.para('GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24').length).toBeGreaterThan(0);
  });

  it('busca sem resultado diz o que foi buscado', async () => {
    simularFetch({
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': pagina([frieren]),
      'GET /generos?tipo=anime': generos(),
      'GET /midias?tipo=anime&ordem=nota_media&busca=zzz&pagina=1&por_pagina=24': pagina([]),
    });
    await abrirExplorar();
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });

    await userEvent.setup().type(screen.getByLabelText('Buscar por título'), 'zzz');

    expect(await screen.findByText('Nenhuma Mídia encontrada para "zzz".')).toBeOnTheScreen();
  });

  it('erro do servidor mostra o aviso e "Tentar de novo" recarrega', async () => {
    let falhar = true;
    simularFetch({
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': () =>
        falhar ? { status: 400, corpo: { erro: 'Erro ao buscar mídias' } } : pagina([frieren]),
      'GET /generos?tipo=anime': generos(),
    });
    await abrirExplorar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro ao buscar mídias');
    falhar = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
  });

  it('se os Gêneros falham, avisa sem esconder os resultados e "Tentar de novo" recarrega', async () => {
    let falhando = true;
    simularFetch({
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': pagina([frieren]),
      'GET /generos?tipo=anime': () =>
        falhando ? { status: 500, corpo: { erro: 'Falha no servidor' } } : generos('Ação', 'Drama'),
    });

    await abrirExplorar();

    expect(await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent('Falha no servidor');

    falhando = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('radio', { name: 'Drama' })).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('tocar num resultado abre o detalhe da Mídia', async () => {
    simularFetch({
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': pagina([frieren]),
      'GET /generos?tipo=anime': generos(),
      'GET /midias/MID-ANM-2026-20053': { status: 200, corpo: frieren },
      'GET /midias/MID-ANM-2026-20053/distribuicao': { status: 200, corpo: { distribuicao: [] } },
      'GET /avaliacoes/MID-ANM-2026-20053': { status: 200, corpo: { avaliacoes: [] } },
      'GET /lista': { status: 200, corpo: { lista: [] } },
    });
    const app = await abrirExplorar();

    await fireEvent.press(await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' }));

    expect(await screen.findByRole('header', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/midia/MID-ANM-2026-20053');
  });

  it('rolar até o fim pede a próxima página; uma página incompleta encerra a rolagem', async () => {
    const cheia = Array.from({ length: 24 }, (_, i) =>
      anime({ id_midia: `MID-ANM-2026-${10000 + i}`, titulo_portugues: `Anime ${i + 1}` }),
    );
    const api = simularFetch({
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': pagina(cheia),
      'GET /midias?tipo=anime&ordem=nota_media&pagina=2&por_pagina=24': pagina([frieren], 2),
      'GET /generos?tipo=anime': generos(),
    });
    await abrirExplorar();
    const resultados = await screen.findByLabelText('Resultados');
    await within(resultados).findByRole('link', { name: 'Anime 1, Anime' });

    await rolarAteOFim(resultados);

    expect(await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
    expect(api.para('GET /midias?tipo=anime&ordem=nota_media&pagina=2&por_pagina=24')).toHaveLength(1);

    await rolarAteOFim(resultados);

    expect(api.chamadas.filter((c) => c.caminho.includes('pagina=3'))).toHaveLength(0);
  });

  it('se a próxima página falha, o fim da lista oferece "Tentar de novo"', async () => {
    const cheia = Array.from({ length: 24 }, (_, i) =>
      anime({ id_midia: `MID-ANM-2026-${10000 + i}`, titulo_portugues: `Anime ${i + 1}` }),
    );
    let falhar = true;
    simularFetch({
      'GET /midias?tipo=anime&ordem=nota_media&pagina=1&por_pagina=24': pagina(cheia),
      'GET /midias?tipo=anime&ordem=nota_media&pagina=2&por_pagina=24': () =>
        falhar ? { status: 400, corpo: { erro: 'Erro ao buscar mídias' } } : pagina([frieren], 2),
      'GET /generos?tipo=anime': generos(),
    });
    await abrirExplorar();
    const resultados = await screen.findByLabelText('Resultados');
    await within(resultados).findByRole('link', { name: 'Anime 1, Anime' });

    await rolarAteOFim(resultados);
    falhar = false;
    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Anime 1, Anime' })).toBeOnTheScreen();
  });
});

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
