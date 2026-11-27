import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Esquemas } from '../api/tipos';
import { abrirLogado, usuarioAna } from '../testes/app';
import { erro, type Rotas } from '../testes/fetchSimulado';

type ItemLista = Esquemas['ItemLista'];
type Notificacao = Esquemas['Notificacao'];

const perfil: Esquemas['Perfil'] = {
  id_usuario: usuarioAna.id,
  nome_completo: usuarioAna.nome,
  email: usuarioAna.email,
  nivel_acesso: 'usuario',
  data_cadastro: '2025-03-02T12:00:00',
  biografia: null,
  foto_perfil: null,
  nota_media_usuario: 7.25,
  total_midias: 5,
  total_animes: 3,
  total_mangas: 1,
  total_jogos: 1,
  total_favoritos: 2,
};

const estatisticas: Esquemas['RespostaEstatisticas'] = {
  resumo: { total_midias: 5, concluidos: 3, em_andamento: 1, favoritos: 2 },
  estatisticas: [
    { tipo: 'anime', total_midias: 3, concluidos: 2, em_andamento: 1, favoritos: 1, nota_media: 8, progresso_total_consumido: 48 },
    { tipo: 'manga', total_midias: 1, concluidos: 0, em_andamento: 0, favoritos: 1, nota_media: null, progresso_total_consumido: 0 },
    { tipo: 'jogo', total_midias: 1, concluidos: 1, em_andamento: 0, favoritos: 0, nota_media: 9, progresso_total_consumido: 30 },
  ],
};

let seq = 0;
function item(extra: Partial<ItemLista>): ItemLista {
  seq += 1;
  return {
    id_lista: `LIS-${seq}`,
    id_midia: `MID-${seq}`,
    tipo: 'anime',
    titulo_original: `Obra ${seq}`,
    titulo_romaji: null,
    titulo_ingles: null,
    status_consumo: 'planejado',
    nota_usuario: null,
    favorito: false,
    privado: false,
    progresso_atual: null,
    progresso_total: null,
    comentario: null,
    data_adicao: '2026-01-01T00:00:00',
    data_atualizacao: '2026-01-01T00:00:00',
    data_inicio: null,
    data_conclusao: null,
    data_lancamento: null,
    generos: null,
    generos_lista: [],
    plataformas: null,
    poster_url: null,
    banner_url: null,
    sinopse: null,
    autor: null,
    desenvolvedor: null,
    estudio: null,
    publicadora: null,
    fonte_original: null,
    demografia: null,
    modo_jogo: null,
    numero_capitulos: null,
    numero_episodios: null,
    episodios_lancados: null,
    proximo_episodio_em: null,
    numero_volumes: null,
    nota_fonte: null,
    nota_media: null,
    origem_nota: null,
    status_anime: null,
    status_manga: null,
    status_jogo: null,
    status_catalogo: null,
    total_avaliacoes: null,
    total_concluidos: 0,
    total_rewatches: 0,
    total_usuarios: 1,
    ...extra,
  };
}

const lista: ItemLista[] = [
  item({ titulo_original: 'Frieren', status_consumo: 'completo', nota_usuario: 9, favorito: true, generos_lista: ['Aventura', 'Fantasia'] }),
  item({ status_consumo: 'completo', nota_usuario: 8.6, generos_lista: ['Fantasia'] }),
  item({ status_consumo: 'assistindo', generos_lista: ['Ação'] }),
  item({ tipo: 'manga', titulo_original: 'Berserk', status_consumo: 'lido', favorito: true, generos_lista: ['Seinen'] }),
  item({ tipo: 'jogo', titulo_original: 'Hades', status_consumo: 'platinado', nota_usuario: 9, favorito: true, plataformas: 'PC, Switch' }),
];

function notificacao(titulo: string, lida: boolean): Notificacao {
  return {
    origem: 'atualizacao',
    id_noticia: null,
    titulo,
    mensagem: `Mensagem de ${titulo}`,
    lida,
    id_midia: 'MID-1',
    midia_nome: 'Frieren',
    tipo: 'episodio',
    tipo_midia: 'anime',
    data_criacao: '2026-11-04T09:00:00',
  };
}

