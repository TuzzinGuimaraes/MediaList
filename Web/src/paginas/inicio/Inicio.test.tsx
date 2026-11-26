import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { abrirLogado } from '../../testes/app';
import { erro } from '../../testes/fetchSimulado';
import { item, midia, popular, rotasDoInicio } from './dadosDeTeste';

afterEach(() => {
  vi.useRealTimers();
});

/** "Reduzir movimento" ligado no sistema; o resto do `matchMedia` segue o do ambiente. */
function simularReduzirMovimento() {
  const original = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((consulta) =>
    consulta.includes('prefers-reduced-motion') ? { ...original(consulta), matches: true } : original(consulta),
  );
}

const frieren = midia('ANI-1', 'Sousou no Frieren', { nota_media: 9.1, generos_lista: ['Aventura', 'Drama'] });
const berserk = midia('MAN-1', 'Berserk', { tipo: 'manga', nota_media: 9.3 });

describe('Início: destaque', () => {
  it('mostra a Mídia de maior nota de Em alta, juntando os Tipos do catálogo', async () => {
    await abrirLogado('/', { rotas: rotasDoInicio({ emAlta: [frieren, berserk] }) });

    const destaques = await screen.findByRole('region', { name: 'Destaques' });
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();
    expect(within(destaques).getByRole('link', { name: 'Detalhes: Berserk' })).toHaveAttribute('href', '/midia/MAN-1');
  });

  it('troca a cada 6 s e volta ao primeiro depois do último', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await abrirLogado('/', { rotas: rotasDoInicio({ emAlta: [frieren, berserk] }) });
    const destaques = await screen.findByRole('region', { name: 'Destaques' });

    act(() => vi.advanceTimersByTime(5900));
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(100));
    expect(within(destaques).getByRole('heading', { name: 'Sousou no Frieren' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6000));
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();
  });

  it('pausa com o mouse em cima e com o foco dentro', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await abrirLogado('/', { rotas: rotasDoInicio({ emAlta: [frieren, berserk] }) });
    const destaques = await screen.findByRole('region', { name: 'Destaques' });

    fireEvent.mouseEnter(destaques);
    act(() => vi.advanceTimersByTime(12000));
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();

    fireEvent.mouseLeave(destaques);
    act(() => within(destaques).getByRole('link', { name: 'Detalhes: Berserk' }).focus());
    act(() => vi.advanceTimersByTime(12000));
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();
  });

  it('com "reduzir movimento", não troca sozinho; os pontos trocam à mão', async () => {
    simularReduzirMovimento();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await abrirLogado('/', { rotas: rotasDoInicio({ emAlta: [frieren, berserk] }) });
    const destaques = await screen.findByRole('region', { name: 'Destaques' });

    act(() => vi.advanceTimersByTime(12000));
    expect(within(destaques).getByRole('heading', { name: 'Berserk' })).toBeInTheDocument();

    fireEvent.click(within(destaques).getByRole('button', { name: 'Destaque 2: Sousou no Frieren' }));
    expect(within(destaques).getByRole('heading', { name: 'Sousou no Frieren' })).toBeInTheDocument();
  });

  it('com a Mídia na Lista, "Editar" abre o editor do Item; fora dela, "Adicionar à Lista"', async () => {
    const { user } = await abrirLogado('/', {
      rotas: rotasDoInicio({ emAlta: [frieren, berserk], lista: [item(berserk, { status_consumo: 'lendo' })] }),
    });
    const destaques = await screen.findByRole('region', { name: 'Destaques' });

    expect(within(destaques).getByText('Em progresso')).toBeInTheDocument();
    await user.click(await within(destaques).findByRole('button', { name: 'Editar: Berserk' }));
    const editar = screen.getByRole('dialog', { name: 'Berserk' });
    expect(within(editar).getByRole('radio', { name: 'Em progresso' })).toBeChecked();
    expect(within(editar).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(within(destaques).getByRole('button', { name: 'Destaque 2: Sousou no Frieren' }));
    await user.click(within(destaques).getByRole('button', { name: 'Adicionar à Lista: Sousou no Frieren' }));
    const adicionar = screen.getByRole('dialog', { name: 'Sousou no Frieren' });
    expect(within(adicionar).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });
});


