import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Esquemas } from '../api/tipos';
import { abrirLogado, adminBia } from '../testes/app';
import type { Requisicao } from '../testes/fetchSimulado';

type Noticia = Esquemas['Noticia'];

function noticia(n: number, extra: Partial<Noticia> = {}): Noticia {
  return {
    id_noticia: `NOT-${n}`,
    titulo: `Notícia ${n}`,
    conteudo: `Conteúdo ${n}`,
    autor: 'Bia Admin',
    categoria: 'geral',
    data_publicacao: '2026-11-05T10:00:00',
    imagem_url: null,
    tags: [],
    ...extra,
  };
}

function pagina(itens: Noticia[], numero = 1, total = itens.length): Esquemas['PaginaNoticia'] {
  return { itens, pagina: numero, por_pagina: 10, total };
}

describe('Notícias', () => {
  it('lista as Notícias com autor, data e tags', async () => {
    await abrirLogado('/noticias', {
      rotas: {
        'GET /noticias': { status: 200, corpo: pagina([noticia(1, { tags: ['anime', 'temporada'] })]) },
      },
    });

    const artigo = await screen.findByRole('article', { name: 'Notícia 1' });
    expect(artigo).toHaveTextContent('Por Bia Admin · 05/11/2026');
    expect(artigo).toHaveTextContent('Conteúdo 1');
    expect(artigo).toHaveTextContent('anime');
    expect(artigo).toHaveTextContent('temporada');
  });

  it('sem Notícias, avisa', async () => {
    await abrirLogado('/noticias', { rotas: { 'GET /noticias': { status: 200, corpo: pagina([]) } } });

    expect(await screen.findByText('Nenhuma notícia disponível no momento.')).toBeInTheDocument();
  });

  it('pagina pelo total da resposta', async () => {
    const responder = (req: Requisicao) => {
      const numero = Number(req.query.get('pagina') ?? 1);
      return { status: 200, corpo: pagina([noticia(numero * 100)], numero, 25) };
    };
    const { user, api } = await abrirLogado('/noticias', { rotas: { 'GET /noticias': responder } });

    expect(await screen.findByRole('article', { name: 'Notícia 100' })).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Próxima página' }));

    expect(await screen.findByRole('article', { name: 'Notícia 200' })).toBeInTheDocument();
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
    expect(api.para('GET /noticias').at(-1)?.query.get('pagina')).toBe('2');
  });

  it('Usuário comum não vê Criar notícia', async () => {
    await abrirLogado('/noticias', { rotas: { 'GET /noticias': { status: 200, corpo: pagina([noticia(1)]) } } });

    await screen.findByRole('article', { name: 'Notícia 1' });
    expect(screen.queryByRole('button', { name: 'Criar notícia' })).not.toBeInTheDocument();
  });

  it('admin publica uma Notícia e a lista recarrega', async () => {
    const publicadas: Noticia[] = [];
    const { user, api } = await abrirLogado('/noticias', {
      usuario: adminBia,
      rotas: {
        'GET /noticias': () => ({ status: 200, corpo: pagina(publicadas) }),
        'POST /noticias': (req) => {
          publicadas.unshift(noticia(9, { titulo: req.corpo.titulo, tags: req.corpo.tags }));
          return { status: 201, corpo: { id_noticia: 'NOT-9', mensagem: 'Notícia criada' } };
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Criar notícia' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nova notícia' });
    await user.type(within(dialogo).getByLabelText('Título'), 'Temporada nova');
    await user.type(within(dialogo).getByLabelText('Conteúdo'), 'Começa em janeiro.');
    await user.click(within(dialogo).getByRole('radio', { name: 'Evento' }));
    await user.type(within(dialogo).getByLabelText('Tags'), 'anime, ação , ');
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByRole('article', { name: 'Temporada nova' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.para('POST /noticias')[0]?.corpo).toEqual({
      titulo: 'Temporada nova',
      conteudo: 'Começa em janeiro.',
      categoria: 'evento',
      tags: ['anime', 'ação'],
      imagem_url: null,
    });
  });

  it('erro de validação da API aparece no campo', async () => {
    const { user } = await abrirLogado('/noticias', {
      usuario: adminBia,
      rotas: {
        'GET /noticias': { status: 200, corpo: pagina([]) },
        'POST /noticias': {
          status: 400,
          corpo: { erro: 'Dados inválidos', codigo: 'dados_invalidos', detalhes: { imagem_url: 'URL inválida' } },
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Criar notícia' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nova notícia' });
    await user.type(within(dialogo).getByLabelText('Título'), 'Com imagem');
    await user.type(within(dialogo).getByLabelText('URL da imagem'), 'nada');
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }));

    expect(await within(dialogo).findByText('URL inválida')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('URL da imagem')).toHaveAttribute('aria-invalid', 'true');
  });

  it('não publica sem título', async () => {
    const { user, api } = await abrirLogado('/noticias', {
      usuario: adminBia,
      rotas: { 'GET /noticias': { status: 200, corpo: pagina([]) } },
    });

    await user.click(await screen.findByRole('button', { name: 'Criar notícia' }));
    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(screen.getByText('Informe o título.')).toBeInTheDocument();
    expect(api.para('POST /noticias')).toHaveLength(0);
  });
});