function rotasDoPerfil(extra: Rotas = {}): Rotas {
  return {
    'GET /usuario/perfil': { status: 200, corpo: { perfil } },
    'GET /usuario/estatisticas': { status: 200, corpo: estatisticas },
    'GET /lista': { status: 200, corpo: { lista } },
    'GET /notificacoes': { status: 200, corpo: { notificacoes: [] } },
    'GET /integracoes': { status: 200, corpo: { integracoes: [] } },
    ...extra,
  };
}

const secao = (nome: string) => screen.findByRole('region', { name: nome });

describe('Perfil', () => {
  it('mostra os dados da conta', async () => {
    await abrirLogado('/perfil', { rotas: rotasDoPerfil() });

    expect(await screen.findByRole('heading', { name: 'Ana Souza', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('ana@exemplo.com')).toBeInTheDocument();
    expect(screen.getByText('Membro desde 02/03/2025')).toBeInTheDocument();
    expect(screen.getByText('Usuário')).toBeInTheDocument();
  });

  it('resume a Lista com totais e a média das Notas pessoais', async () => {
    await abrirLogado('/perfil', { rotas: rotasDoPerfil() });

    const resumo = await secao('Resumo');
    expect(within(resumo).getByRole('listitem', { name: 'Na Lista: 5' })).toBeInTheDocument();
    expect(within(resumo).getByRole('listitem', { name: 'Concluídos: 3' })).toBeInTheDocument();
    expect(within(resumo).getByRole('listitem', { name: 'Em progresso: 1' })).toBeInTheDocument();
    expect(within(resumo).getByRole('listitem', { name: 'Favoritos: 2' })).toBeInTheDocument();
    expect(within(resumo).getByRole('listitem', { name: 'Média das notas pessoais: 7,3' })).toBeInTheDocument();
  });

  it('as estatísticas mostram o Tipo escolhido do catálogo: Status, notas e Gêneros', async () => {
    const { user } = await abrirLogado('/perfil', { rotas: rotasDoPerfil() });

    const stats = await secao('Estatísticas');
    expect(await within(stats).findByRole('listitem', { name: 'Concluído: 2' })).toBeInTheDocument();
    expect(within(stats).getByRole('listitem', { name: 'Em progresso: 1' })).toBeInTheDocument();
    expect(within(stats).getByRole('listitem', { name: 'Nota 9: 2' })).toBeInTheDocument();
    expect(within(stats).getByRole('listitem', { name: 'Fantasia: 2' })).toBeInTheDocument();
    expect(within(stats).getByText('48')).toBeInTheDocument();

    await user.click(within(stats).getByRole('radio', { name: 'Mangá' }));

    expect(within(stats).getByRole('listitem', { name: 'Concluído: 1' })).toBeInTheDocument();
    expect(within(stats).getByRole('listitem', { name: 'Seinen: 1' })).toBeInTheDocument();
    expect(within(stats).queryByRole('listitem', { name: 'Fantasia: 2' })).not.toBeInTheDocument();
  });

  it('nos Jogos, o Platinado conta em Concluído e as plataformas aparecem', async () => {
    localStorage.setItem('medialist.catalogo', 'jogos');
    await abrirLogado('/perfil', { rotas: rotasDoPerfil() });

    const stats = await secao('Estatísticas');
    expect(await within(stats).findByRole('listitem', { name: 'Concluído: 1' })).toBeInTheDocument();
    expect(within(stats).getByRole('listitem', { name: 'Platinado: 1' })).toBeInTheDocument();
    expect(within(stats).getByRole('listitem', { name: 'PC: 1' })).toBeInTheDocument();
    expect(within(stats).getByRole('listitem', { name: 'Switch: 1' })).toBeInTheDocument();
    expect(within(stats).queryByRole('radio')).not.toBeInTheDocument();
  });

  it('mostra os favoritos do catálogo', async () => {
    await abrirLogado('/perfil', { rotas: rotasDoPerfil() });

    const favoritos = await secao('Favoritos');
    expect(await within(favoritos).findByRole('link', { name: /Frieren/ })).toHaveAttribute('href', `/midia/${lista[0]!.id_midia}`);
    expect(within(favoritos).getByRole('link', { name: /Berserk/ })).toBeInTheDocument();
    expect(within(favoritos).queryByRole('link', { name: /Hades/ })).not.toBeInTheDocument();
  });

  it('usa a Lista pessoal do cache da Lista, sem buscá-la de novo', async () => {
    const { api, historico } = await abrirLogado('/lista', { rotas: rotasDoPerfil() });
    await screen.findByRole('navigation', { name: 'Status' });
    expect(api.para('GET /lista')).toHaveLength(1);

    historico.push('/perfil');

    expect(await within(await secao('Favoritos')).findByRole('link', { name: /Frieren/ })).toBeInTheDocument();
    expect(api.para('GET /lista')).toHaveLength(1);
  });

  it('o seletor de tema fica no Perfil', async () => {
    await abrirLogado('/perfil', { rotas: rotasDoPerfil() });

    expect(within(await secao('Aparência')).getByRole('radio', { name: 'Escuro' })).toBeChecked();
  });
});

describe('Perfil: Notificações', () => {
  it('lista as Notificações e marca as não lidas', async () => {
    await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /notificacoes': { status: 200, corpo: { notificacoes: [notificacao('Episódio 12', false), notificacao('Episódio 11', true)] } },
      }),
    });

    const notificacoes = await secao('Notificações');
    const nova = await within(notificacoes).findByRole('listitem', { name: /Episódio 12/ });
    expect(nova).toHaveTextContent('Frieren · 04/11/2026');
    expect(nova).toHaveTextContent('Mensagem de Episódio 12');
    expect(within(nova).getByText('Não lida')).toBeInTheDocument();
    expect(within(within(notificacoes).getByRole('listitem', { name: /Episódio 11/ })).queryByText('Não lida')).not.toBeInTheDocument();
  });

  it('marca todas como lidas', async () => {
    let lida = false;
    const { user, api } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /notificacoes': () => ({ status: 200, corpo: { notificacoes: [notificacao('Episódio 12', lida)] } }),
        'PUT /notificacoes/marcar-todas-lidas': () => {
          lida = true;
          return { status: 200, corpo: { mensagem: 'ok' } };
        },
      }),
    });

    const notificacoes = await secao('Notificações');
    await user.click(await within(notificacoes).findByRole('button', { name: 'Marcar todas como lidas' }));

    expect(api.para('PUT /notificacoes/marcar-todas-lidas')).toHaveLength(1);
    await waitFor(() =>
      expect(within(notificacoes).getByRole('listitem', { name: /Episódio 12/ })).not.toHaveTextContent('Não lida'),
    );
    expect(within(notificacoes).queryByRole('button', { name: 'Marcar todas como lidas' })).not.toBeInTheDocument();
  });

  it('sem Notificações, avisa', async () => {
    await abrirLogado('/perfil', { rotas: rotasDoPerfil() });

    expect(await within(await secao('Notificações')).findByText('Nenhuma notificação por aqui.')).toBeInTheDocument();
  });
});


