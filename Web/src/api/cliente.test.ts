import { describe, expect, it, vi } from 'vitest';

import { erro, semConexao, simularFetch } from '../testes/fetchSimulado';
import { criarCliente, exigir, type FonteTokens } from './cliente';
import { ErroApi, ErroRede } from './erros';

/** Sessão em memória com o access A1, como depois de um login; o refresh fica no cookie. */
function fonte(inicial: { access: string | null } = { access: 'A1' }) {
  const tokens = { ...inicial };
  const f = {
    access: () => tokens.access,
    renovado: vi.fn((access: string) => {
      tokens.access = access;
    }),
    expirada: vi.fn(() => {
      tokens.access = null;
    }),
    trocaObrigatoria: vi.fn(),
  } satisfies FonteTokens;
  return { f, tokens };
}

const renovado = { status: 200, corpo: { access_token: 'A2', refresh_token: null } };

const perfil = { status: 200, corpo: { permissoes: { nivel_acesso: 'usuario' } } };

describe('cliente da API', () => {
  it('manda o access token e devolve o corpo tipado', async () => {
    const api = simularFetch({ 'GET /usuario/permissoes': perfil });
    const { f } = fonte();

    const dados = await exigir(criarCliente(f).GET('/api/usuario/permissoes'));

    expect(dados.permissoes.nivel_acesso).toBe('usuario');
    expect(api.para('GET /usuario/permissoes')[0]?.autorizacao).toBe('Bearer A1');
  });

  it('erro da API vira ErroApi com mensagem, código e detalhes do envelope', async () => {
    simularFetch({
      'POST /auth/registro': {
        status: 400,
        corpo: { erro: 'Dados inválidos', codigo: 'dados_invalidos', detalhes: { email: 'Obrigatório' } },
      },
    });
    const { f } = fonte({ access: null });

    const falha = exigir(
      criarCliente(f).POST('/api/auth/registro', { body: { nome_completo: 'Ana', email: '', senha: 'x' } }),
    );

    await expect(falha).rejects.toMatchObject({
      name: 'ErroApi',
      status: 400,
      message: 'Dados inválidos',
      codigo: 'dados_invalidos',
      detalhes: { email: 'Obrigatório' },
    });
  });

  it('o 403 troca_de_senha_obrigatoria avisa a sessão; outro 403, não', async () => {
    simularFetch({
      'GET /usuario/permissoes': erro(403, 'troca_de_senha_obrigatoria', 'Defina uma nova senha para continuar'),
      'GET /lista': erro(403, 'acesso_negado', 'Acesso negado'),
    });
    const { f } = fonte();
    const api = criarCliente(f);

    await expect(exigir(api.GET('/api/lista'))).rejects.toMatchObject({ codigo: 'acesso_negado' });
    expect(f.trocaObrigatoria).not.toHaveBeenCalled();

    await expect(exigir(api.GET('/api/usuario/permissoes'))).rejects.toMatchObject({
      status: 403,
      codigo: 'troca_de_senha_obrigatoria',
    });
    expect(f.trocaObrigatoria).toHaveBeenCalledTimes(1);
  });

  it('sem conexão vira ErroRede', async () => {
    simularFetch({ 'GET /usuario/permissoes': semConexao });

    await expect(exigir(criarCliente(fonte().f).GET('/api/usuario/permissoes'))).rejects.toBeInstanceOf(ErroRede);
  });

  it('toda requisição se identifica como o web (X-Cliente), o que libera o cookie do refresh', async () => {
    const api = simularFetch({ 'GET /usuario/permissoes': perfil });

    await exigir(criarCliente(fonte().f).GET('/api/usuario/permissoes'));

    expect(api.para('GET /usuario/permissoes')[0]?.cliente).toBe('web');
  });

  it('401 renova pelo cookie (sem corpo) e repete a requisição com o access novo', async () => {
    const api = simularFetch({
      'GET /usuario/permissoes': (req) =>
        req.autorizacao === 'Bearer A2' ? perfil : erro(401, 'token_expirado', 'Token expirado'),
      'POST /auth/refresh': renovado,
    });
    const { f, tokens } = fonte();

    await exigir(criarCliente(f).GET('/api/usuario/permissoes'));

    const refresh = api.para('POST /auth/refresh')[0];
    expect(refresh?.corpo).toBeUndefined();
    expect(refresh?.cliente).toBe('web');
    expect(tokens).toEqual({ access: 'A2' });
    expect(api.para('GET /usuario/permissoes').map((c) => c.autorizacao)).toEqual(['Bearer A1', 'Bearer A2']);
  });

  it('repete também o corpo da requisição renovada', async () => {
    const api = simularFetch({
      'POST /avaliacoes': (req) =>
        req.autorizacao === 'Bearer A2'
          ? { status: 201, corpo: { mensagem: 'ok', id_avaliacao: 'AV1' } }
          : erro(401, 'token_expirado', 'Token expirado'),
      'POST /auth/refresh': renovado,
    });
    const corpo = { id_midia: 'M1', nota: 8, titulo_avaliacao: 'Bom', texto_avaliacao: 'Gostei' };

    await exigir(criarCliente(fonte().f).POST('/api/avaliacoes', { body: corpo as never }));

    expect(api.para('POST /avaliacoes').map((c) => c.corpo)).toEqual([corpo, corpo]);
  });

  it('401 simultâneos fazem um refresh só (o refresh é rotativo)', async () => {
    const api = simularFetch({
      'GET /usuario/permissoes': (req) =>
        req.autorizacao === 'Bearer A2' ? perfil : erro(401, 'token_expirado', 'Token expirado'),
      'POST /auth/refresh': renovado,
    });
    const cliente = criarCliente(fonte().f);

    await Promise.all([1, 2, 3].map(() => exigir(cliente.GET('/api/usuario/permissoes'))));

    expect(api.para('POST /auth/refresh')).toHaveLength(1);
  });

  it('refresh recusado encerra a sessão e o 401 sobe', async () => {
    simularFetch({
      'GET /usuario/permissoes': erro(401, 'token_expirado', 'Token expirado'),
      'POST /auth/refresh': erro(401, 'token_invalido', 'Refresh token inválido'),
    });
    const { f } = fonte();

    const falha = exigir(criarCliente(f).GET('/api/usuario/permissoes'));

    await expect(falha).rejects.toMatchObject({ status: 401 });
    expect(f.expirada).toHaveBeenCalledOnce();
  });

  it('Usuário desativado (403 no refresh) também encerra a sessão', async () => {
    simularFetch({
      'GET /usuario/permissoes': erro(401, 'token_expirado', 'Token expirado'),
      'POST /auth/refresh': erro(403, 'acesso_negado', 'Usuário desativado'),
    });
    const { f } = fonte();

    await expect(exigir(criarCliente(f).GET('/api/usuario/permissoes'))).rejects.toBeInstanceOf(ErroApi);
    expect(f.expirada).toHaveBeenCalledOnce();
  });

  it('API fora no refresh não encerra a sessão: o erro sobe e o access fica', async () => {
    simularFetch({
      'GET /usuario/permissoes': erro(401, 'token_expirado', 'Token expirado'),
      'POST /auth/refresh': erro(503, 'indisponivel', 'Serviço indisponível'),
    });
    const { f, tokens } = fonte();

    await expect(exigir(criarCliente(f).GET('/api/usuario/permissoes'))).rejects.toMatchObject({ status: 503 });
    expect(f.expirada).not.toHaveBeenCalled();
    expect(tokens.access).toBe('A1');
  });

  it('401 do login é a resposta final, sem tentar refresh', async () => {
    const api = simularFetch({ 'POST /auth/login': erro(401, 'nao_autenticado', 'Email ou senha incorretos') });

    const falha = exigir(criarCliente(fonte().f).POST('/api/auth/login', { body: { email: 'a@b.c', senha: 'x' } }));

    await expect(falha).rejects.toThrow('Email ou senha incorretos');
    expect(api.para('POST /auth/refresh')).toHaveLength(0);
  });
});
