import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Esquemas } from '../api/tipos';
import { abrirLogado, adminBia } from '../testes/app';
import { erro, type Requisicao, type Rotas } from '../testes/fetchSimulado';

type UsuarioModeracao = Esquemas['UsuarioModeracao'];
type AvaliacaoModeracao = Esquemas['AvaliacaoModeracao'];

function usuario(id: string, nome: string, extra: Partial<UsuarioModeracao> = {}): UsuarioModeracao {
  return {
    id_usuario: id,
    nome_completo: nome,
    email: `${id}@exemplo.com`,
    ativo: true,
    nivel_acesso: 'usuario',
    data_cadastro: '2026-01-10T10:00:00',
    ultimo_acesso: null,
    total_midias: 3,
    total_avaliacoes: 1,
    ...extra,
  };
}

function avaliacao(id: string, extra: Partial<AvaliacaoModeracao> = {}): AvaliacaoModeracao {
  return {
    id_avaliacao: id,
    id_midia: 'MID-1',
    id_usuario: 'USR-ana',
    nome_completo: 'Ana Souza',
    nota: 8,
    titulo_avaliacao: 'Muito bom',
    texto_avaliacao: 'Gostei do final.',
    tipo: 'anime',
    titulo_original: 'Shingeki no Kyojin',
    titulo_portugues: 'Ataque dos Titãs',
    data_avaliacao: '2026-11-01T10:00:00',
    data_edicao: null,
    ...extra,
  };
}

function paginaDeUsuarios(itens: UsuarioModeracao[], pagina = 1, total = itens.length): Esquemas['PaginaUsuarioModeracao'] {
  return { itens, pagina, por_pagina: 20, total };
}

function abrirAdmin(rotas: Rotas) {
  return abrirLogado('/admin', { usuario: adminBia, rotas });
}

describe('Administração: Usuários', () => {
  it('lista os Usuários com Nível de acesso e totais', async () => {
    await abrirAdmin({
      'GET /moderacao/usuarios': { status: 200, corpo: paginaDeUsuarios([usuario('USR-ana', 'Ana Souza')]) },
    });

    const linha = await screen.findByRole('listitem', { name: 'Ana Souza' });
    expect(linha).toHaveTextContent('USR-ana@exemplo.com');
    expect(linha).toHaveTextContent('Usuário');
    expect(linha).toHaveTextContent('3 Mídias');
    expect(linha).toHaveTextContent('1 Avaliação');
  });

  it('desativa um Usuário ativo e a lista mostra o novo estado', async () => {
    let ativo = true;
    const { user, api } = await abrirAdmin({
      'GET /moderacao/usuarios': () => ({ status: 200, corpo: paginaDeUsuarios([usuario('USR-ana', 'Ana Souza', { ativo })]) }),
      'PUT /moderacao/usuarios/USR-ana/desativar': () => {
        ativo = false;
        return { status: 200, corpo: { mensagem: 'Usuário desativado' } };
      },
    });

    const linha = await screen.findByRole('listitem', { name: 'Ana Souza' });
    await user.click(within(linha).getByRole('button', { name: 'Desativar' }));

    expect(await within(linha).findByRole('button', { name: 'Ativar' })).toBeInTheDocument();
    expect(within(linha).getByText('Inativo')).toBeInTheDocument();
    expect(api.para('PUT /moderacao/usuarios/USR-ana/desativar')).toHaveLength(1);
  });

  it('ativa um Usuário inativo', async () => {
    const { user, api } = await abrirAdmin({
      'GET /moderacao/usuarios': { status: 200, corpo: paginaDeUsuarios([usuario('USR-ana', 'Ana Souza', { ativo: false })]) },
      'PUT /moderacao/usuarios/USR-ana/ativar': { status: 200, corpo: { mensagem: 'Usuário ativado' } },
    });

    const linha = await screen.findByRole('listitem', { name: 'Ana Souza' });
    await user.click(within(linha).getByRole('button', { name: 'Ativar' }));

    expect(api.para('PUT /moderacao/usuarios/USR-ana/ativar')).toHaveLength(1);
  });

  it('não oferece ativar/desativar a si mesmo nem a outro admin', async () => {
    await abrirAdmin({
      'GET /moderacao/usuarios': {
        status: 200,
        corpo: paginaDeUsuarios([
          usuario(adminBia.id, adminBia.nome, { nivel_acesso: 'admin' }),
          usuario('USR-caio', 'Caio Admin', { nivel_acesso: 'admin' }),
        ]),
      },
    });

    const bia = await screen.findByRole('listitem', { name: adminBia.nome });
    const caio = screen.getByRole('listitem', { name: 'Caio Admin' });
    expect(within(bia).queryByRole('button')).not.toBeInTheDocument();
    expect(within(caio).queryByRole('button')).not.toBeInTheDocument();
    expect(caio).toHaveTextContent('Administrador');
  });

  it('erro ao desativar aparece na tela', async () => {
    const { user } = await abrirAdmin({
      'GET /moderacao/usuarios': { status: 200, corpo: paginaDeUsuarios([usuario('USR-ana', 'Ana Souza')]) },
      'PUT /moderacao/usuarios/USR-ana/desativar': erro(403, 'acesso_negado', 'Você não pode desativar este Usuário.'),
    });

    const linha = await screen.findByRole('listitem', { name: 'Ana Souza' });
    await user.click(within(linha).getByRole('button', { name: 'Desativar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você não pode desativar este Usuário.');
  });

  it('pagina os Usuários pelo total', async () => {
    const responder = (req: Requisicao) => {
      const pagina = Number(req.query.get('pagina') ?? 1);
      return { status: 200, corpo: paginaDeUsuarios([usuario(`USR-${pagina}`, `Usuário ${pagina}`)], pagina, 45) };
    };
    const { user } = await abrirAdmin({ 'GET /moderacao/usuarios': responder });

    await screen.findByRole('listitem', { name: 'Usuário 1' });
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));

    expect(await screen.findByRole('listitem', { name: 'Usuário 2' })).toBeInTheDocument();
  });
});

