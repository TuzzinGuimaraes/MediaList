import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Esquemas } from '../../api/tipos';
import { simularLargura } from '../../testes/ambiente';
import { abrirLogado } from '../../testes/app';
import { erro, type Requisicao, type Resposta, type Rotas } from '../../testes/fetchSimulado';

type Midia = Esquemas['Midia'];

function midia(id: string, titulo: string, extra: Partial<Midia> = {}): Midia {
  return {
    id_midia: id,
    titulo_original: titulo,
    titulo_romaji: null,
    titulo_ingles: null,
    tipo: 'anime',
    poster_url: null,
    banner_url: null,
    sinopse: null,
    data_lancamento: '2020-04-01',
    generos: null,
    generos_lista: [],
    nota_media: null,
    nota_fonte: 8.1,
    origem_nota: 'AniList',
    total_avaliacoes: 0,
    total_usuarios: 3,
    total_concluidos: 1,
    classificacao: null,
    classificacao_etaria: null,
    fonte_original: null,
    trailer_url: null,
    status_catalogo: null,
    status_anime: 'finalizado',
    status_manga: null,
    status_jogo: null,
    numero_episodios: 12,
    episodios_lancados: null,
    proximo_episodio_em: null,
    temporada_estacao: null,
    temporada_ano: null,
    temporada_estimada: null,
    formato: null,
    duracao_episodio: null,
    estudio: null,
    numero_capitulos: null,
    numero_volumes: null,
    autor: null,
    artista: null,
    demografia: null,
    revista: null,
    publicadora_original: null,
    desenvolvedor: null,
    publicadora: null,
    plataformas: null,
    modo_jogo: null,
    ...extra,
  };
}

function pagina(itens: Midia[], { pagina = 1, total = itens.length, por_pagina = 30 } = {}) {
  return { status: 200, corpo: { itens, pagina, por_pagina, total } };
}

function generos(nomes: string[]) {
  const corpo: Esquemas['RespostaGeneros'] = {
    generos: nomes.map((nome_genero, i) => ({ id_genero: `GEN-${i}`, nome_genero, aplicavel_a: ['anime', 'manga'] })),
  };
  return { status: 200, corpo };
}

const GENEROS = ['Ação', 'Aventura', 'Comédia', 'Drama', 'Fantasia', 'Mistério', 'Romance', 'Esportes', 'Terror', 'Slice of Life'];

const PLATAFORMAS = ['Android', 'iOS', 'Linux', 'macOS', 'Nintendo Switch', 'PC', 'PlayStation 4', 'PlayStation 5', 'Xbox One', 'Xbox Series S/X'];
const ESTUDIOS = ['Bones', 'Kyoto Animation', 'Madhouse', 'MAPPA'];

/** Facetas como a API: plataformas só nos jogos, estúdios só nos animes. */
function facetas(req: Requisicao): Resposta {
  const tipo = req.query.get('tipo');
  const corpo: Esquemas['RespostaFacetas'] = {
    plataformas: tipo === 'jogo' ? PLATAFORMAS : [],
    estudios: tipo === 'anime' ? ESTUDIOS : [],
    temporada_mais_antiga: null,
  };
  return { status: 200, corpo };
}

/** Rotas do Explorar: `GET /midias` responde com `responder`; Gêneros e facetas, com as listas acima. */
function rotas(responder: (req: Requisicao) => Resposta = () => pagina([])): Rotas {
  return { 'GET /midias': responder, 'GET /generos': generos(GENEROS), 'GET /midias/facetas': facetas };
}

/** A query da última chamada a `GET /midias`, como objeto. */
function ultimaBusca(api: { para(rota: string): Requisicao[] }) {
  const chamadas = api.para('GET /midias');
  return Object.fromEntries(chamadas[chamadas.length - 1]!.query);
}

/** Os search params da URL atual, como objeto. */
function naUrl(historico: { location: { search: string } }) {
  return Object.fromEntries(new URLSearchParams(historico.location.search));
}

function grade() {
  return screen.findByRole('list', { name: 'Resultados' });
}

