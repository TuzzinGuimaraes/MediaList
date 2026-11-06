import path from 'node:path';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { type Requisicao, type Resposta, loginOk, semConexao, simularFetch } from './fetchSimulado';

const APP = path.resolve(__dirname, '../../app');

async function abrirApp() {
  return renderRouter(APP, { initialUrl: '/' });
}

async function preencherLogin(email: string, senha: string) {
  await fireEvent.changeText(await screen.findByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Senha'), senha);
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
}

/** Botão da barra de abas (o React Navigation rotula como "Perfil, tab, 5 of 5"). */
function aba(nome: string) {
  return screen.findByRole('button', { name: new RegExp(`^${nome}, tab`) });
}

async function entrar() {
  const app = await abrirApp();
  await preencherLogin('ana@exemplo.com', 'segredo1');
  await aba('Início');
  return app;
}

const expirado: Resposta = { status: 401, corpo: { msg: 'Token has expired' } };

/** Rotas do Perfil: respondem só a quem manda o access token válido. */
function perfilResponde(accessValido: string, nivel = 'usuario') {
  const exige = (corpo: unknown) => (req: Requisicao) =>
    req.autorizacao === `Bearer ${accessValido}` ? { status: 200, corpo } : expirado;
  return {
    'GET /auth/me': exige({
      usuario: { id_usuario: 7, nome_completo: 'Ana Souza', email: 'ana@exemplo.com', foto_perfil: null },
    }),
    'GET /usuario/permissoes': exige({ permissoes: { nivel_acesso: nivel, grupos: 'Usuários' } }),
  };
}

describe('sessão autenticada', () => {
  it('sem sessão, abre no login; com email e senha certos, entra nas abas', async () => {
    const api = simularFetch({ 'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }) });

    await abrirApp();
    await preencherLogin('ana@exemplo.com', 'segredo1');

    expect(await aba('Início')).toBeOnTheScreen();
    expect(api.para('POST /auth/login')[0].corpo).toEqual({
      email: 'ana@exemplo.com',
      senha: 'segredo1',
    });
  });

  it('com senha errada, mostra a mensagem da API e continua no login', async () => {
    simularFetch({ 'POST /auth/login': { status: 401, corpo: { erro: 'Email ou senha incorretos' } } });

    await abrirApp();
    await preencherLogin('ana@exemplo.com', 'errada');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha incorretos');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeOnTheScreen();
  });

  it('continua logado ao reabrir o app', async () => {
    simularFetch({ 'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }) });
    const primeira = await abrirApp();
    await preencherLogin('ana@exemplo.com', 'segredo1');
    await aba('Início');
    await primeira.unmount();

    await abrirApp();

    expect(await aba('Início')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Email')).not.toBeOnTheScreen();
  });

  it('sair envia o refresh token ao servidor e volta ao login', async () => {
    const api = simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'POST /auth/logout': { status: 200, corpo: { mensagem: 'Logout realizado com sucesso' } },
      ...perfilResponde('A1'),
    });
    await entrar();

    await fireEvent.press(await aba('Perfil'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
    const [logout] = api.para('POST /auth/logout');
    expect(logout.autorizacao).toBe('Bearer A1');
    expect(logout.corpo).toEqual({ refresh_token: 'R1' });
  });
});

describe('renovação da sessão', () => {
  const renovaPara = (access: string, refresh: string) => (req: Requisicao) =>
    req.corpo?.refresh_token === 'R1'
      ? { status: 200, corpo: { access_token: access, refresh_token: refresh } }
      : { status: 401, corpo: { erro: 'Refresh token inválido' } };

  it('com o access token expirado, renova em silêncio e repete a requisição', async () => {
    const api = simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'POST /auth/refresh': renovaPara('A2', 'R2'),
      'POST /auth/logout': { status: 200, corpo: {} },
      ...perfilResponde('A2', 'moderador'),
    });
    await entrar();

    await fireEvent.press(await aba('Perfil'));

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(screen.getByText('Moderador')).toBeOnTheScreen();
    expect(api.para('POST /auth/refresh')[0].corpo).toEqual({ refresh_token: 'R1' });
    expect(api.para('GET /auth/me').map((r) => r.autorizacao)).toEqual(['Bearer A1', 'Bearer A2']);

    // O par novo passa a valer: sair revoga o R2, não o R1 já trocado.
    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    await screen.findByLabelText('Email');
    expect(api.para('POST /auth/logout')[0]).toMatchObject({
      autorizacao: 'Bearer A2',
      corpo: { refresh_token: 'R2' },
    });
  });

  it('duas requisições simultâneas com 401 fazem um único refresh', async () => {
    let liberarRefresh = () => {};
    const api = simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'POST /auth/refresh': (req) =>
        new Promise((resolver) => {
          liberarRefresh = () => resolver(renovaPara('A2', 'R2')(req));
        }),
      ...perfilResponde('A2'),
    });
    await entrar();

    await fireEvent.press(await aba('Perfil'));
    await waitFor(() => expect(api.para('POST /auth/refresh')).toHaveLength(1));
    await waitFor(() =>
      expect(api.para('GET /usuario/permissoes').map((r) => r.autorizacao)).toEqual(['Bearer A1']),
    );
    await act(async () => liberarRefresh());

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(api.para('POST /auth/refresh')).toHaveLength(1);
    expect(api.para('GET /auth/me').map((r) => r.autorizacao)).toEqual(['Bearer A1', 'Bearer A2']);
    expect(api.para('GET /usuario/permissoes').map((r) => r.autorizacao)).toEqual([
      'Bearer A1',
      'Bearer A2',
    ]);
  });

  it('se a renovação falha, limpa a sessão e volta ao login', async () => {
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R-velho' }),
      'POST /auth/refresh': renovaPara('A2', 'R2'),
      ...perfilResponde('A2'),
    });
    const primeira = await entrar();

    await fireEvent.press(await aba('Perfil'));

    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
    await primeira.unmount();
    await abrirApp();
    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
  });
});


describe('casos de borda da sessão', () => {
  it('Usuário desativado vê o aviso no login', async () => {
    simularFetch({ 'POST /auth/login': { status: 403, corpo: { erro: 'Usuário desativado' } } });

    await abrirApp();
    await preencherLogin('ana@exemplo.com', 'segredo1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário desativado');
  });

  it('login sem refresh token funciona até o access expirar; aí volta ao login sem tentar renovar', async () => {
    const api = simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: null }),
      ...perfilResponde('A-outro'),
    });
    await entrar();

    await fireEvent.press(await aba('Perfil'));

    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
    expect(api.para('POST /auth/refresh')).toHaveLength(0);
  });
});

describe('estados de erro', () => {
  it('sem conexão, o Perfil avisa e "Tentar de novo" recarrega', async () => {
    let online = false;
    const perfil = perfilResponde('A1');
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /auth/me': (req) => (online ? perfil['GET /auth/me'](req) : semConexao()),
      'GET /usuario/permissoes': (req) =>
        online ? perfil['GET /usuario/permissoes'](req) : semConexao(),
    });
    await entrar();

    await fireEvent.press(await aba('Perfil'));
    expect(await screen.findByText('Sem conexão com o servidor.', {}, { timeout: 3000 })).toBeOnTheScreen();

    online = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
  });
});
