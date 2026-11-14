import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import { type Requisicao, type Resposta, loginOk, semConexao, simularFetch } from './fetchSimulado';
import { APP, aba, entrarPeloLogin as entrar, preencherLogin } from './sessao';

async function abrirApp() {
  return renderRouter(APP, { initialUrl: '/' });
}

const expirado: Resposta = { status: 401, corpo: { msg: 'Token has expired' } };

/** Rotas do Perfil: respondem só a quem manda o access token válido. */
function perfilResponde(accessValido: string, nivel = 'usuario') {
  const exige = (corpo: unknown) => (req: Requisicao) =>
    req.autorizacao === `Bearer ${accessValido}` ? { status: 200, corpo } : expirado;
  return {
    'GET /auth/me': exige({
      usuario: { id_usuario: 'USR-20261106-00007', nome_completo: 'Ana Souza', email: 'ana@exemplo.com', foto_perfil: null },
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

  it.each([
    ['com 5xx', () => ({ status: 503, corpo: { erro: 'Serviço indisponível' } }), 'Serviço indisponível'],
    ['sem rede', semConexao, 'Sem conexão com o servidor.'],
  ])('se a renovação falha %s, mantém a sessão e "Tentar de novo" renova', async (_caso, falha, aviso) => {
    let servidorOk = false;
    const api = simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'POST /auth/refresh': (req) => (servidorOk ? renovaPara('A2', 'R2')(req) : falha()),
      ...perfilResponde('A2'),
    });
    await entrar();

    await fireEvent.press(await aba('Perfil'));
    expect(await screen.findByText(aviso, {}, { timeout: 4000 })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Email')).not.toBeOnTheScreen();

    servidorOk = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    // O refresh guardado continuou o R1: nenhum token foi descartado na falha.
    expect(api.para('POST /auth/refresh').every((r) => r.corpo.refresh_token === 'R1')).toBe(true);
  });

  it('se a requisição repetida com o par novo ainda dá 401, volta ao login', async () => {
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'POST /auth/refresh': renovaPara('A2', 'R2'),
      ...perfilResponde('A-outro'),
    });
    const primeira = await entrar();

    await fireEvent.press(await aba('Perfil'));

    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
    await primeira.unmount();
    await abrirApp();
    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
  });

  it('várias requisições com a sessão expirada encerram a sessão uma vez só', async () => {
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R-velho' }),
      'POST /auth/refresh': renovaPara('A2', 'R2'),
      ...perfilResponde('A2'),
    });
    await entrar();
    const apagar = jest.spyOn(SecureStore, 'deleteItemAsync');

    await fireEvent.press(await aba('Perfil'));
    await screen.findByLabelText('Email');
    await act(async () => {});

    const apagouRefresh = apagar.mock.calls.filter(([chave]) => /refresh/.test(chave));
    expect(apagouRefresh).toHaveLength(1);
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


describe('criar conta', () => {
  async function abrirRegistro() {
    await abrirApp();
    await fireEvent.press(await screen.findByText('Não tem conta? Criar conta'));
  }

  async function preencherRegistro(dados: { nome: string; email: string; senha: string; confirmacao: string }) {
    await fireEvent.changeText(await screen.findByLabelText('Nome'), dados.nome);
    await fireEvent.changeText(screen.getByLabelText('Email'), dados.email);
    await fireEvent.changeText(screen.getByLabelText('Senha'), dados.senha);
    await fireEvent.changeText(screen.getByLabelText('Confirmar senha'), dados.confirmacao);
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));
  }

  it('cria a conta e já entra', async () => {
    const api = simularFetch({
      'POST /auth/registro': { status: 201, corpo: { mensagem: 'Usuário criado com sucesso!', id_usuario: 'USR-20261106-00007' } },
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
    });

    await abrirRegistro();
    await preencherRegistro({
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      senha: 'segredo1',
      confirmacao: 'segredo1',
    });

    expect(await aba('Início')).toBeOnTheScreen();
    expect(api.para('POST /auth/registro')[0].corpo).toEqual({
      nome_completo: 'Ana Souza',
      email: 'ana@exemplo.com',
      senha: 'segredo1',
    });
  });

  it('com senhas diferentes, avisa sem chamar a API', async () => {
    const api = simularFetch({});

    await abrirRegistro();
    await preencherRegistro({ nome: 'Ana', email: 'ana@exemplo.com', senha: 'segredo1', confirmacao: 'outra' });

    expect(await screen.findByRole('alert')).toHaveTextContent('As senhas não conferem.');
    expect(api.chamadas).toHaveLength(0);
  });

  it('com email já usado, mostra a mensagem da API', async () => {
    simularFetch({
      'POST /auth/registro': { status: 400, corpo: { erro: 'Email já cadastrado ou erro ao criar usuário' } },
    });

    await abrirRegistro();
    await preencherRegistro({ nome: 'Ana', email: 'ana@exemplo.com', senha: 'segredo1', confirmacao: 'segredo1' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Email já cadastrado ou erro ao criar usuário');
  });
});