describe('Explorar', () => {
  it('abre com o primeiro Tipo do catálogo, mostra a grade e o total', async () => {
    const { api } = await abrirLogado('/explorar', {
      rotas: rotas(() => pagina([midia('MID-1', 'Frieren'), midia('MID-2', 'Mushishi')], { total: 2 })),
    });

    const lista = await grade();
    expect(within(lista).getByRole('link', { name: /Frieren/ })).toHaveAttribute('href', '/midia/MID-1');
    expect(within(lista).getByRole('link', { name: /Mushishi/ })).toBeInTheDocument();
    expect(screen.getByText('2 Mídias')).toBeInTheDocument();
    expect(ultimaBusca(api)).toEqual({ tipo: 'anime', pagina: '1', por_pagina: '30' });
  });

  it('o link com filtros abre a mesma busca', async () => {
    const { api } = await abrirLogado(
      '/explorar?genero=A%C3%A7%C3%A3o&situacao=finalizado&ano_min=2000&ano_max=2010&ordem=titulo&pagina=2',
      { rotas: rotas(() => pagina([midia('MID-1', 'Frieren')], { pagina: 2, total: 31 })) },
    );

    await grade();
    expect(ultimaBusca(api)).toEqual({
      tipo: 'anime',
      genero: 'Ação',
      status: 'finalizado',
      ano_min: '2000',
      ano_max: '2010',
      ordem: 'titulo',
      pagina: '2',
      por_pagina: '30',
    });
    expect(screen.getByRole('radio', { name: 'Ação' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Finalizado' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Título (A–Z)' })).toBeChecked();
    expect(screen.getByLabelText('Ano inicial')).toHaveValue('2000');
  });

  it('escolher um Gênero vai para a URL e volta à 1ª página', async () => {
    const { api, user, historico } = await abrirLogado('/explorar?pagina=3', {
      rotas: rotas(() => pagina([midia('MID-1', 'Frieren')], { total: 100 })),
    });
    await grade();

    await user.click(screen.getByRole('radio', { name: 'Comédia' }));

    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ genero: 'Comédia', pagina: '1' }));
    expect(naUrl(historico)).toEqual({ genero: 'Comédia' });
  });

  it('mostra 8 Gêneros e um "+N" com o resto', async () => {
    const { user } = await abrirLogado('/explorar', { rotas: rotas() });
    const genero = await screen.findByRole('region', { name: 'Gênero' });
    await within(genero).findByRole('radio', { name: 'Ação' });

    expect(within(genero).getAllByRole('radio')).toHaveLength(9); // Todos + 8
    expect(within(genero).queryByRole('radio', { name: 'Terror' })).not.toBeInTheDocument();

    await user.click(within(genero).getByRole('button', { name: 'Mostrar mais 2 gêneros' }));

    expect(within(genero).getByRole('radio', { name: 'Terror' })).toBeInTheDocument();
    expect(within(genero).getByRole('radio', { name: 'Slice of Life' })).toBeInTheDocument();
  });

  it('o Gênero escolhido fora dos 8 continua visível', async () => {
    await abrirLogado('/explorar?genero=Terror', { rotas: rotas() });

    expect(await screen.findByRole('radio', { name: 'Terror' })).toBeChecked();
  });

  it('trocar o Tipo descarta os filtros do Tipo anterior e mostra os do novo', async () => {
    const { api, user, historico } = await abrirLogado('/explorar?genero=A%C3%A7%C3%A3o&estudio=Madhouse&ordem=titulo', {
      rotas: rotas(),
    });
    expect(await screen.findByRole('region', { name: 'Estúdio' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Demografia' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Mangá' }));

    await waitFor(() => expect(naUrl(historico)).toEqual({ tipo: 'manga', ordem: 'titulo' }));
    expect(await screen.findByRole('region', { name: 'Demografia' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Estúdio' })).not.toBeInTheDocument();
    await waitFor(() => expect(ultimaBusca(api)).toEqual({ tipo: 'manga', ordem: 'titulo', pagina: '1', por_pagina: '30' }));
    expect(api.para('GET /generos').at(-1)!.query.get('tipo')).toBe('manga');
  });

  it('Demografia e Situação do mangá vão para a busca', async () => {
    const { api, user } = await abrirLogado('/explorar?tipo=manga', { rotas: rotas() });

    await user.click(await screen.findByRole('radio', { name: 'Seinen' }));
    await user.click(screen.getByRole('radio', { name: 'Em hiato' }));

    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ tipo: 'manga', demografia: 'seinen', status: 'hiato' }));
  });

  it('no catálogo Jogos não há escolha de Tipo; Plataforma e Modo de jogo filtram', async () => {
    localStorage.setItem('medialist.catalogo', 'jogos');
    const { api, user } = await abrirLogado('/explorar', { rotas: rotas() });
    const plataforma = await screen.findByRole('region', { name: 'Plataforma' });

    expect(screen.queryByRole('region', { name: 'Tipo' })).not.toBeInTheDocument();
    expect(ultimaBusca(api)).toMatchObject({ tipo: 'jogo' });

    // A plataforma vai com o nome exato da faceta.
    await user.click(await within(plataforma).findByRole('radio', { name: 'PlayStation 5' }));
    await user.click(screen.getByRole('radio', { name: 'Multijogador' }));

    await waitFor(() =>
      expect(ultimaBusca(api)).toMatchObject({ tipo: 'jogo', plataforma: 'PlayStation 5', modo_jogo: 'multi' }),
    );
    expect(api.para('GET /midias/facetas').at(-1)!.query.get('tipo')).toBe('jogo');
  });

  it('a Plataforma mostra as primeiras em pílulas e um "+N" com o resto', async () => {
    localStorage.setItem('medialist.catalogo', 'jogos');
    const { user } = await abrirLogado('/explorar', { rotas: rotas() });
    const plataforma = await screen.findByRole('region', { name: 'Plataforma' });

    expect(await within(plataforma).findByRole('radio', { name: 'Todas' })).toBeChecked();
    expect(within(plataforma).queryByRole('radio', { name: 'Xbox One' })).not.toBeInTheDocument();

    await user.click(within(plataforma).getByRole('button', { name: /Mostrar mais 2/ }));

    expect(within(plataforma).getByRole('radio', { name: 'Xbox Series S/X' })).toBeInTheDocument();
  });

  it('o Estúdio do anime é escolhido nas pílulas das facetas', async () => {
    const { api, user } = await abrirLogado('/explorar', { rotas: rotas() });
    const estudio = await screen.findByRole('region', { name: 'Estúdio' });

    await user.click(await within(estudio).findByRole('radio', { name: 'Madhouse' }));

    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ estudio: 'Madhouse' }));
  });

  it('um Estúdio da URL fora das primeiras continua visível e escolhido', async () => {
    await abrirLogado('/explorar?estudio=Studio%20Fora', { rotas: rotas() });
    const estudio = await screen.findByRole('region', { name: 'Estúdio' });

    expect(await within(estudio).findByRole('radio', { name: 'Studio Fora' })).toBeChecked();
  });

  it('um link com Tipo de outro catálogo troca o catálogo da nav', async () => {
    const { api } = await abrirLogado('/explorar?tipo=jogo&modo_jogo=single', { rotas: rotas() });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Jogos' })).toHaveAttribute('aria-pressed', 'true'));
    expect(ultimaBusca(api)).toMatchObject({ tipo: 'jogo', modo_jogo: 'single' });
    expect(api.para('GET /midias').every((c) => c.query.get('tipo') === 'jogo')).toBe(true);
  });

  it('trocar o catálogo na nav descarta Tipo e filtros que não valem nele', async () => {
    const { user, historico, api } = await abrirLogado('/explorar?tipo=manga&genero=Drama&demografia=josei&ano_min=1990', {
      rotas: rotas(),
    });
    await grade().catch(() => undefined);

    await user.click(screen.getByRole('button', { name: 'Jogos' }));

    await waitFor(() => expect(naUrl(historico)).toEqual({ ano_min: '1990' }));
    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ tipo: 'jogo', ano_min: '1990' }));
    expect(ultimaBusca(api)).not.toHaveProperty('genero');
  });

  it('Ano inicial e final filtram pelo ano de lançamento', async () => {
    const { api, user } = await abrirLogado('/explorar', { rotas: rotas() });

    await user.type(await screen.findByLabelText('Ano inicial'), '2000');
    await user.type(screen.getByLabelText('Ano final'), '2005');

    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ ano_min: '2000', ano_max: '2005' }));
  });

  it('Ano inicial depois do final avisa e não filtra por Ano', async () => {
    const { api } = await abrirLogado('/explorar?ano_min=2010&ano_max=2000', { rotas: rotas() });

    expect(await screen.findByRole('alert')).toHaveTextContent('O ano inicial passa do final.');
    expect(ultimaBusca(api)).not.toHaveProperty('ano_min');
    expect(ultimaBusca(api)).not.toHaveProperty('ano_max');
  });

  it('pagina pelo total', async () => {
    const { api, user, historico } = await abrirLogado('/explorar', {
      rotas: rotas((req) => pagina([midia(`MID-${req.query.get('pagina')}`, `Obra ${req.query.get('pagina')}`)], {
        pagina: Number(req.query.get('pagina')),
        total: 75,
      })),
    });
    await grade();
    const nav = screen.getByRole('navigation', { name: 'Paginação' });

    expect(within(nav).getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: 'Página 3' })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: 'Página 4' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    await user.click(within(nav).getByRole('button', { name: 'Próxima página' }));

    expect(await screen.findByRole('link', { name: /Obra 2/ })).toBeInTheDocument();
    expect(naUrl(historico)).toEqual({ pagina: '2' });
    expect(ultimaBusca(api)).toMatchObject({ pagina: '2' });
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');
  });

  it('uma seção recolhe e mostra o valor escolhido ao lado do título', async () => {
    const { user } = await abrirLogado('/explorar?genero=Drama', { rotas: rotas() });
    const secao = await screen.findByRole('region', { name: 'Gênero' });
    const titulo = within(secao).getByRole('button', { name: /Gênero/ });

    await user.click(titulo);

    expect(titulo).toHaveAttribute('aria-expanded', 'false');
    expect(titulo).toHaveTextContent('Drama');
    expect(within(secao).queryByRole('radio', { name: 'Drama' })).not.toBeInTheDocument();
  });

  it('a busca da nav chega à tela e o campo a refina', async () => {
    const { api, user, historico } = await abrirLogado('/explorar?busca=fri', { rotas: rotas() });

    expect(await screen.findByText('Nenhuma Mídia encontrada para "fri".')).toBeInTheDocument();
    expect(ultimaBusca(api)).toMatchObject({ busca: 'fri' });
    // Sem ordem escolhida, a API ordena a busca por relevância.
    expect(ultimaBusca(api)).not.toHaveProperty('ordem');

    const campo = screen.getByRole('searchbox', { name: 'Buscar por título' });
    expect(campo).toHaveValue('fri');
    await user.type(campo, 'eren');

    await waitFor(() => expect(naUrl(historico)).toEqual({ busca: 'frieren' }));
    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ busca: 'frieren' }));
  });

  it('com busca, escolher a ordem padrão manda a ordem no lugar da relevância', async () => {
    const { api, user, historico } = await abrirLogado('/explorar?busca=fri', { rotas: rotas() });
    const ordem = await screen.findByRole('group', { name: 'Ordem' });
    // Sem ordem escolhida, a busca vai por relevância: nenhuma ordem aparece marcada.
    expect(within(ordem).queryByRole('radio', { checked: true })).not.toBeInTheDocument();

    await user.click(within(ordem).getByRole('radio', { name: 'Maiores notas' }));

    await waitFor(() => expect(naUrl(historico)).toEqual({ busca: 'fri', ordem: 'nota_media' }));
    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ busca: 'fri', ordem: 'nota_media' }));
    expect(within(ordem).getByRole('radio', { name: 'Maiores notas' })).toBeChecked();
  });

  it('a ordem padrão escolhida na URL vai para a API', async () => {
    const { api } = await abrirLogado('/explorar?busca=fri&ordem=nota_media', { rotas: rotas() });

    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ busca: 'fri', ordem: 'nota_media' }));
  });

  it('Limpar filtros volta ao padrão e mantém a busca', async () => {
    const { user, historico } = await abrirLogado('/explorar?busca=fri&genero=Drama&ordem=titulo', { rotas: rotas() });

    await user.click(await screen.findByRole('button', { name: 'Limpar filtros (2)' }));

    await waitFor(() => expect(naUrl(historico)).toEqual({ busca: 'fri' }));
    const ordem = screen.getByRole('group', { name: 'Ordem' });
    expect(within(ordem).queryByRole('radio', { checked: true })).not.toBeInTheDocument();
  });

  it('erro da API aparece com "Tentar de novo"', async () => {
    let falhar = true;
    const { user } = await abrirLogado('/explorar', {
      rotas: rotas(() => (falhar ? erro(400, 'dados_invalidos', 'Filtro inválido.') : pagina([midia('MID-1', 'Frieren')]))),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Filtro inválido.');
    falhar = false;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('link', { name: /Frieren/ })).toBeInTheDocument();
  });

  it('abaixo de 1024px, os filtros ficam num painel aberto pelo botão Filtros', async () => {
    simularLargura(800);
    const { api, user } = await abrirLogado('/explorar?genero=Drama', { rotas: rotas() });

    expect(screen.queryByRole('region', { name: 'Gênero' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Filtros, 1 ativo' }));

    const painel = screen.getByRole('dialog', { name: 'Filtros' });
    await user.click(await within(painel).findByRole('radio', { name: 'Ação' }));

    await waitFor(() => expect(ultimaBusca(api)).toMatchObject({ genero: 'Ação' }));
    expect(screen.getByRole('searchbox', { name: 'Buscar por título' })).toBeInTheDocument();
  });
});
