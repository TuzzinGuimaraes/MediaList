import path from 'node:path';
import { userEvent } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { guardarSessao } from '../auth/armazenamento';
import { usuarioAna, simularFetch } from './fetchSimulado';
import { anime, manga } from './midias';

const APP = path.resolve(__dirname, '../../app');

async function abrirExplorar() {
  await guardarSessao({ tokens: { access: 'A1', refresh: 'R1' }, usuario: usuarioAna as never });
  return renderRouter(APP, { initialUrl: '/explorar' });
}

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
    expect(await within(resultados).findByRole('link', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(within(resultados).getByRole('link', { name: 'Fullmetal Alchemist: Brotherhood' })).toBeOnTheScreen();
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
    await screen.findByRole('link', { name: 'Sousou no Frieren' });

    await fireEvent.press(screen.getByRole('button', { name: 'Mangá' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Seinen' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Título' }));
    await userEvent.setup().type(screen.getByLabelText('Buscar por título'), 'jojo');

    expect(await screen.findByRole('button', { name: 'Seinen', selected: true })).toBeOnTheScreen();
    await waitFor(() =>
      expect(
        api.para('GET /midias?tipo=manga&ordem=titulo&genero=Seinen&busca=jojo&pagina=1&por_pagina=24'),
      ).toHaveLength(1),
    );
    expect(api.chamadas.filter((c) => /busca=(j|jo|joj)&/.test(c.caminho))).toHaveLength(0);
    expect(await screen.findByRole('link', { name: 'JoJo no Kimyou na Bouken' })).toBeOnTheScreen();
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
    await within(resultados).findByRole('link', { name: 'Anime 1' });

    await rolarAteOFim(resultados);

    expect(await screen.findByRole('link', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(api.para('GET /midias?tipo=anime&ordem=nota_media&pagina=2&por_pagina=24')).toHaveLength(1);

    await rolarAteOFim(resultados);

    expect(api.chamadas.filter((c) => c.caminho.includes('pagina=3'))).toHaveLength(0);
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
