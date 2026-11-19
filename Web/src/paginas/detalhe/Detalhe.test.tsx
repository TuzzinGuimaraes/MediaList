import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Esquemas } from '../../api/tipos';
import { abrirLogado, usuarioAna } from '../../testes/app';
import { erro, type Requisicao, type Rotas } from '../../testes/fetchSimulado';

type MidiaDetalhe = Esquemas['MidiaDetalhe'];
type Avaliacao = Esquemas['AvaliacaoDaMidia'];

const ID = 'MID-frieren';

function midia(parcial: Partial<MidiaDetalhe> = {}): MidiaDetalhe {
  return {
    id_midia: ID,
    tipo: 'anime',
    titulo_portugues: 'Frieren e a Jornada para o Além',
    titulo_original: 'Sousou no Frieren',
    titulo_ingles: "Frieren: Beyond Journey's End",
    sinopse: 'A maga elfa Frieren revisita a jornada.',
    poster_url: 'https://img/poster.jpg',
    banner_url: 'https://img/banner.jpg',
    data_lancamento: '2023-09-29',
    generos: 'Aventura, Drama',
    generos_lista: ['Aventura', 'Drama'],
    nota_media: 8.7,
    nota_fonte: 9.1,
    origem_nota: 'AniList',
    total_avaliacoes: 25,
    total_usuarios: 40,
    total_concluidos: 12,
    numero_episodios: 28,
    duracao_episodio: 24,
    estudio: 'Madhouse',
    status_anime: 'em_exibicao',
    status_manga: null,
    status_jogo: null,
    status_catalogo: 'em_exibicao',
    numero_capitulos: null,
    numero_volumes: null,
    autor: null,
    artista: null,
    demografia: null,
    revista: null,
    publicadora_original: null,
    plataformas: null,
    desenvolvedor: null,
    publicadora: null,
    modo_jogo: null,
    classificacao: null,
    classificacao_etaria: null,
    fonte_original: null,
    trailer_url: null,
    atualizacoes: [],
    ...parcial,
  };
}

function avaliacao(parcial: Partial<Avaliacao> = {}): Avaliacao {
  return {
    id_avaliacao: 'AVA-1',
    id_midia: ID,
    id_usuario: 'USR-caio',
    nome_completo: 'Caio Lima',
    foto_perfil: null,
    nota: 9,
    titulo_avaliacao: 'Obra-prima',
    texto_avaliacao: 'Calmo e bonito.',
    data_avaliacao: '2026-11-01T10:00:00',
    data_edicao: null,
    ...parcial,
  };
}

const distribuicao = Array.from({ length: 10 }, (_, i) => ({ nota: i + 1, total: i + 1 === 8 ? 3 : 0 }));

/** Item da Lista com o que o detalhe lê; o resto do ItemLista não importa aqui. */
const itemAssistindo = {
  id_lista: 'LST-1',
  id_midia: ID,
  tipo: 'anime',
  status_consumo: 'assistindo',
  progresso_atual: 7,
  progresso_total: null,
  numero_episodios: 28,
  numero_capitulos: null,
} as unknown as Esquemas['ItemLista'];

function rotas({
  detalhe = midia(),
  lista = [] as Esquemas['ItemLista'][],
  avaliacoes = [avaliacao()],
  minha = null as Avaliacao | null,
}: { detalhe?: MidiaDetalhe; lista?: Esquemas['ItemLista'][]; avaliacoes?: Avaliacao[]; minha?: Avaliacao | null } = {}): Rotas {
  return {
    [`GET /midias/${ID}`]: { status: 200, corpo: detalhe },
    'GET /lista': { status: 200, corpo: { lista } },
    [`GET /midias/${ID}/notas`]: { status: 200, corpo: { distribuicao, minha_avaliacao: minha } },
    [`GET /avaliacoes/${ID}`]: {
      status: 200,
      corpo: { itens: avaliacoes, pagina: 1, por_pagina: 20, total: 25 },
    },
    [`GET /midias/${ID}/atividade`]: {
      status: 200,
      corpo: {
        inicio: '2025-11-21',
        fim: '2026-11-19',
        dias: [
          { data: '2026-11-02', total: 5 },
          { data: '2026-11-19', total: 2 },
        ],
      },
    },
  };
}