/** Títulos das fileiras, na ordem da tela. */
async function fileiras() {
  await screen.findByRole('region', { name: 'Continuar' });
  return screen
    .getAllByRole('region')
    .map((r) => r.getAttribute('aria-label'))
    .filter((nome) => nome !== 'Destaques');
}

const titulosDe = (regiao: string) =>
  within(screen.getByRole('region', { name: regiao }))
    .getAllByRole('link')
    .map((l) => l.textContent);

describe('Início: fileiras', () => {
  const vinland = midia('ANI-2', 'Vinland Saga', { nota_media: 8.8, generos: 'Ação, Drama' });
  const monster = midia('MAN-2', 'Monster', { tipo: 'manga', nota_media: 8.9, generos: 'Drama' });
  const futuro = midia('ANI-9', 'Sequência Anunciada', { data_lancamento: '2999-01-01' });

  it('na ordem da Resolution do 29, com "Porque você curte" pelos gêneros da Lista', async () => {
    await abrirLogado('/', {
      rotas: rotasDoInicio({
        emAlta: [frieren],
        populares: [popular(berserk, 40)],
        lista: [item(vinland, { status_consumo: 'assistindo' }), item(monster, { status_consumo: 'lido' })],
        porOrdem: {
          nota_media: [vinland],
          data_lancamento: [berserk],
          'nota_media:Drama': [frieren],
          'nota_media:Ação': [berserk],
          mais_adicionados: [frieren],
          mais_concluidos: [monster],
        },
      }),
    });

    expect(await fileiras()).toEqual([
      'Continuar',
      'Em alta',
      'Top 10',
      'Maiores notas',
      'Lançamentos recentes',
      'Porque você curte Drama',
      'Porque você curte Ação',
      'Mais adicionados',
      'Mais concluídos',
    ]);
  });

  it('Continuar traz só os Itens em progresso do catálogo, com o Progresso', async () => {
    const jogo = midia('JOG-1', 'Hades', { tipo: 'jogo' });
    await abrirLogado('/', {
      rotas: rotasDoInicio({
        emAlta: [frieren],
        lista: [
          item(vinland, { status_consumo: 'assistindo', progresso_atual: 3, progresso_total: 24 }),
          item(monster, { status_consumo: 'lido' }),
          item(jogo, { status_consumo: 'jogando' }),
        ],
      }),
    });

    await screen.findByRole('region', { name: 'Continuar' });
    expect(titulosDe('Continuar')).toEqual([expect.stringContaining('Vinland Saga')]);
    expect(within(screen.getByRole('region', { name: 'Continuar' })).getByText(/3 de 24/)).toBeInTheDocument();
  });

  it('sem duplicar: Maiores notas sem Em alta, Mais adicionados sem o Top 10, gênero sem a Lista, Lançamentos sem os futuros', async () => {
    await abrirLogado('/', {
      rotas: rotasDoInicio({
        emAlta: [frieren],
        populares: [popular(berserk, 40)],
        lista: [item(vinland, { status_consumo: 'assistindo' })],
        porOrdem: {
          nota_media: [frieren, monster],
          data_lancamento: [futuro, vinland],
          'nota_media:Ação': [vinland, berserk],
          'nota_media:Drama': [vinland, monster],
          mais_adicionados: [berserk, monster],
        },
      }),
    });

    await screen.findByRole('region', { name: 'Continuar' });
    expect(titulosDe('Maiores notas')).toEqual([expect.stringContaining('Monster')]);
    expect(titulosDe('Lançamentos recentes')).toEqual([expect.stringContaining('Vinland Saga')]);
    expect(titulosDe('Porque você curte Ação')).toEqual([expect.stringContaining('Berserk')]);
    expect(titulosDe('Mais adicionados')).toEqual([expect.stringContaining('Monster')]);
  });

  it('fileira vazia some', async () => {
    await abrirLogado('/', { rotas: rotasDoInicio({ emAlta: [frieren], lista: [item(vinland)] }) });

    expect(await fileiras()).toEqual(['Continuar', 'Em alta']);
  });

  it('no catálogo Jogos, "Mais concluídos" vira "Mais jogados"', async () => {
    localStorage.setItem('medialist.catalogo', 'jogos');
    const hades = midia('JOG-1', 'Hades', { tipo: 'jogo', nota_media: 9 });
    await abrirLogado('/', {
      rotas: rotasDoInicio({ emAlta: [hades], lista: [item(hades, { status_consumo: 'jogando' })], porOrdem: { mais_concluidos: [hades] } }),
    });

    expect(await fileiras()).toEqual(['Continuar', 'Em alta', 'Mais jogados']);
  });
});


