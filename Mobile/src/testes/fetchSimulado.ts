import type { RespostaLogin, UsuarioSessao } from '../api/tipos';

// Fronteira única dos testes de tela: o `fetch` global. Cada rota ("POST /auth/login")
// responde com um objeto fixo ou com uma função da requisição recebida.

export type Requisicao = {
  metodo: string;
  caminho: string;
  autorizacao: string | null;
  corpo: any;
};

export type Resposta = { status: number; corpo?: unknown };

type Responder = Resposta | ((req: Requisicao) => Resposta | Promise<Resposta>);

export function simularFetch(rotas: Record<string, Responder>) {
  const chamadas: Requisicao[] = [];

  const fetchFalso = jest.fn(async (url: string, init: RequestInit = {}) => {
    const caminho = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    const cabecalhos = new Headers(init.headers);
    const req: Requisicao = {
      metodo: (init.method ?? 'GET').toUpperCase(),
      caminho,
      autorizacao: cabecalhos.get('Authorization'),
      corpo: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    chamadas.push(req);

    const responder = rotas[`${req.metodo} ${caminho}`];
    if (!responder) {
      throw new Error(`fetch simulado: rota não prevista ${req.metodo} ${caminho}`);
    }
    const { status, corpo } = typeof responder === 'function' ? await responder(req) : responder;
    return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  global.fetch = fetchFalso as unknown as typeof fetch;

  return {
    chamadas,
    para: (rota: string) => chamadas.filter((c) => `${c.metodo} ${c.caminho}` === rota),
  };
}

export function semConexao(): never {
  throw new TypeError('Network request failed');
}

export const usuarioAna: UsuarioSessao = {
  id: 'USR-20261106-00007',
  nome: 'Ana Souza',
  email: 'ana@exemplo.com',
  permissoes: {
    nivel_acesso: 'usuario',
    grupos: 'Usuários',
    pode_criar: false,
    pode_editar: false,
    pode_deletar: false,
    pode_moderar: false,
  },
};

export function loginOk(tokens: { access: string; refresh: string | null }): Resposta {
  const corpo: RespostaLogin = { access_token: tokens.access, refresh_token: tokens.refresh, usuario: usuarioAna };
  return { status: 200, corpo };
}
