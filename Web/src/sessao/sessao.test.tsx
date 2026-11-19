import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { erro } from '../testes/fetchSimulado';
import { abrirApp, abrirLogado, entrarPeloLogin, navPrincipal, preencherLogin, usuarioAna } from '../testes/app';
import { CHAVE_REFRESH } from './armazenamento';

describe('autenticação', () => {
  it('sem sessão, uma rota protegida leva ao login e, depois de entrar, volta para ela', async () => {
    const { user, historico, api } = abrirApp('/lista');

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    await preencherLogin(user, 'ana@exemplo.com', 'segredo1');
    await navPrincipal();

    expect(historico.location.pathname).toBe('/lista');
    expect(api.para('POST /auth/login')[0]?.corpo).toEqual({ email: 'ana@exemplo.com', senha: 'segredo1' });
    expect(localStorage.getItem(CHAVE_REFRESH)).toBe('R1');
  });

  it('o access token fica só em memória', async () => {
    await entrarPeloLogin('/');

    expect(JSON.stringify({ ...localStorage })).not.toContain('A1');
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
    expect(logout?.corpo).toEqual({ refresh_token: 'R1' });
    expect(localStorage.getItem(CHAVE_REFRESH)).toBeNull();
    expect(historico.location.pathname).toBe('/entrar');
  });

  it('sair com o access expirado renova e revoga o refresh novo, não o velho', async () => {
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
    expect(api.para('POST /auth/logout').map((c) => c.corpo)).toEqual([{ refresh_token: 'R1' }, { refresh_token: 'R2' }]);
  });

  it('sair funciona mesmo com a API fora', async () => {
    const { user } = await entrarPeloLogin('/', {
      rotas: { 'POST /auth/logout': erro(503, 'indisponivel', 'Serviço indisponível') },
    });

    await user.click(screen.getByRole('button', { name: 'Conta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE_REFRESH)).toBeNull();
  });

  it('descarta as chaves do web antigo (token no localStorage e catálogo como "sessão")', async () => {
    localStorage.setItem('token', 'velho');
    localStorage.setItem('user', '{}');
    localStorage.setItem('permissions', '{}');
    localStorage.setItem('medialist_sessao', 'jogos');

    abrirApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });

    for (const chave of ['token', 'user', 'permissions', 'medialist_sessao']) {
      expect(localStorage.getItem(chave)).toBeNull();
    }
  });
});

describe('refresh ao reabrir', () => {
  it('com um refresh guardado, renova, busca o Usuário e abre sem login', async () => {
    const { api, historico } = await abrirLogado('/explorar');

    expect(api.para('POST /auth/refresh')[0]?.corpo).toEqual({ refresh_token: 'R1' });
    expect(localStorage.getItem(CHAVE_REFRESH)).toBe('R2');
    expect(api.para('GET /auth/me')[0]?.autorizacao).toBe('Bearer A2');
    expect(historico.location.pathname).toBe('/explorar');
  });

  it('refresh recusado limpa o guardado e vai ao login', async () => {
    localStorage.setItem(CHAVE_REFRESH, 'R1');
    abrirApp('/lista', { rotas: { 'POST /auth/refresh': erro(401, 'token_invalido', 'Refresh token inválido') } });

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE_REFRESH)).toBeNull();
  });

  it('API fora ao reabrir mostra o erro, guarda o refresh e tenta de novo', async () => {
    localStorage.setItem(CHAVE_REFRESH, 'R1');
    const { api, user } = abrirApp('/', {
      rotas: { 'POST /auth/refresh': erro(503, 'indisponivel', 'Serviço indisponível') },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível');
    expect(localStorage.getItem(CHAVE_REFRESH)).toBe('R1');

    api.rotas['POST /auth/refresh'] = { status: 200, corpo: { access_token: 'A2', refresh_token: 'R2' } };
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await navPrincipal();
    expect(localStorage.getItem(CHAVE_REFRESH)).toBe('R2');
  });

  it('outra aba saiu (o refresh some do armazenamento): esta volta ao login', async () => {
    await abrirLogado('/');

    localStorage.removeItem(CHAVE_REFRESH);
    window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_REFRESH, newValue: null }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument());
  });
});