describe('Início: estados', () => {
  it('catálogo sem nenhuma Mídia mostra o vazio', async () => {
    await abrirLogado('/', { rotas: rotasDoInicio({}) });

    expect(await screen.findByText('Nenhuma Mídia neste catálogo ainda.')).toBeInTheDocument();
  });

  it('sem Lista, "Porque você curte" usa os gêneros das populares', async () => {
    const naruto = midia('ANI-3', 'Naruto', { generos: 'Ação' });
    await abrirLogado('/', {
      rotas: rotasDoInicio({ emAlta: [frieren], populares: [popular(naruto, 9)], porOrdem: { 'nota_media:Ação': [frieren] } }),
    });

    expect(await screen.findByRole('region', { name: 'Porque você curte Ação' })).toBeInTheDocument();
  });

  it('erro em Em alta mostra a mensagem e tenta de novo', async () => {
    let falhar = true;
    const rotas = rotasDoInicio({ emAlta: [frieren] });
    const emAlta = rotas['GET /midias/trending'];
    const { user } = await abrirLogado('/', {
      rotas: {
        ...rotas,
        'GET /midias/trending': (req) =>
          falhar ? erro(400, 'requisicao_invalida', 'Falhou ao buscar.') : typeof emAlta === 'function' ? emAlta(req) : emAlta!,
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Falhou ao buscar.');
    falhar = false;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('region', { name: 'Destaques' })).toBeInTheDocument();
  });
});


describe('Início: Para assistir agora', () => {
  const HORA = 3_600_000;
  const daquiA = (ms: number) => new Date(Date.now() + ms).toISOString();
  const emExibicao = (id: string, titulo: string, campos: Parameters<typeof midia>[2] = {}) =>
    midia(id, titulo, { status_anime: 'em_exibicao', numero_episodios: 12, ...campos });

  const dandadan = emExibicao('ANI-10', 'Dandadan', { episodios_lancados: 7 });
  const apothecary = emExibicao('ANI-11', 'Apothecary', { episodios_lancados: 4 });
  const emDia = emExibicao('ANI-12', 'Em Dia', { episodios_lancados: 3, proximo_episodio_em: daquiA(49 * HORA) });
  const finalizado = midia('ANI-13', 'Finalizado', { status_anime: 'finalizado', episodios_lancados: 12, numero_episodios: 12 });

  const cartoesDaFaixa = () =>
    within(screen.getByRole('region', { name: 'Para assistir agora' }))
      .getAllByRole('link')
      .map((l) => l.textContent);

  it('acima da Continuar: atrasados do mais atrasado ao menos, depois os em dia; finalizado só na Continuar', async () => {
    await abrirLogado('/', {
      rotas: rotasDoInicio({
        emAlta: [frieren],
        lista: [
          item(apothecary, { progresso_atual: 3 }),
          item(dandadan, { progresso_atual: 4 }),
          item(emDia, { progresso_atual: 3 }),
          item(finalizado, { progresso_atual: 5 }),
        ],
      }),
    });

    await screen.findByRole('region', { name: 'Para assistir agora' });
    expect(await fileiras()).toEqual(['Para assistir agora', 'Continuar', 'Em alta']);
    expect(cartoesDaFaixa()).toEqual([
      expect.stringContaining('Dandadan'),
      expect.stringContaining('Apothecary'),
      expect.stringContaining('Em Dia'),
    ]);
    const faixa = screen.getByRole('region', { name: 'Para assistir agora' });
    expect(within(faixa).getByText('3 episódios atrás')).toBeInTheDocument();
    expect(within(faixa).getByText('1 episódio atrás')).toBeInTheDocument();
    expect(within(faixa).getByText('próximo em 2 d')).toBeInTheDocument();
    expect(within(faixa).queryByText(/Finalizado/)).not.toBeInTheDocument();
    expect(titulosDe('Continuar')).toContainEqual(expect.stringContaining('Finalizado'));
  });

  it('some sem anime em exibição que o Usuário esteja assistindo', async () => {
    await abrirLogado('/', {
      rotas: rotasDoInicio({
        emAlta: [frieren],
        lista: [item(finalizado, { progresso_atual: 5 }), item(dandadan, { status_consumo: 'planejado', progresso_atual: 0 })],
      }),
    });

    expect(await fileiras()).toEqual(['Continuar', 'Em alta']);
  });

  it('não aparece no catálogo Jogos', async () => {
    localStorage.setItem('medialist.catalogo', 'jogos');
    const hades = midia('JOG-1', 'Hades', { tipo: 'jogo', nota_media: 9 });
    await abrirLogado('/', {
      rotas: rotasDoInicio({
        emAlta: [hades],
        lista: [item(hades, { status_consumo: 'jogando' }), item(dandadan, { progresso_atual: 4 })],
      }),
    });

    expect(await fileiras()).toEqual(['Continuar', 'Em alta']);
  });

  it('+1 grava o Progresso na hora; ao alcançar o último lançado, o cartão sai dos atrasados', async () => {
    const quase = emExibicao('ANI-14', 'Quase', { episodios_lancados: 5, proximo_episodio_em: daquiA(3 * HORA + 60_000) });
    let progresso = 4;
    const { user, api } = await abrirLogado('/', {
      rotas: {
        ...rotasDoInicio({ emAlta: [frieren] }),
        'GET /lista': () => ({ status: 200, corpo: { lista: [item(quase, { progresso_atual: progresso })] } }),
        'PUT /lista/L-ANI-14/progresso': (req) => {
          progresso = req.corpo.progresso_atual;
          return { status: 200, corpo: { mensagem: 'ok' } };
        },
      },
    });

    const faixa = await screen.findByRole('region', { name: 'Para assistir agora' });
    expect(within(faixa).getByText('1 episódio atrás')).toBeInTheDocument();
    await user.click(within(faixa).getByRole('button', { name: '+1 episódio: Quase' }));

    expect(await within(faixa).findByText('próximo em 3 h')).toBeInTheDocument();
    expect(api.para('PUT /lista/L-ANI-14/progresso')[0]?.corpo).toEqual({ progresso_atual: 5 });
    expect(within(faixa).queryByRole('button', { name: '+1 episódio: Quase' })).not.toBeInTheDocument();
  });

  it('+1 recusado volta o cartão ao que era', async () => {
    let recusar = () => {};
    const { user } = await abrirLogado('/', {
      rotas: {
        ...rotasDoInicio({ emAlta: [frieren], lista: [item(dandadan, { progresso_atual: 4 })] }),
        'PUT /lista/L-ANI-10/progresso': () =>
          new Promise((resolver) => {
            recusar = () => resolver(erro(400, 'dados_invalidos', 'Progresso inválido.'));
          }),
      },
    });

    const faixa = await screen.findByRole('region', { name: 'Para assistir agora' });
    await user.click(within(faixa).getByRole('button', { name: '+1 episódio: Dandadan' }));
    expect(await within(faixa).findByText('2 episódios atrás')).toBeInTheDocument();

    act(() => recusar());
    expect(await within(faixa).findByText('3 episódios atrás')).toBeInTheDocument();
  });
});
