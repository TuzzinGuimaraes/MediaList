import path from 'node:path';
import { userEvent } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { guardarSessao } from '../auth/armazenamento';
import { usuarioAna, simularFetch } from './fetchSimulado';
import { anime, jogo, manga, popular } from './midias';
import { pilulaRecorte, trocarRecorte } from './recorte';

const APP = path.resolve(__dirname, '../../app');

async function abrirLogado() {
  await guardarSessao({ tokens: { access: 'A1', refresh: 'R1' }, usuario: usuarioAna as never });
  return renderRouter(APP, { initialUrl: '/' });
}

const frieren = anime();
const fma = anime({ id_midia: 'MID-ANM-2026-20011', titulo_portugues: 'Fullmetal Alchemist: Brotherhood', nota_media: 9.0 });
const jojo = manga();
const hollow = jogo();

function catalogo() {
  return {
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

  it('populares ordena pelo número de Usuários que têm a Mídia na Lista', async () => {
    simularFetch(catalogo());

    await abrirLogado();

    const populares = await screen.findByLabelText('Populares');
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
    expect(await screen.findByText('Nenhuma Mídia popular neste Recorte ainda.')).toBeOnTheScreen();
  });

  it('a pílula abre o menu com as duas opções e a atual marcada', async () => {
    simularFetch(catalogo());
    await abrirLogado();

    await fireEvent.press(await pilulaRecorte('Anime & Mangá'));

    const menu = await screen.findByLabelText('Recorte de catálogo');
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
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });

    await fireEvent.press(await pilulaRecorte());
    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar menu' }));

    expect(screen.queryByLabelText('Recorte de catálogo')).not.toBeOnTheScreen();
    expect(await pilulaRecorte('Anime & Mangá')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
    expect(api.para('GET /midias/trending?tipo=jogo&limite=10')).toHaveLength(0);
  });

  it('escolher o Recorte atual só fecha o menu', async () => {
    const api = simularFetch(catalogo());
    await abrirLogado();
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });
    const pedidos = api.chamadas.length;

    await trocarRecorte('Anime & Mangá');

    expect(screen.queryByLabelText('Recorte de catálogo')).not.toBeOnTheScreen();
    expect(await pilulaRecorte('Anime & Mangá')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
    expect(api.chamadas).toHaveLength(pedidos);
  });

  it('com animação, a pílula mostra o novo Recorte na hora e o conteúdo chega após o fade', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const api = simularFetch(catalogo());
    await abrirLogado();
    await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' });

    await trocarRecorte('Jogos');

    // Durante o fade-out a pílula já mostra Jogos e o conteúdo ainda é o do Recorte anterior.
    expect(await pilulaRecorte('Jogos')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
    expect(await screen.findByRole('link', { name: 'Hollow Knight, Jogo' })).toBeOnTheScreen();
    expect(api.para('GET /midias/trending?tipo=jogo&limite=10')).toHaveLength(1);
  });

  it('o Recorte escolhido continua valendo ao trocar de aba e voltar', async () => {
    simularFetch({ ...catalogo(), 'GET /lista': { status: 200, corpo: { lista: [] } } });
    await abrirLogado();
    await trocarRecorte('Jogos');

    await fireEvent.press(await screen.findByRole('button', { name: /^Explorar, tab/ }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Início, tab/ }));

    expect(await pilulaRecorte('Jogos')).toBeOnTheScreen();
    expect(await screen.findByRole('link', { name: 'Hollow Knight, Jogo' })).toBeOnTheScreen();
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
    await screen.findByRole('link', { name: 'Frieren 9.1, Anime' });

    nota = 9.3;
    await userEvent.setup().pullToRefresh(screen.getByTestId('inicio'));

    expect(await screen.findByRole('link', { name: 'Frieren 9.3, Anime' })).toBeOnTheScreen();
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

    expect(await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' })).toBeOnTheScreen();
  });

  it('tocar num card abre o detalhe; voltar retorna ao Início', async () => {
    simularFetch({
      ...catalogo(),
      'GET /midias/MID-ANM-2026-20053': { status: 200, corpo: frieren },
      'GET /midias/MID-ANM-2026-20053/distribuicao': { status: 200, corpo: { distribuicao: [] } },
      'GET /avaliacoes/MID-ANM-2026-20053': { status: 200, corpo: { avaliacoes: [] } },
      'GET /lista': { status: 200, corpo: { lista: [] } },
    });
    const app = await abrirLogado();

    await fireEvent.press(await screen.findByRole('link', { name: 'Sousou no Frieren, Anime' }));

    expect(await screen.findByRole('header', { name: 'Sousou no Frieren' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/midia/MID-ANM-2026-20053');

    await fireEvent.press(screen.getByRole('button', { name: /voltar|back/i }));
    expect(await screen.findByLabelText('Em alta')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/');
  });
});