type Integracao = Esquemas['Integracao'];

function integracao(extra: Partial<Integracao> = {}): Integracao {
  return {
    plataforma: 'anilist',
    rotulo: 'AniList',
    disponivel: true,
    conectada: false,
    identificador: null,
    nome_exibicao: null,
    ultima_sincronizacao: null,
    ultimo_resultado: null,
    ...extra,
  };
}

const conectadaAoAniList = integracao({ conectada: true, identificador: 'Ana', nome_exibicao: 'Ana' });

const previa: Esquemas['PreviaImportacao'] = {
  id_previa: 'PRV-1',
  expira_em: '2026-11-25T13:00:00+00:00',
  novos: 32,
  atualizados: 5,
  nao_encontrados: [{ titulo: 'Obra rara', link: 'https://anilist.co/anime/9' }],
  total_nao_encontrados: 3,
};

describe('Perfil: Integrações', () => {
  it('conecta o AniList pelo nome de usuário', async () => {
    let conectada = false;
    const { user, api } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': () => ({ status: 200, corpo: { integracoes: [conectada ? conectadaAoAniList : integracao()] } }),
        'PUT /integracoes/anilist': () => {
          conectada = true;
          return { status: 200, corpo: conectadaAoAniList };
        },
      }),
    });

    const anilist = within(await secao('Integrações')).getByRole('listitem', { name: 'AniList' });
    await user.type(within(anilist).getByLabelText('Nome de usuário do AniList'), ' Ana ');
    await user.click(within(anilist).getByRole('button', { name: 'Conectar' }));

    expect(api.para('PUT /integracoes/anilist')[0]?.corpo).toEqual({ identificador: 'Ana' });
    expect(await within(anilist).findByText('Ana')).toBeInTheDocument();
    expect(within(anilist).getByRole('button', { name: 'Importar' })).toBeInTheDocument();
  });

  it('perfil privado mostra a mensagem da API com o passo para torná-lo público', async () => {
    const { user } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [integracao()] } },
        'PUT /integracoes/anilist': {
          status: 400,
          corpo: { erro: 'O perfil do AniList é privado. Deixe o perfil público.', codigo: 'perfil_privado' },
        },
      }),
    });

    const anilist = within(await secao('Integrações')).getByRole('listitem', { name: 'AniList' });
    await user.type(within(anilist).getByLabelText('Nome de usuário do AniList'), 'ana');
    await user.click(within(anilist).getByRole('button', { name: 'Conectar' }));

    expect(await within(anilist).findByRole('alert')).toHaveTextContent('Deixe o perfil público');
  });

  it('importar mostra a prévia, os Não encontrados com link, e só grava ao confirmar', async () => {
    const { user, api } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [conectadaAoAniList] } },
        'POST /integracoes/anilist/previa': { status: 200, corpo: previa },
        'POST /integracoes/previas/PRV-1/confirmar': {
          status: 200,
          corpo: { novos: 32, atualizados: 5, nao_encontrados: previa.nao_encontrados, total_nao_encontrados: 3 },
        },
      }),
    });

    const anilist = within(await secao('Integrações')).getByRole('listitem', { name: 'AniList' });
    await user.click(await within(anilist).findByRole('button', { name: 'Importar' }));

    const caixa = await within(anilist).findByRole('group', { name: 'Prévia da importação' });
    expect(caixa).toHaveTextContent('32 novos · 5 atualizados · 3 não encontrados');
    expect(within(caixa).getByRole('link', { name: 'Obra rara' })).toHaveAttribute('href', 'https://anilist.co/anime/9');
    expect(within(caixa).getByText('e mais 2')).toBeInTheDocument();
    expect(api.para('POST /integracoes/previas/PRV-1/confirmar')).toHaveLength(0);

    await user.click(within(caixa).getByRole('button', { name: 'Confirmar' }));

    expect(await within(anilist).findByRole('status')).toHaveTextContent('Importado: 32 novos · 5 atualizados · 3 não encontrados');
    expect(api.para('POST /integracoes/previas/PRV-1/confirmar')).toHaveLength(1);
    await waitFor(() => expect(api.para('GET /lista').length).toBeGreaterThan(1));
  });

  it('prévia sem nada novo não oferece confirmar', async () => {
    const { user } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [conectadaAoAniList] } },
        'POST /integracoes/anilist/previa': {
          status: 200,
          corpo: { ...previa, novos: 0, atualizados: 0, nao_encontrados: [], total_nao_encontrados: 0 },
        },
      }),
    });

    const anilist = within(await secao('Integrações')).getByRole('listitem', { name: 'AniList' });
    await user.click(await within(anilist).findByRole('button', { name: 'Importar' }));

    const caixa = await within(anilist).findByRole('group', { name: 'Prévia da importação' });
    expect(caixa).toHaveTextContent('Nada novo');
    expect(within(caixa).queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
  });

  it('mostra a última importação e desconecta', async () => {
    let conectada = true;
    const { user, api } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': () => ({
          status: 200,
          corpo: {
            integracoes: [
              conectada
                ? { ...conectadaAoAniList, ultima_sincronizacao: '2026-11-24T10:00:00+00:00' }
                : integracao(),
            ],
          },
        }),
        'DELETE /integracoes/anilist': () => {
          conectada = false;
          return { status: 200, corpo: { mensagem: 'Conta desconectada' } };
        },
      }),
    });

    const anilist = within(await secao('Integrações')).getByRole('listitem', { name: 'AniList' });
    expect(await within(anilist).findByText(/última importação em 24\/11\/2026/)).toBeInTheDocument();

    await user.click(within(anilist).getByRole('button', { name: 'Desconectar' }));

    expect(api.para('DELETE /integracoes/anilist')).toHaveLength(1);
    expect(await within(anilist).findByLabelText('Nome de usuário do AniList')).toBeInTheDocument();
  });

  it('plataforma sem chave no servidor aparece indisponível', async () => {
    await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': {
          status: 200,
          corpo: { integracoes: [integracao(), integracao({ plataforma: 'steam', rotulo: 'Steam', disponivel: false })] },
        },
      }),
    });

    const steam = within(await secao('Integrações')).getByRole('listitem', { name: 'Steam' });
    expect(steam).toHaveTextContent('Indisponível no momento.');
  });

  const mal = (extra: Partial<Integracao> = {}) => integracao({ plataforma: 'mal', rotulo: 'MyAnimeList', ...extra });

  it('conecta o MyAnimeList pelo nome de usuário', async () => {
    const { user, api } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [mal()] } },
        'PUT /integracoes/mal': { status: 200, corpo: mal({ conectada: true, identificador: 'Ana', nome_exibicao: 'Ana' }) },
      }),
    });

    const item = within(await secao('Integrações')).getByRole('listitem', { name: 'MyAnimeList' });
    await user.type(within(item).getByLabelText('Nome de usuário do MyAnimeList'), 'Ana');
    await user.click(within(item).getByRole('button', { name: 'Conectar' }));

    expect(api.para('PUT /integracoes/mal')[0]?.corpo).toEqual({ identificador: 'Ana' });
  });

  it('envia o XML do MyAnimeList mesmo indisponível pela API, com prévia e confirmação', async () => {
    const { user, api } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [mal({ disponivel: false })] } },
        'POST /integracoes/mal/xml': { status: 200, corpo: previa },
        'POST /integracoes/previas/PRV-1/confirmar': {
          status: 200,
          corpo: { novos: 32, atualizados: 5, nao_encontrados: [], total_nao_encontrados: 0 },
        },
      }),
    });

    const item = within(await secao('Integrações')).getByRole('listitem', { name: 'MyAnimeList' });
    expect(item).toHaveTextContent('Indisponível no momento.');
    const enviar = within(item).getByRole('button', { name: 'Enviar XML' });
    expect(enviar).toBeDisabled();
    const arquivo = new File(['<myanimelist></myanimelist>'], 'animelist.xml', { type: 'text/xml' });
    await user.upload(within(item).getByLabelText('Arquivo XML exportado'), arquivo);
    await user.click(enviar);

    const caixa = await within(item).findByRole('group', { name: 'Prévia da importação' });
    expect(caixa).toHaveTextContent('32 novos · 5 atualizados · 3 não encontrados');
    const enviado = String(api.para('POST /integracoes/mal/xml')[0]?.corpo);
    // O File do jsdom atravessa o FormData do Node só com o tipo (sem nome nem conteúdo).
    expect(enviado).toContain('form-data; name="arquivo"');
    expect(enviado).toContain('Content-Type: text/xml');

    await user.click(within(caixa).getByRole('button', { name: 'Confirmar' }));

    expect(await within(item).findByRole('status')).toHaveTextContent('Importado: 32 novos · 5 atualizados');
    expect(api.para('POST /integracoes/previas/PRV-1/confirmar')).toHaveLength(1);
  });

  it('XML recusado mostra a mensagem da API', async () => {
    const { user } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [mal()] } },
        'POST /integracoes/mal/xml': erro(400, 'dados_invalidos', 'Arquivo inválido: envie o XML exportado do MyAnimeList.'),
      }),
    });

    const item = within(await secao('Integrações')).getByRole('listitem', { name: 'MyAnimeList' });
    await user.upload(within(item).getByLabelText('Arquivo XML exportado'), new File(['x'], 'x.xml'));
    await user.click(within(item).getByRole('button', { name: 'Enviar XML' }));

    expect(await within(item).findByRole('alert')).toHaveTextContent('Arquivo inválido');
  });

  it('o AniList não oferece o XML', async () => {
    await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({ 'GET /integracoes': { status: 200, corpo: { integracoes: [integracao()] } } }),
    });

    const anilist = within(await secao('Integrações')).getByRole('listitem', { name: 'AniList' });
    expect(within(anilist).queryByLabelText('Arquivo XML exportado')).not.toBeInTheDocument();
  });
});

