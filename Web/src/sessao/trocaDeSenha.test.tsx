import { screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Esquemas } from '../api/tipos';
import { erro } from '../testes/fetchSimulado';
import { abrirApp, loginOk, navPrincipal, preencherLogin, rotasDaSessao, usuarioAna } from '../testes/app';
import { marcarConectado } from './armazenamento';

const TITULO = 'Defina sua nova senha';
const TEMPORARIA = 'Tk7pQ2mX';

const loginComTemporaria = { ...loginOk(), corpo: { ...(loginOk().corpo as object), deve_trocar_senha: true } };

function meComTroca(): Esquemas['RespostaMe'] {
  return {
    usuario: { id_usuario: usuarioAna.id, nome_completo: usuarioAna.nome, email: usuarioAna.email, foto_perfil: null },
    deve_trocar_senha: true,
  };
}

const trocaOk = { status: 200, corpo: { access_token: 'A3', refresh_token: null } };

/** Entra com a Senha temporária e espera a tela de troca. */
async function entrarComTemporaria(url = '/', rotas = {}) {
  const aberto = abrirApp(url, { rotas: { 'POST /auth/login': loginComTemporaria, ...rotas } });
  await preencherLogin(aberto.user, usuarioAna.email, TEMPORARIA);
  await screen.findByRole('heading', { name: TITULO });
  return aberto;
}

async function preencherTroca(user: ReturnType<typeof userEvent.setup>, atual: string, nova: string, confirmacao = nova) {
  await user.type(screen.getByLabelText('Senha temporária'), atual);
  await user.type(screen.getByLabelText('Nova senha'), nova);
  await user.type(screen.getByLabelText('Confirme a nova senha'), confirmacao);
  await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
}

describe('Senha temporária', () => {
  it('entrar com ela leva direto a "Defina sua nova senha", sem a casca', async () => {
    const { api } = await entrarComTemporaria('/lista');

    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();
    // Nenhuma tela autenticada carregou por trás.
    expect(api.para('GET /notificacoes')).toHaveLength(0);
  });

  it('reabrir o web com a troca pendente volta à tela, sem pedir as permissões', async () => {
    marcarConectado(true);
    const { api } = abrirApp('/', { rotas: { 'GET /auth/me': { status: 200, corpo: meComTroca() } } });

    expect(await screen.findByRole('heading', { name: TITULO })).toBeInTheDocument();
    expect(api.para('GET /usuario/permissoes')).toHaveLength(0);
  });

  it('o 403 troca_de_senha_obrigatoria em qualquer chamada leva à tela', async () => {
    // A flag apareceu depois do login (o admin redefiniu a senha com a sessão aberta).
    const troca = erro(403, 'troca_de_senha_obrigatoria', 'Defina uma nova senha para continuar');
    marcarConectado(true);
    abrirApp('/noticias', { rotas: { 'GET /notificacoes': troca, 'GET /noticias': troca } });

    expect(await screen.findByRole('heading', { name: TITULO })).toBeInTheDocument();
  });

  it('trocar a senha manda a temporária e a nova e libera o web onde o Usuário estava', async () => {
    const { user, api, historico } = await entrarComTemporaria('/noticias', {
      'POST /auth/trocar-senha': trocaOk,
      'GET /noticias': { status: 200, corpo: { itens: [], pagina: 1, por_pagina: 20, total: 0 } },
    });

    await preencherTroca(user, TEMPORARIA, 'minhaNova1');
    await navPrincipal();

    const troca = api.para('POST /auth/trocar-senha')[0];
    expect(troca?.corpo).toEqual({ senha_atual: TEMPORARIA, nova_senha: 'minhaNova1' });
    expect(troca?.autorizacao).toBe('Bearer A1');
    expect(troca?.cliente).toBe('web');
    expect(historico.location.pathname).toBe('/noticias');
    // Daqui em diante, o access novo.
    await waitFor(() => expect(api.para('GET /usuario/permissoes').at(-1)?.autorizacao).toBe('Bearer A3'));
  });

  it('valida antes de enviar: nova curta ou igual à temporária', async () => {
    const { user, api } = await entrarComTemporaria('/', { 'POST /auth/trocar-senha': trocaOk });

    await preencherTroca(user, TEMPORARIA, '12345');
    expect(await screen.findByRole('alert')).toHaveTextContent('A nova senha precisa ter pelo menos 6 caracteres.');

    for (const campo of ['Nova senha', 'Confirme a nova senha']) {
      await user.clear(screen.getByLabelText(campo));
      await user.type(screen.getByLabelText(campo), TEMPORARIA);
    }
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(screen.getByRole('alert')).toHaveTextContent('A nova senha precisa ser diferente da atual.');

    expect(api.para('POST /auth/trocar-senha')).toHaveLength(0);
  });

  it('senha temporária errada mostra o motivo do servidor e continua na tela', async () => {
    const recusa = {
      status: 400,
      corpo: {
        erro: 'Senha atual incorreta',
        codigo: 'dados_invalidos',
        detalhes: { senha_atual: 'Senha atual incorreta' },
      },
    };
    const { user } = await entrarComTemporaria('/', { 'POST /auth/trocar-senha': recusa });

    await preencherTroca(user, 'errada99', 'minhaNova1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Senha atual incorreta');
    expect(screen.getByLabelText('Senha temporária')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { name: TITULO })).toBeInTheDocument();
  });

  it('a única outra saída é sair da conta', async () => {
    const { user, api, historico } = await entrarComTemporaria('/');

    historico.push('/lista');
    expect(await screen.findByRole('heading', { name: TITULO })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(api.para('POST /auth/logout')).toHaveLength(1);
  });

  it('login comum não mostra a tela', async () => {
    const { user } = abrirApp('/', { rotas: rotasDaSessao() });

    await preencherLogin(user, usuarioAna.email, 'segredo1');
    await navPrincipal();

    expect(screen.queryByRole('heading', { name: TITULO })).not.toBeInTheDocument();
  });
});