describe('Detalhe da Mídia', () => {
  it('mostra o título, o alternativo, a sinopse e a ficha do Tipo', async () => {
    await abrirLogado(`/midia/${ID}`, { rotas: rotas() });

    expect(await screen.findByRole('heading', { level: 1, name: 'Frieren e a Jornada para o Além' })).toBeInTheDocument();
    expect(screen.getByText('Sousou no Frieren')).toBeInTheDocument();
    expect(screen.getByText('A maga elfa Frieren revisita a jornada.')).toBeInTheDocument();
    const ficha = screen.getByLabelText('Ficha');
    expect(within(ficha).getByText('Episódios').nextSibling).toHaveTextContent('28');
    expect(within(ficha).getByText('Situação').nextSibling).toHaveTextContent('Em exibição');
    expect(within(ficha).getByText('Estúdio').nextSibling).toHaveTextContent('Madhouse');
    expect(within(ficha).getByText('Lançamento').nextSibling).toHaveTextContent('29/09/2023');
    expect(screen.getByLabelText('Nota dos Usuários: 8.7')).toBeInTheDocument();
  });

  it('fora da Lista, o botão é Adicionar e abre o editor do Item', async () => {
    const { user } = await abrirLogado(`/midia/${ID}`, { rotas: rotas() });

    await user.click(await screen.findByRole('button', { name: 'Adicionar à Lista' }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('na Lista, o botão é Editar e a ficha traz o Status e o Progresso', async () => {
    await abrirLogado(`/midia/${ID}`, { rotas: rotas({ lista: [itemAssistindo] }) });

    expect(await screen.findByRole('button', { name: 'Editar na Lista' })).toBeInTheDocument();
    const ficha = screen.getByLabelText('Ficha');
    expect(within(ficha).getByText('Status').nextSibling).toHaveTextContent('Em progresso');
    expect(within(ficha).getByText('Progresso').nextSibling).toHaveTextContent('7 de 28');
  });

  it('lista as Atualizações de mídia', async () => {
    const detalhe = midia({
      atualizacoes: [
        {
          id_midia: ID,
          tipo_midia: 'anime',
          tipo_atualizacao: 'novo_episodio',
          titulo: 'Episódio 29 no ar',
          descricao: 'A 2ª temporada começou.',
          data_atualizacao: '2026-11-10T12:00:00',
          dados_adicionais: {},
        },
      ],
    });
    await abrirLogado(`/midia/${ID}`, { rotas: rotas({ detalhe }) });

    const secao = await screen.findByRole('region', { name: 'Atualizações' });
    expect(within(secao).getByText('Episódio 29 no ar')).toBeInTheDocument();
    expect(within(secao).getByText('10/11/2026')).toBeInTheDocument();
  });

  it('mostra a distribuição das notas', async () => {
    await abrirLogado(`/midia/${ID}`, { rotas: rotas() });

    expect(await screen.findByLabelText('Nota 8: 3 avaliações')).toBeInTheDocument();
    expect(screen.getByLabelText('Nota 7: 0 avaliações')).toBeInTheDocument();
  });

  it('mostra o mapa de atividade com o total do último ano', async () => {
    await abrirLogado(`/midia/${ID}`, { rotas: rotas() });

    const secao = await screen.findByRole('region', { name: /Atividade/ });
    expect(await within(secao).findByText('7 no último ano')).toBeInTheDocument();
    expect(within(secao).getByRole('img', { name: /7 atividades nas últimas 52 semanas/ })).toBeInTheDocument();
  });

  it('mostra a 1ª página das Avaliações com o total', async () => {
    await abrirLogado(`/midia/${ID}`, { rotas: rotas() });

    const secao = await screen.findByRole('region', { name: /Avaliações/ });
    expect(await within(secao).findByRole('heading', { name: 'Avaliações · 25' })).toBeInTheDocument();
    const caio = await within(secao).findByRole('article', { name: 'Avaliação de Caio Lima' });
    expect(within(caio).getByText('Obra-prima')).toBeInTheDocument();
    expect(within(caio).getByLabelText('Nota 9')).toBeInTheDocument();
  });

  it('escreve uma Avaliação', async () => {
    const r = rotas();
    r['POST /avaliacoes'] = {
      status: 201,
      corpo: { id_avaliacao: 'AVA-9', mensagem: 'ok', nota_media_atualizada: 8.7, total_avaliacoes: 26 },
    };
    const { user, api } = await abrirLogado(`/midia/${ID}`, { rotas: r });

    await user.click(await screen.findByRole('button', { name: 'Escrever Avaliação' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Escrever Avaliação' });
    await user.type(within(dialogo).getByLabelText('Nota (0 a 10)'), '8,5');
    await user.type(within(dialogo).getByLabelText('Título'), '  Lindo ');
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }));

    await screen.findByRole('button', { name: 'Escrever Avaliação' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.para('POST /avaliacoes').map((c: Requisicao) => c.corpo)).toEqual([
      { id_midia: ID, nota: 8.5, titulo_avaliacao: 'Lindo', texto_avaliacao: null },
    ]);
    // A página e a Mídia (Nota média, total) são buscadas de novo.
    expect(api.para(`GET /avaliacoes/${ID}`).length).toBeGreaterThan(1);
    expect(api.para(`GET /midias/${ID}`).length).toBeGreaterThan(1);
  });

  it('recusa nota fora da escala sem chamar a API', async () => {
    const { user, api } = await abrirLogado(`/midia/${ID}`, { rotas: rotas() });

    await user.click(await screen.findByRole('button', { name: 'Escrever Avaliação' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Escrever Avaliação' });
    await user.type(within(dialogo).getByLabelText('Nota (0 a 10)'), '11');
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }));

    expect(within(dialogo).getByRole('alert')).toHaveTextContent('A nota vai de 0 a 10');
    expect(api.para('POST /avaliacoes')).toHaveLength(0);
  });

  it('mostra o erro da API ao publicar e mantém o formulário', async () => {
    const r = rotas();
    r['POST /avaliacoes'] = erro(409, 'conflito', 'Você já avaliou esta mídia.');
    const { user } = await abrirLogado(`/midia/${ID}`, { rotas: r });

    await user.click(await screen.findByRole('button', { name: 'Escrever Avaliação' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Escrever Avaliação' });
    await user.type(within(dialogo).getByLabelText('Nota (0 a 10)'), '7');
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Você já avaliou esta mídia.');
  });

  it('edita a própria Avaliação, com os campos já preenchidos', async () => {
    const minha = avaliacao({ id_avaliacao: 'AVA-ana', id_usuario: usuarioAna.id, nome_completo: 'Ana Souza', nota: 7.5 });
    const r = rotas({ minha, avaliacoes: [minha] });
    r['PUT /avaliacoes/AVA-ana'] = { status: 200, corpo: { mensagem: 'ok' } };
    const { user, api } = await abrirLogado(`/midia/${ID}`, { rotas: r });

    await user.click(await screen.findByRole('button', { name: 'Editar minha Avaliação' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar Avaliação' });
    const nota = within(dialogo).getByLabelText('Nota (0 a 10)');
    expect(nota).toHaveValue('7.5');
    await user.clear(nota);
    await user.type(nota, '8');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await screen.findByRole('button', { name: 'Editar minha Avaliação' });
    expect(api.para('PUT /avaliacoes/AVA-ana').map((c: Requisicao) => c.corpo)).toEqual([
      { nota: 8, titulo_avaliacao: 'Obra-prima', texto_avaliacao: 'Calmo e bonito.' },
    ]);
  });

  it('exclui a própria Avaliação depois de confirmar', async () => {
    const minha = avaliacao({ id_avaliacao: 'AVA-ana', id_usuario: usuarioAna.id, nome_completo: 'Ana Souza' });
    const r = rotas({ minha, avaliacoes: [minha] });
    let apagada = false;
    r['DELETE /avaliacoes/AVA-ana'] = () => {
      apagada = true;
      return { status: 200, corpo: { mensagem: 'ok' } };
    };
    r[`GET /midias/${ID}/notas`] = () => ({
      status: 200,
      corpo: { distribuicao, minha_avaliacao: apagada ? null : minha },
    });
    const { user, api } = await abrirLogado(`/midia/${ID}`, { rotas: r });

    await user.click(await screen.findByRole('button', { name: 'Excluir minha Avaliação' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Excluir Avaliação' });
    await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findByRole('button', { name: 'Escrever Avaliação' })).toBeInTheDocument();
    expect(api.para('DELETE /avaliacoes/AVA-ana')).toHaveLength(1);
  });

  it('Mídia que não existe mostra o erro da API', async () => {
    await abrirLogado(`/midia/${ID}`, {
      rotas: { ...rotas(), [`GET /midias/${ID}`]: erro(404, 'nao_encontrado', 'Mídia não encontrada.') },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Mídia não encontrada.');
  });
});
