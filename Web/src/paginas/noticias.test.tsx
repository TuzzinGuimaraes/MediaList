import { screen, waitFor, within } from '@testing-library/react';
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
    data_edicao: null,
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

  it('uma Notícia pelo link, com volta para todas', async () => {
    const { user, historico } = await abrirLogado('/noticias/NOT-7', {
      rotas: {
        'GET /noticias/NOT-7': { status: 200, corpo: noticia(7) },
        'GET /noticias': { status: 200, corpo: pagina([noticia(7)]) },
      },
    });

    expect(await screen.findByRole('article', { name: 'Notícia 7' })).toHaveTextContent('Conteúdo 7');
    await user.click(screen.getByRole('link', { name: 'Todas as Notícias' }));

    expect(historico.location.pathname).toBe('/noticias');
  });

  it('Notícia que não existe mostra o erro da API', async () => {
    await abrirLogado('/noticias/NOT-9', {
      rotas: {
        'GET /noticias/NOT-9': {
          status: 404,
          corpo: { erro: 'Notícia não encontrada', codigo: 'nao_encontrado' },
        },
      },
    });

    expect(await screen.findByText('Notícia não encontrada')).toBeInTheDocument();
  });

  describe('editar e excluir (admin)', () => {
    it('Usuário comum não vê Editar nem Excluir na lista', async () => {
      await abrirLogado('/noticias', { rotas: { 'GET /noticias': { status: 200, corpo: pagina([noticia(1)]) } } });
      const artigo = await screen.findByRole('article', { name: 'Notícia 1' });
      expect(within(artigo).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
      expect(within(artigo).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    });

    it('Usuário comum não vê os botões na página da Notícia', async () => {
      await abrirLogado('/noticias/NOT-7', { rotas: { 'GET /noticias/NOT-7': { status: 200, corpo: noticia(7) } } });
      const artigo = await screen.findByRole('article', { name: 'Notícia 7' });
      expect(within(artigo).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
      expect(within(artigo).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    });

    it('admin vê Editar e Excluir em cada card', async () => {
      await abrirLogado('/noticias', {
        usuario: adminBia,
        rotas: { 'GET /noticias': { status: 200, corpo: pagina([noticia(1), noticia(2)]) } },
      });
      for (const nome of ['Notícia 1', 'Notícia 2']) {
        const artigo = await screen.findByRole('article', { name: nome });
        expect(within(artigo).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
        expect(within(artigo).getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
      }
    });

    it('editar abre o formulário preenchido, salva com PUT e mostra "editada em"', async () => {
      let atual = noticia(7, {
        titulo: 'Antes',
        conteudo: 'Texto antes',
        categoria: 'evento',
        tags: ['anime', 'ação'],
        imagem_url: 'https://exemplo.test/a.png',
      });
      const { user, api } = await abrirLogado('/noticias/NOT-7', {
        usuario: adminBia,
        rotas: {
          'GET /noticias/NOT-7': () => ({ status: 200, corpo: atual }),
          'PUT /noticias/NOT-7': (req) => {
            atual = { ...atual, ...req.corpo, data_edicao: '2026-11-08T12:00:00Z' };
            return { status: 200, corpo: { mensagem: 'Notícia atualizada!' } };
          },
        },
      });

      const artigo = await screen.findByRole('article', { name: 'Antes' });
      expect(artigo).not.toHaveTextContent('editada em');
      await user.click(within(artigo).getByRole('button', { name: 'Editar' }));
      const dialogo = screen.getByRole('dialog', { name: 'Editar notícia' });
      expect(within(dialogo).getByLabelText('Título')).toHaveValue('Antes');
      expect(within(dialogo).getByLabelText('Conteúdo')).toHaveValue('Texto antes');
      expect(within(dialogo).getByRole('radio', { name: 'Evento' })).toBeChecked();
      expect(within(dialogo).getByLabelText('Tags')).toHaveValue('anime, ação');
      expect(within(dialogo).getByLabelText('URL da imagem')).toHaveValue('https://exemplo.test/a.png');

      await user.clear(within(dialogo).getByLabelText('Título'));
      await user.type(within(dialogo).getByLabelText('Título'), 'Depois');
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

      const editada = await screen.findByRole('article', { name: 'Depois' });
      expect(editada).toHaveTextContent('editada em 08/11/2026');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(api.para('POST /noticias')).toHaveLength(0);
      expect(api.para('PUT /noticias/NOT-7')[0]?.corpo).toEqual({
        titulo: 'Depois',
        conteudo: 'Texto antes',
        categoria: 'evento',
        tags: ['anime', 'ação'],
        imagem_url: 'https://exemplo.test/a.png',
      });
    });

    it('editar pela lista também vem preenchido', async () => {
      const { user } = await abrirLogado('/noticias', {
        usuario: adminBia,
        rotas: { 'GET /noticias': { status: 200, corpo: pagina([noticia(1), noticia(2)]) } },
      });

      const artigo = await screen.findByRole('article', { name: 'Notícia 2' });
      await user.click(within(artigo).getByRole('button', { name: 'Editar' }));

      const dialogo = screen.getByRole('dialog', { name: 'Editar notícia' });
      expect(within(dialogo).getByLabelText('Título')).toHaveValue('Notícia 2');
      expect(within(dialogo).getByLabelText('Conteúdo')).toHaveValue('Conteúdo 2');
    });

    it('excluir pede confirmação e cancelar não apaga', async () => {
      const { user, api } = await abrirLogado('/noticias/NOT-7', {
        usuario: adminBia,
        rotas: { 'GET /noticias/NOT-7': { status: 200, corpo: noticia(7) } },
      });

      const artigo = await screen.findByRole('article', { name: 'Notícia 7' });
      await user.click(within(artigo).getByRole('button', { name: 'Excluir' }));
      const dialogo = screen.getByRole('dialog', { name: 'Excluir notícia' });
      expect(dialogo).toHaveTextContent('Excluir a Notícia “Notícia 7”?');
      await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(api.para('DELETE /noticias/NOT-7')).toHaveLength(0);
      expect(screen.getByRole('article', { name: 'Notícia 7' })).toBeInTheDocument();
    });

    it('depois de excluir pela página da Notícia, volta para a lista', async () => {
      let restantes = [noticia(7), noticia(8)];
      const { user, api, historico } = await abrirLogado('/noticias/NOT-7', {
        usuario: adminBia,
        rotas: {
          'GET /noticias/NOT-7': { status: 200, corpo: noticia(7) },
          'GET /noticias': () => ({ status: 200, corpo: pagina(restantes) }),
          'DELETE /noticias/NOT-7': () => {
            restantes = restantes.filter((n) => n.id_noticia !== 'NOT-7');
            return { status: 200, corpo: { mensagem: 'Notícia excluída!' } };
          },
        },
      });

      const artigo = await screen.findByRole('article', { name: 'Notícia 7' });
      await user.click(within(artigo).getByRole('button', { name: 'Excluir' }));
      await user.click(within(screen.getByRole('dialog', { name: 'Excluir notícia' })).getByRole('button', { name: 'Excluir' }));

      expect(await screen.findByRole('article', { name: 'Notícia 8' })).toBeInTheDocument();
      expect(historico.location.pathname).toBe('/noticias');
      expect(screen.queryByRole('article', { name: 'Notícia 7' })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(api.para('DELETE /noticias/NOT-7')).toHaveLength(1);
      expect(api.para('GET /noticias/NOT-7')).toHaveLength(1);
    });

    it('excluir pela lista tira o card', async () => {
      let restantes = [noticia(1), noticia(2)];
      const { user } = await abrirLogado('/noticias', {
        usuario: adminBia,
        rotas: {
          'GET /noticias': () => ({ status: 200, corpo: pagina(restantes) }),
          'DELETE /noticias/NOT-1': () => {
            restantes = restantes.filter((n) => n.id_noticia !== 'NOT-1');
            return { status: 200, corpo: { mensagem: 'Notícia excluída!' } };
          },
        },
      });

      const artigo = await screen.findByRole('article', { name: 'Notícia 1' });
      await user.click(within(artigo).getByRole('button', { name: 'Excluir' }));
      await user.click(within(screen.getByRole('dialog', { name: 'Excluir notícia' })).getByRole('button', { name: 'Excluir' }));

      await waitFor(() => expect(screen.queryByRole('article', { name: 'Notícia 1' })).not.toBeInTheDocument());
      expect(screen.getByRole('article', { name: 'Notícia 2' })).toBeInTheDocument();
    });

    it('erro ao excluir fica na confirmação', async () => {
      const { user } = await abrirLogado('/noticias/NOT-7', {
        usuario: adminBia,
        rotas: {
          'GET /noticias/NOT-7': { status: 200, corpo: noticia(7) },
          'DELETE /noticias/NOT-7': { status: 404, corpo: { erro: 'Notícia não encontrada', codigo: 'nao_encontrado' } },
        },
      });

      await user.click(within(await screen.findByRole('article', { name: 'Notícia 7' })).getByRole('button', { name: 'Excluir' }));
      const dialogo = screen.getByRole('dialog', { name: 'Excluir notícia' });
      await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }));

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Notícia não encontrada');
    });
  });
});
