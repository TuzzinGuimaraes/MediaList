import { userEvent } from '@testing-library/react-native';
import { fireEvent, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { POR_CARROSSEL } from '../api/inicio';
import type { Midia } from '../api/tipos';
import { pagina, rotasSemAvaliacoes } from './contrato';
import { simularFetch } from './fetchSimulado';
import { rotaCarrossel, rotasDoInicio } from './inicio';
import { anime, fullmetal, itemDaLista as item, jogo, manga, popular } from './midias';
import { pilulaRecorte, trocarRecorte } from './recorte';
import { abrirLogado } from './sessao';

const frieren = anime();
const fma = fullmetal();
const jojo = manga();
const hollow = jogo();

/** O card da Mídia; ela aparece nos destaques e em Em alta, basta o primeiro. */
async function card(nome: string) {
  return (await screen.findAllByRole('link', { name: nome }))[0];
}

function catalogo() {
  return {
    ...rotasDoInicio(),
    'GET /midias/trending?tipo=anime&limite=10': { status: 200, corpo: { midias: [frieren, fma] } },
    'GET /midias/trending?tipo=manga&limite=10': { status: 200, corpo: { midias: [jojo] } },
    'GET /midias/trending?tipo=jogo&limite=10': { status: 200, corpo: { midias: [hollow] } },
    'GET /midias/populares?tipo=anime': { status: 200, corpo: { midias: [popular(fma, 4)] } },
    'GET /midias/populares?tipo=manga': { status: 200, corpo: { midias: [popular(jojo, 7)] } },
    'GET /midias/populares?tipo=jogo': { status: 200, corpo: { midias: [] } },
  };
}

describe('Início', () => {
  it('no Recorte animanga, mostra em alta animes e mangás juntos, do melhor avaliado para baixo', async () => {
    const api = simularFetch(catalogo());

    await abrirLogado();

    const emAlta = await screen.findByLabelText('Em alta');
    const titulos = within(emAlta).getAllByRole('link').map((c) => c.props.accessibilityLabel);
    expect(titulos).toEqual([
      'JoJo no Kimyou na Bouken, Mangá',
      'Sousou no Frieren, Anime',
      'Fullmetal Alchemist: Brotherhood, Anime',
    ]);
    expect(api.para('GET /midias/trending?tipo=jogo&limite=10')).toHaveLength(0);
  });

  it('cada card mostra o selo do Tipo de mídia, também no rótulo de acessibilidade', async () => {
    simularFetch(catalogo());

    await abrirLogado();

    const emAlta = await screen.findByLabelText('Em alta');
    const cardFrieren = await within(emAlta).findByRole('link', { name: 'Sousou no Frieren, Anime' });
    const cardJojo = within(emAlta).getByRole('link', { name: 'JoJo no Kimyou na Bouken, Mangá' });
    expect(within(cardFrieren).getByText('Anime')).toBeOnTheScreen();
    expect(within(cardJojo).getByText('Mangá')).toBeOnTheScreen();
  });

  it('card mostra a Nota dos Usuários e a da fonte com rótulos distintos; sem nenhuma, nada', async () => {
    simularFetch({
      ...catalogo(),
      'GET /midias/trending?tipo=anime&limite=10': {
        status: 200,
        corpo: {
          midias: [
            anime({ nota_media: 9.1, nota_fonte: 8.4, origem_nota: 'AniList' }),
            anime({ ...fma, nota_media: null, total_avaliacoes: null, nota_fonte: null, origem_nota: null }),
          ],
        },
      },
      'GET /midias/trending?tipo=manga&limite=10': {
        status: 200,
        corpo: { midias: [manga({ nota_media: null, total_avaliacoes: null, nota_fonte: 7.5, origem_nota: 'AniList' })] },
      },
    });

    await abrirLogado();

    const emAlta = await screen.findByLabelText('Em alta');
    const cardFrieren = await within(emAlta).findByRole('link', { name: 'Sousou no Frieren, Anime' });
    expect(cardFrieren).toHaveAccessibilityValue({ text: 'Nota dos Usuários 9.1, Nota AniList 8.4' });
    expect(within(cardFrieren).getByText('9.1')).toBeOnTheScreen();
    expect(within(cardFrieren).getByText('Usuários')).toBeOnTheScreen();
    expect(within(cardFrieren).getByText('8.4')).toBeOnTheScreen();
    expect(within(cardFrieren).getByText('AniList')).toBeOnTheScreen();

    const cardJojo = within(emAlta).getByRole('link', { name: 'JoJo no Kimyou na Bouken, Mangá' });
    expect(cardJojo).toHaveAccessibilityValue({ text: 'Nota AniList 7.5' });
    expect(within(cardJojo).queryByText('Usuários')).not.toBeOnTheScreen();

    const cardFma = within(emAlta).getByRole('link', { name: 'Fullmetal Alchemist: Brotherhood, Anime' });
    expect(within(cardFma).queryByText('Usuários')).not.toBeOnTheScreen();
    expect(within(cardFma).queryByText('AniList')).not.toBeOnTheScreen();
  });

  it('em alta usa a Nota da fonte quando a Mídia não tem Avaliações', async () => {
    simularFetch({
      ...catalogo(),
      'GET /midias/trending?tipo=manga&limite=10': {
        status: 200,
        corpo: { midias: [manga({ nota_media: null, total_avaliacoes: null, nota_fonte: 9.5, origem_nota: 'AniList' })] },
      },
    });

    await abrirLogado();

    const emAlta = await screen.findByLabelText('Em alta');
    expect(within(emAlta).getAllByRole('link').map((c) => c.props.accessibilityLabel)).toEqual([
      'JoJo no Kimyou na Bouken, Mangá',
      'Sousou no Frieren, Anime',
      'Fullmetal Alchemist: Brotherhood, Anime',
    ]);
  });

  it('Top 10 ordena pelo número de Usuários que têm a Mídia na Lista', async () => {
    simularFetch(catalogo());

    await abrirLogado();

    const populares = await screen.findByLabelText('Top 10');
    expect(await within(populares).findAllByRole('link')).toHaveLength(2);
    expect(within(populares).getAllByRole('link').map((c) => c.props.accessibilityLabel)).toEqual([
      'JoJo no Kimyou na Bouken, Mangá',
      'Fullmetal Alchemist: Brotherhood, Anime',
    ]);
  });

  it('trocar o Recorte para jogos pede só jogos', async () => {
    const api = simularFetch(catalogo());
    await abrirLogado();
    await screen.findByLabelText('Em alta');

    await trocarRecorte('Jogos');

    const emAlta = await screen.findByLabelText('Em alta');
    expect(await within(emAlta).findByRole('link', { name: 'Hollow Knight, Jogo' })).toBeOnTheScreen();
    expect(within(emAlta).queryByRole('link', { name: 'Sousou no Frieren, Anime' })).not.toBeOnTheScreen();
    expect(api.para('GET /midias/trending?tipo=jogo&limite=10')).toHaveLength(1);
    expect(api.para('GET /midias/populares?tipo=jogo')).toHaveLength(1);
    // Sem populares no catálogo, o Top 10 some em vez de mostrar um carrossel vazio.
    expect(screen.queryByLabelText('Top 10')).not.toBeOnTheScreen();
  });

  it('a pílula abre o menu com as duas opções e a atual marcada', async () => {
    simularFetch(catalogo());
    await abrirLogado();

    await fireEvent.press(await pilulaRecorte('Anime & Mangá'));

    const menu = await screen.findByLabelText('Catálogo');
    expect(within(menu).getAllByRole('menuitem').map((o) => o.props.accessibilityLabel)).toEqual([
      'Anime & Mangá',
      'Jogos',
    ]);
    expect(within(menu).getByRole('menuitem', { name: 'Anime & Mangá', selected: true })).toBeOnTheScreen();
    expect(within(menu).getByRole('menuitem', { name: 'Jogos', selected: false })).toBeOnTheScreen();
  });

  it('tocar fora do menu fecha sem trocar o Recorte', async () => {
    const api = simularFetch(catalogo());
    await abrirLogado();
    await card('Sousou no Frieren, Anime');

    await fireEvent.press(await pilulaRecorte());
    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar menu' }));

    expect(screen.queryByLabelText('Catálogo')).not.toBeOnTheScreen();
    expect(await pilulaRecorte('Anime & Mangá')).toBeOnTheScreen();
    expect(screen.getAllByRole('link', { name: 'Sousou no Frieren, Anime' })[0]).toBeOnTheScreen();
    expect(api.para('GET /midias/trending?tipo=jogo&limite=10')).toHaveLength(0);
  });

  it('escolher o Recorte atual só fecha o menu', async () => {
    const api = simularFetch(catalogo());
    await abrirLogado();
    await card('Sousou no Frieren, Anime');
    const pedidos = api.chamadas.length;

    await trocarRecorte('Anime & Mangá');

    expect(screen.queryByLabelText('Catálogo')).not.toBeOnTheScreen();
    expect(await pilulaRecorte('Anime & Mangá')).toBeOnTheScreen();
    expect(screen.getAllByRole('link', { name: 'Sousou no Frieren, Anime' })[0]).toBeOnTheScreen();
    expect(api.chamadas).toHaveLength(pedidos);
  });

  it('com animação, a pílula mostra o novo Recorte na hora e o conteúdo chega após o fade', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const api = simularFetch(catalogo());
    await abrirLogado();
    await card('Sousou no Frieren, Anime');

    await trocarRecorte('Jogos');

    // Durante o fade-out a pílula já mostra Jogos e o conteúdo ainda é o do Recorte anterior.
    expect(await pilulaRecorte('Jogos')).toBeOnTheScreen();
    expect(screen.getAllByRole('link', { name: 'Sousou no Frieren, Anime' })[0]).toBeOnTheScreen();
    expect(await card('Hollow Knight, Jogo')).toBeOnTheScreen();
    expect(api.para('GET /midias/trending?tipo=jogo&limite=10')).toHaveLength(1);
  });

  it('o Recorte escolhido continua valendo ao trocar de aba e voltar', async () => {
    simularFetch({ ...catalogo(), 'GET /lista': { status: 200, corpo: { lista: [] } } });
    await abrirLogado();
    await trocarRecorte('Jogos');

    await fireEvent.press(await screen.findByRole('button', { name: /^Explorar, tab/ }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Início, tab/ }));

    expect(await pilulaRecorte('Jogos')).toBeOnTheScreen();
    expect(await card('Hollow Knight, Jogo')).toBeOnTheScreen();
  });

  it('puxar para atualizar pede os dados de novo', async () => {
    let nota = 9.1;
    const api = simularFetch({
      ...catalogo(),
      'GET /midias/trending?tipo=anime&limite=10': () => ({
        status: 200,
        corpo: { midias: [anime({ titulo_portugues: `Frieren ${nota}`, nota_media: nota })] },
      }),
    });
    await abrirLogado();
    await card('Frieren 9.1, Anime');

    nota = 9.3;
    await userEvent.setup().pullToRefresh(screen.getByTestId('inicio'));

    expect(await card('Frieren 9.3, Anime')).toBeOnTheScreen();
    expect(api.para('GET /midias/populares?tipo=manga')).toHaveLength(2);
  });

  it('sem conexão, avisa e "Tentar de novo" recarrega', async () => {
    let online = false;
    const rotas = catalogo();
    simularFetch({
      ...rotas,
      'GET /midias/trending?tipo=anime&limite=10': () => {
        if (!online) throw new TypeError('Network request failed');
        return rotas['GET /midias/trending?tipo=anime&limite=10'];
      },
    });
    await abrirLogado();

    expect(await screen.findByText('Sem conexão com o servidor.', {}, { timeout: 3000 })).toBeOnTheScreen();
    online = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await card('Sousou no Frieren, Anime')).toBeOnTheScreen();
  });

  it('tocar num card abre o detalhe; voltar retorna ao Início', async () => {
    simularFetch({
      ...catalogo(),
      'GET /midias/MID-ANM-2026-20053': { status: 200, corpo: frieren },
      'GET /midias/MID-ANM-2026-20053/distribuicao': { status: 200, corpo: { distribuicao: [] } },
      ...rotasSemAvaliacoes('MID-ANM-2026-20053'),
      'GET /lista': { status: 200, corpo: { lista: [] } },
    });
    const app = await abrirLogado();

    await fireEvent.press(await card('Sousou no Frieren, Anime'));

    expect(await screen.findByRole('header', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/midia/MID-ANM-2026-20053');

    await fireEvent.press(screen.getByRole('button', { name: /voltar|back/i }));
    expect(await screen.findByLabelText('Em alta')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/');
  });
});

describe('Início: destaques e carrosséis', () => {
  const berserk = anime({ id_midia: 'MID-ANM-2026-20099', titulo_portugues: 'Berserk', nota_media: 8.7, generos: 'Ação' });
  const futuro = anime({ id_midia: 'MID-ANM-2099-1', titulo_portugues: 'Anime do Futuro', data_lancamento: '2099-01-01' });
  const monster = anime({ id_midia: 'MID-ANM-2026-20100', titulo_portugues: 'Monster', generos: 'Drama' });
  const vagabond = manga({ id_midia: 'MID-MNG-2026-30100', titulo_portugues: 'Vagabond', generos: 'Ação' });

  const midias = (...lista: Midia[]) => pagina(lista, { por_pagina: POR_CARROSSEL });

  function completo() {
    return {
      ...catalogo(),
      'GET /lista': {
        status: 200,
        corpo: {
          lista: [
            item(frieren, { status_consumo: 'assistindo', progresso_atual: 10, progresso_total: 28 }),
            item(jojo, { status_consumo: 'lido' }),
            item(hollow, { status_consumo: 'jogando' }),
          ],
        },
      },
      [rotaCarrossel('anime', 'nota_media')]: midias(frieren, fma, berserk),
      [rotaCarrossel('anime', 'data_lancamento')]: midias(futuro, frieren),
      [rotaCarrossel('anime', 'mais_adicionados')]: midias(fma, monster),
      [rotaCarrossel('manga', 'mais_concluidos')]: midias({ ...jojo, total_concluidos: 3 }),
      [rotaCarrossel('anime', 'nota_media', 'Aventura')]: midias(frieren, monster),
      [rotaCarrossel('manga', 'nota_media', 'Ação')]: midias(vagabond),
    };
  }

  const nomes = (rotulo: string) =>
    within(screen.getByLabelText(rotulo)).getAllByRole('link').map((c) => c.props.accessibilityLabel);

  it('mostra os destaques e os carrosséis na ordem da identidade', async () => {
    simularFetch(completo());

    await abrirLogado();

    expect(await screen.findByLabelText('Mais concluídos')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Porque você curte Ação')).toBeOnTheScreen();
    const secoes = screen.getAllByRole('header').map((h) => h.props.children);
    expect(secoes).toEqual([
      'Continuar',
      'Em alta',
      'Top 10',
      'Maiores notas',
      'Lançamentos recentes',
      'Porque você curte Aventura',
      'Porque você curte Ação',
      'Mais adicionados',
      'Mais concluídos',
    ]);
    // Destaques: as Mídias de Em alta, no card C.
    expect(nomes('Destaques')).toEqual(nomes('Em alta'));
  });

  it('destaque: "Editar" no que está na Lista, "Adicionar à Lista" no resto, e os dois abrem o editor', async () => {
    simularFetch(completo());

    await abrirLogado();

    const destaques = within(await screen.findByLabelText('Destaques'));
    expect(await destaques.findByRole('button', { name: /^Editar: Sousou no Frieren/ })).toBeOnTheScreen();
    expect(destaques.getAllByRole('button', { name: /^Detalhes: / })).toHaveLength(3);

    await fireEvent.press(destaques.getByRole('button', { name: /^Adicionar à Lista: / }));
    expect(await screen.findByRole('button', { name: 'Salvar' })).toBeOnTheScreen();
  });

  it('Continuar traz só os Itens Em progresso do catálogo ativo', async () => {
    simularFetch(completo());

    await abrirLogado();

    await screen.findByLabelText('Continuar');
    expect(nomes('Continuar')).toEqual(['Sousou no Frieren, Anime']);
  });

  it('cada carrossel tira o que já aparece no anterior de mesma ordem, e Lançamentos tira o que não saiu', async () => {
    simularFetch(completo());

    await abrirLogado();

    await screen.findByLabelText('Mais concluídos');
    expect(nomes('Maiores notas')).toEqual(['Berserk, Anime']);
    expect(nomes('Lançamentos recentes')).toEqual(['Sousou no Frieren, Anime']);
    expect(nomes('Mais adicionados')).toEqual(['Monster, Anime']);
    // "Porque você curte" não sugere o que já está na Lista.
    expect(nomes('Porque você curte Aventura')).toEqual(['Monster, Anime']);
    expect(nomes('Porque você curte Ação')).toEqual(['Vagabond, Mangá']);
  });

  it('sem Lista e sem Mídias, só ficam os carrosséis com conteúdo', async () => {
    simularFetch(catalogo());

    await abrirLogado();

    await screen.findByLabelText('Em alta');
    const secoes = screen.getAllByRole('header').map((h) => h.props.children);
    expect(secoes).toEqual(['Em alta', 'Top 10']);
  });

  it('sem Em alta, só o carrossel dele some: os outros continuam', async () => {
    simularFetch({
      ...completo(),
      'GET /midias/trending?tipo=anime&limite=10': { status: 200, corpo: { midias: [] } },
      'GET /midias/trending?tipo=manga&limite=10': { status: 200, corpo: { midias: [] } },
    });

    await abrirLogado();

    expect(await screen.findByLabelText('Maiores notas')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Em alta')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Destaques')).not.toBeOnTheScreen();
    expect(screen.queryByText('Nenhuma Mídia neste catálogo ainda.')).not.toBeOnTheScreen();
  });

  it('com todos os carrosséis vazios, mostra o estado vazio da tela', async () => {
    simularFetch(rotasDoInicio());

    await abrirLogado();

    expect(await screen.findByText('Nenhuma Mídia neste catálogo ainda.')).toBeOnTheScreen();
    expect(screen.queryAllByRole('header')).toHaveLength(0);
  });

  it('no catálogo Jogos, os gêneros e os carrosséis seguem os jogos e "Mais concluídos" vira "Mais jogados"', async () => {
    const api = simularFetch({
      ...completo(),
      [rotaCarrossel('jogo', 'mais_concluidos')]: midias({ ...hollow, total_concluidos: 2 }),
      [rotaCarrossel('jogo', 'nota_media', 'Aventura')]: midias(jogo({ id_midia: 'MID-JOG-2', titulo_original: 'Celeste' })),
    });
    await abrirLogado();
    await screen.findByLabelText('Mais concluídos');

    await trocarRecorte('Jogos');

    expect(await screen.findByLabelText('Mais jogados')).toBeOnTheScreen();
    expect(nomes('Continuar')).toEqual(['Hollow Knight, Jogo']);
    // O jogo da Lista tem Ação e Aventura: os dois gêneros vêm dele.
    expect(await screen.findByLabelText('Porque você curte Aventura')).toBeOnTheScreen();
    expect(api.para(rotaCarrossel('jogo', 'nota_media', 'Ação'))).toHaveLength(1);
    expect(screen.queryByLabelText('Mais concluídos')).not.toBeOnTheScreen();
  });
});