describe('Perfil: Integração com a Steam', () => {
  const conectadaASteam = integracao({
    plataforma: 'steam',
    rotulo: 'Steam',
    conectada: true,
    identificador: '76561197960287930',
    nome_exibicao: 'Fulano',
  });

  it('conecta pela URL do perfil', async () => {
    const { user, api } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [integracao({ plataforma: 'steam', rotulo: 'Steam' })] } },
        'PUT /integracoes/steam': { status: 200, corpo: conectadaASteam },
      }),
    });

    const steam = within(await secao('Integrações')).getByRole('listitem', { name: 'Steam' });
    await user.type(within(steam).getByLabelText('URL do perfil da Steam'), 'steamcommunity.com/id/fulano');
    await user.click(within(steam).getByRole('button', { name: 'Conectar' }));

    expect(api.para('PUT /integracoes/steam')[0]?.corpo).toEqual({ identificador: 'steamcommunity.com/id/fulano' });
  });

  it('sincroniza sem prévia e mostra os jogos ainda em processamento', async () => {
    const { user, api } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': {
          status: 200,
          corpo: { integracoes: [{ ...conectadaASteam, ultima_sincronizacao: '2026-11-24T10:00:00+00:00' }] },
        },
        'POST /integracoes/steam/sincronizar': {
          status: 200,
          corpo: { novos: 2, atualizados: 1, nao_encontrados: [], total_nao_encontrados: 0, pendentes: 12 },
        },
      }),
    });

    const steam = within(await secao('Integrações')).getByRole('listitem', { name: 'Steam' });
    expect(await within(steam).findByText(/última sincronização em 24\/11\/2026/)).toBeInTheDocument();
    expect(within(steam).queryByRole('button', { name: 'Importar' })).not.toBeInTheDocument();

    await user.click(within(steam).getByRole('button', { name: 'Sincronizar agora' }));

    const status = await within(steam).findByRole('status');
    expect(status).toHaveTextContent('Sincronizado: 2 novos · 1 atualizado');
    expect(status).toHaveTextContent('12 jogos ainda em processamento');
    expect(api.para('POST /integracoes/steam/sincronizar')).toHaveLength(1);
    await waitFor(() => expect(api.para('GET /lista').length).toBeGreaterThan(1));
  });

  it('perfil que ficou privado mostra o passo para torná-lo público', async () => {
    const { user } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [conectadaASteam] } },
        'POST /integracoes/steam/sincronizar': {
          status: 400,
          corpo: { erro: 'O perfil da Steam é privado. Deixe "Detalhes dos jogos" como Público.', codigo: 'perfil_privado' },
        },
      }),
    });

    const steam = within(await secao('Integrações')).getByRole('listitem', { name: 'Steam' });
    await user.click(await within(steam).findByRole('button', { name: 'Sincronizar agora' }));

    expect(await within(steam).findByRole('alert')).toHaveTextContent('Detalhes dos jogos');
  });
});

