import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { erro } from '../testes/fetchSimulado';
import { abrirApp, abrirLogado, entrarPeloLogin, navPrincipal, preencherLogin, usuarioAna } from '../testes/app';
import { CHAVE_CONECTADO } from './armazenamento';

describe('autenticação', () => {
  it('sem sessão, uma rota protegida leva ao login e, depois de entrar, volta para ela', async () => {
    const { user, historico, api } = abrirApp('/lista');

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    await preencherLogin(user, 'ana@exemplo.com', 'segredo1');
    await navPrincipal();

    expect(historico.location.pathname).toBe('/lista');
    const login = api.para('POST /auth/login')[0];
    expect(login?.corpo).toEqual({ email: 'ana@exemplo.com', senha: 'segredo1' });
    expect(login?.cliente).toBe('web');
    expect(localStorage.getItem(CHAVE_CONECTADO)).toBe('1');
  });

  it('nenhum token fica no localStorage: o access só em memória, o refresh no cookie', async () => {
    await entrarPeloLogin('/');

    const guardado = JSON.stringify({ ...localStorage });
    expect(guardado).not.toContain('A1');
    expect(localStorage.getItem('medialist.refresh')).toBeNull();
  });

  it('credenciais erradas mostram a mensagem do servidor', async () => {
    const { user } = abrirApp('/entrar', {
      rotas: { 'POST /auth/login': erro(401, 'nao_autenticado', 'Email ou senha incorretos') },
    });

    await preencherLogin(user, 'ana@exemplo.com', 'errada');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha incorretos');
  });

  it('criar conta registra e já entra', async () => {
    const { user, api } = abrirApp('/registro', {
      rotas: { 'POST /auth/registro': { status: 201, corpo: { mensagem: 'ok', id_usuario: 'USR-ana' } } },
    });

    await user.type(await screen.findByLabelText('Nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('Email'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'segredo1');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await navPrincipal();

    expect(api.para('POST /auth/registro')[0]?.corpo).toMatchObject({
      nome_completo: 'Ana Souza',
      email: 'ana@exemplo.com',
      senha: 'segredo1',
    });
    expect(api.para('POST /auth/login')).toHaveLength(1);
  });

  it('o menu da conta mostra o Usuário', async () => {
    const { user } = await abrirLogado('/');

    await user.click(screen.getByRole('button', { name: 'Conta' }));

    expect(screen.getByRole('menu')).toHaveTextContent(usuarioAna.nome);
    expect(screen.getByRole('menu')).toHaveTextContent(usuarioAna.email);
  });

  it('sair revoga o access e o refresh no servidor e volta ao login', async () => {
    const { user, api, historico } = await entrarPeloLogin('/');

    await user.click(screen.getByRole('button', { name: 'Conta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    const logout = api.para('POST /auth/logout')[0];
    expect(logout?.autorizacao).toBe('Bearer A1');
    expect(logout?.cliente).toBe('web');
    expect(logout?.corpo).toEqual({});
    expect(localStorage.getItem(CHAVE_CONECTADO)).toBeNull();
    expect(historico.location.pathname).toBe('/entrar');
  });

  it('sair com o access expirado renova e repete o logout com o access novo', async () => {
    const { user, api } = await entrarPeloLogin('/', {
      rotas: {
        'POST /auth/logout': (req) =>
          req.autorizacao === 'Bearer A2'
            ? { status: 200, corpo: { mensagem: 'Logout realizado com sucesso' } }
            : erro(401, 'token_expirado', 'Token expirado'),
      },
    });

    await user.click(screen.getByRole('button', { name: 'Conta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }));

    await screen.findByRole('heading', { name: 'Entrar' });
    expect(api.para('POST /auth/logout').map((c) => c.autorizacao)).toEqual(['Bearer A1', 'Bearer A2']);
    expect(api.para('POST /auth/refresh')).toHaveLength(1);
  });

  it('sair funciona mesmo com a API fora', async () => {
    const { user } = await entrarPeloLogin('/', {
      rotas: { 'POST /auth/logout': erro(503, 'indisponivel', 'Serviço indisponível') },
    });

    await user.click(screen.getByRole('button', { name: 'Conta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE_CONECTADO)).toBeNull();
  });

  it('descarta as chaves antigas (token e refresh no localStorage, catálogo como "sessão")', async () => {
    localStorage.setItem('medialist.refresh', 'R0');
    localStorage.setItem('token', 'velho');
    localStorage.setItem('user', '{}');
    localStorage.setItem('permissions', '{}');
    localStorage.setItem('medialist_sessao', 'jogos');

    abrirApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });

    for (const chave of ['medialist.refresh', 'token', 'user', 'permissions', 'medialist_sessao']) {
      expect(localStorage.getItem(chave)).toBeNull();
    }
  });
});

describe('refresh ao reabrir', () => {
  it('com a marca de sessão, renova pelo cookie, busca o Usuário e abre sem login', async () => {
    const { api, historico } = await abrirLogado('/explorar');

    const refresh = api.para('POST /auth/refresh')[0];
    expect(refresh?.corpo).toBeUndefined();
    expect(refresh?.cliente).toBe('web');
    expect(api.para('GET /auth/me')[0]?.autorizacao).toBe('Bearer A2');
    expect(historico.location.pathname).toBe('/explorar');
  });

  it('sem a marca, vai ao login sem chamar o refresh', async () => {
    const { api } = abrirApp('/lista');

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(api.para('POST /auth/refresh')).toHaveLength(0);
  });

  it('refresh recusado apaga a marca e vai ao login', async () => {
    localStorage.setItem(CHAVE_CONECTADO, '1');
    abrirApp('/lista', { rotas: { 'POST /auth/refresh': erro(401, 'token_invalido', 'Refresh token inválido') } });

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE_CONECTADO)).toBeNull();
  });

  it('API fora ao reabrir mostra o erro, mantém a marca e tenta de novo', async () => {
    localStorage.setItem(CHAVE_CONECTADO, '1');
    const { api, user } = abrirApp('/', {
      rotas: { 'POST /auth/refresh': erro(503, 'indisponivel', 'Serviço indisponível') },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível');
    expect(localStorage.getItem(CHAVE_CONECTADO)).toBe('1');

    api.rotas['POST /auth/refresh'] = { status: 200, corpo: { access_token: 'A2', refresh_token: null } };
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await navPrincipal();
  });

  it('outra aba saiu (a marca some do armazenamento): esta volta ao login', async () => {
    await abrirLogado('/');

    localStorage.removeItem(CHAVE_CONECTADO);
    window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_CONECTADO, newValue: null }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument());
  });
});
