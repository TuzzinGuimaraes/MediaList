import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Esquemas } from '../api/tipos';
import { abrirLogado, usuarioAna } from '../testes/app';
import type { Rotas } from '../testes/fetchSimulado';

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
    titulo_portugues: null,
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
    await screen.findByRole('tablist');
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