describe('Perfil: Vincular Não encontrados', () => {
  const jogoRaro: Esquemas['NaoEncontrado'] = {
    titulo: 'Jogo raro',
    link: 'https://store.steampowered.com/app/123',
    origem_id: '123',
    tipo: 'jogo',
  };
  const steamComNaoEncontrado = (naoEncontrados: Esquemas['NaoEncontrado'][]) =>
    integracao({
      plataforma: 'steam',
      rotulo: 'Steam',
      conectada: true,
      identificador: '76561197960287930',
      nome_exibicao: 'Fulano',
      ultimo_resultado: { novos: 0, atualizados: 0, nao_encontrados: naoEncontrados, total_nao_encontrados: naoEncontrados.length },
    });
  const hollow = { id_midia: 'MID-9', titulo_original: 'Hollow Knight', titulo_romaji: null, tipo: 'jogo', data_lancamento: '2017-02-24' };
  const paginaDeMidias = (itens: object[]) => ({ status: 200, corpo: { itens, pagina: 1, por_pagina: 10, total: itens.length } });

  it('busca no Catálogo só no Tipo do item, vincula e o Item vai para a Lista', async () => {
    let naoEncontrados = [jogoRaro];
    const { user, api } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': () => ({ status: 200, corpo: { integracoes: [steamComNaoEncontrado(naoEncontrados)] } }),
        'GET /midias': paginaDeMidias([hollow]),
        'POST /integracoes/vinculos': () => {
          naoEncontrados = [];
          return { status: 201, corpo: { id_vinculo: 'VIN-1', id_midia: 'MID-9', novos: 1, atualizados: 0 } };
        },
      }),
    });

    const steam = within(await secao('Integrações')).getByRole('listitem', { name: 'Steam' });
    await user.click(await within(steam).findByRole('button', { name: 'Vincular Jogo raro' }));
    const dialogo = screen.getByRole('dialog', { name: 'Vincular “Jogo raro”' });
    await user.type(within(dialogo).getByRole('searchbox', { name: 'Buscar no Catálogo' }), 'hollow');

    await user.click(await within(dialogo).findByRole('button', { name: 'Vincular a Hollow Knight' }));

    const busca = api.para('GET /midias').at(-1)!.query;
    expect(Object.fromEntries(busca)).toMatchObject({ busca: 'hollow', tipo: 'jogo' });
    expect(api.para('POST /integracoes/vinculos')[0]?.corpo).toEqual({ plataforma: 'steam', origem_id: '123', id_midia: 'MID-9' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(api.para('GET /lista').length).toBeGreaterThan(1));
    await waitFor(() => expect(within(steam).queryByText('Jogo raro')).not.toBeInTheDocument());
  });

  it('vínculo recusado mostra a mensagem da API no diálogo', async () => {
    const { user } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [steamComNaoEncontrado([jogoRaro])] } },
        'GET /midias': paginaDeMidias([hollow]),
        'POST /integracoes/vinculos': erro(409, 'conflito', 'Este item já está vinculado a outra Mídia'),
      }),
    });

    const steam = within(await secao('Integrações')).getByRole('listitem', { name: 'Steam' });
    await user.click(await within(steam).findByRole('button', { name: 'Vincular Jogo raro' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('searchbox', { name: 'Buscar no Catálogo' }), 'hollow');
    await user.click(await within(dialogo).findByRole('button', { name: 'Vincular a Hollow Knight' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('já está vinculado a outra Mídia');
  });

  it('na prévia, o vinculado fica marcado', async () => {
    const naoEncontrado = { titulo: 'Obra rara', link: 'https://anilist.co/anime/9', origem_id: '9', tipo: 'anime' as const };
    const { user } = await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [conectadaAoAniList] } },
        'POST /integracoes/anilist/previa': { status: 200, corpo: { ...previa, nao_encontrados: [naoEncontrado] } },
        'GET /midias': paginaDeMidias([{ ...hollow, titulo_original: 'Frieren', tipo: 'anime' }]),
        'POST /integracoes/vinculos': { status: 201, corpo: { id_vinculo: 'VIN-1', id_midia: 'MID-9', novos: 1, atualizados: 0 } },
      }),
    });

    const anilist = within(await secao('Integrações')).getByRole('listitem', { name: 'AniList' });
    await user.click(await within(anilist).findByRole('button', { name: 'Importar' }));
    const caixa = await within(anilist).findByRole('group', { name: 'Prévia da importação' });
    await user.click(within(caixa).getByRole('button', { name: 'Vincular Obra rara' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('searchbox', { name: 'Buscar no Catálogo' }), 'fri');
    await user.click(await within(dialogo).findByRole('button', { name: 'Vincular a Frieren' }));

    expect(await within(caixa).findByText('Vinculado')).toBeInTheDocument();
    expect(within(caixa).queryByRole('button', { name: 'Vincular Obra rara' })).not.toBeInTheDocument();
  });

  it('resultado antigo, sem origem_id, não oferece Vincular', async () => {
    await abrirLogado('/perfil', {
      rotas: rotasDoPerfil({
        'GET /integracoes': {
          status: 200,
          corpo: { integracoes: [steamComNaoEncontrado([{ titulo: 'Antigo', link: null }])] },
        },
      }),
    });

    const steam = within(await secao('Integrações')).getByRole('listitem', { name: 'Steam' });
    expect(await within(steam).findByText('Antigo')).toBeInTheDocument();
    expect(within(steam).queryByRole('button', { name: /Vincular/ })).not.toBeInTheDocument();
  });
});