describe('Administração: Avaliações', () => {
  it('lista as Avaliações recentes com autor, Mídia e nota', async () => {
    const { user } = await abrirAdmin({
      'GET /moderacao/usuarios': { status: 200, corpo: paginaDeUsuarios([]) },
      'GET /moderacao/avaliacoes': { status: 200, corpo: { avaliacoes: [avaliacao('AVA-1')] } },
    });

    await user.click(await screen.findByRole('tab', { name: 'Avaliações' }));

    const linha = await screen.findByRole('listitem', { name: 'Muito bom' });
    expect(linha).toHaveTextContent('Ana Souza');
    expect(linha).toHaveTextContent('Ataque dos Titãs');
    expect(linha).toHaveTextContent('Anime');
    expect(linha).toHaveTextContent('8');
    expect(linha).toHaveTextContent('Gostei do final.');
  });

  it('exclui uma Avaliação depois de confirmar', async () => {
    let avaliacoes = [avaliacao('AVA-1'), avaliacao('AVA-2', { titulo_avaliacao: 'Fraco' })];
    const { user, api } = await abrirAdmin({
      'GET /moderacao/usuarios': { status: 200, corpo: paginaDeUsuarios([]) },
      'GET /moderacao/avaliacoes': () => ({ status: 200, corpo: { avaliacoes } }),
      'DELETE /avaliacoes/AVA-2': () => {
        avaliacoes = avaliacoes.filter((a) => a.id_avaliacao !== 'AVA-2');
        return { status: 200, corpo: { mensagem: 'Avaliação deletada' } };
      },
    });

    await user.click(await screen.findByRole('tab', { name: 'Avaliações' }));
    const linha = await screen.findByRole('listitem', { name: 'Fraco' });
    await user.click(within(linha).getByRole('button', { name: 'Excluir' }));
    const dialogo = screen.getByRole('dialog', { name: 'Excluir Avaliação' });
    await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }));

    await screen.findByRole('listitem', { name: 'Muito bom' });
    expect(screen.queryByRole('listitem', { name: 'Fraco' })).not.toBeInTheDocument();
    expect(api.para('DELETE /avaliacoes/AVA-2')).toHaveLength(1);
  });

  it('cancelar a confirmação não exclui', async () => {
    const { user, api } = await abrirAdmin({
      'GET /moderacao/usuarios': { status: 200, corpo: paginaDeUsuarios([]) },
      'GET /moderacao/avaliacoes': { status: 200, corpo: { avaliacoes: [avaliacao('AVA-1')] } },
    });

    await user.click(await screen.findByRole('tab', { name: 'Avaliações' }));
    const linha = await screen.findByRole('listitem', { name: 'Muito bom' });
    await user.click(within(linha).getByRole('button', { name: 'Excluir' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.para('DELETE /avaliacoes/AVA-1')).toHaveLength(0);
  });
});
