// Fronteira única dos testes: o `fetch` global. Cada rota ("POST /auth/login", sem o
// prefixo /api) responde com um objeto fixo ou com uma função da requisição recebida.
// Rota não prevista falha o teste, para nenhuma chamada passar despercebida.
import { vi } from 'vitest';

import type { Esquemas } from '../api/tipos';

export type Requisicao = {
  metodo: string;
  /** Caminho sem o /api e sem a query. */
  caminho: string;
  query: URLSearchParams;
  autorizacao: string | null;
  /** Cabeçalho X-Cliente: o web manda "web" para usar o cookie do refresh. */
  cliente: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- o teste lê o corpo como quiser.
  corpo: any;
};

export type Resposta = { status: number; corpo?: unknown };

export type Responder = Resposta | ((req: Requisicao) => Resposta | Promise<Resposta>);

export type Rotas = Record<string, Responder>;

export function simularFetch(rotas: Rotas) {
  const chamadas: Requisicao[] = [];

  const falso = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const pedido = new Request(entrada instanceof Request ? entrada : new URL(String(entrada), location.origin), init);
    const url = new URL(pedido.url);
    const texto = await pedido.text();
    const req: Requisicao = {
      metodo: pedido.method.toUpperCase(),
      caminho: url.pathname.replace(/^\/api/, ''),
      query: url.searchParams,
      autorizacao: pedido.headers.get('Authorization'),
      cliente: pedido.headers.get('X-Cliente'),
      corpo: texto ? JSON.parse(texto) : undefined,
    };
    chamadas.push(req);

    const responder = rotas[`${req.metodo} ${req.caminho}`];
    if (!responder) throw new Error(`fetch simulado: rota não prevista ${req.metodo} ${req.caminho}`);
    const { status, corpo } = typeof responder === 'function' ? await responder(req) : responder;
    return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', falso);

  return {
    chamadas,
    /** Chamadas de uma rota, ex. `para('POST /auth/refresh')`. */
    para: (rota: string) => chamadas.filter((c) => `${c.metodo} ${c.caminho}` === rota),
    /** Acrescenta ou troca rotas depois de montado. */
    rotas,
  };
}

/** Responder que simula a API fora do ar (o fetch rejeita, como sem rede). */
export function semConexao(): never {
  throw new TypeError('Failed to fetch');
}

/** Envelope de erro do contrato (ADR 0011). */
export function erro(status: number, codigo: Esquemas['CodigoErro'], mensagem: string): Resposta {
  const corpo: Esquemas['Erro'] = { erro: mensagem, codigo };
  return { status, corpo };
}
