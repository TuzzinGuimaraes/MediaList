// Cliente HTTP do web: openapi-fetch tipado por `contrato/api.d.ts` (caminho, query, corpo
// e resposta), com o access token e o refresh rotativo do ADR 0006 por baixo.
//
// Uso nas telas: `exigir(api.GET('/api/midias', { params: { query: { tipo: 'anime' } } }))`
// devolve os dados ou lança ErroApi/ErroRede, que o TanStack Query entende.
import createClient, { type Client } from 'openapi-fetch';

import { ErroApi, ErroRede, erroDaResposta } from './erros';
import type { Caminhos, Esquemas } from './tipos';

/**
 * O que o cliente precisa da sessão: o access vigente e os avisos de troca e de fim. O
 * refresh não passa por aqui: fica no cookie httpOnly que o backend grava (ADR 0006).
 */
export type FonteTokens = {
  access(): string | null;
  /** O refresh trocou o access: guardar antes de repetir as requisições. */
  renovado(access: string): void;
  /** A sessão não pôde ser renovada (refresh inválido, reusado, Usuário desativado). */
  expirada(): void | Promise<void>;
};

/**
 * Cabeçalho que identifica o web: com ele, login, refresh e logout usam o cookie do refresh.
 * Também é a proteção CSRF: outro site manda o cookie, mas não este cabeçalho.
 */
const CLIENTE_WEB = { 'X-Cliente': 'web' } as const;

export type Api = Client<Caminhos> & {
  /** Troca o refresh do cookie por um access novo; null se a sessão acabou. Usado ao reabrir o web. */
  renovar(): Promise<string | null>;
};

/**
 * Rotas em que um 401 é a resposta final (credenciais erradas, refresh inválido). O
 * logout renova por conta própria (sessao.ts), para revogar o refresh vigente.
 */
const SEM_RENOVACAO = ['/api/auth/login', '/api/auth/registro', '/api/auth/refresh', '/api/auth/logout'];

/** Nome da trava entre abas: uma renovação por vez no navegador inteiro. */
const TRAVA_REFRESH = 'medialist.refresh';

/**
 * Serializa a renovação entre abas (Web Locks): o refresh é rotativo e o cookie é
 * compartilhado; duas abas renovando com o mesmo token contam como reuso e derrubam a
 * família inteira. Na fila, a segunda aba já manda o cookie que a primeira gravou.
 * Sem a API (navegador antigo, jsdom), roda direto.
 */
function travado<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? locks.request(TRAVA_REFRESH, fn) : fn();
}

async function enviar(pedido: Request): Promise<Response> {
  try {
    // globalThis.fetch lido a cada chamada: os testes trocam o fetch depois de criar o cliente.
    return await globalThis.fetch(pedido);
  } catch {
    throw new ErroRede();
  }
}

function comToken(pedido: Request, access: string | null): Request {
  const cabecalhos = new Headers(pedido.headers);
  cabecalhos.set('X-Cliente', CLIENTE_WEB['X-Cliente']);
  if (access) cabecalhos.set('Authorization', `Bearer ${access}`);
  return new Request(pedido, { headers: cabecalhos });
}

function origem(): string {
  return typeof location !== 'undefined' ? location.origin : '';
}

export function criarCliente(fonte: FonteTokens): Api {
  // Um refresh por vez também dentro da aba: as requisições que tomam 401 juntas esperam a mesma renovação.
  let renovacao: Promise<string | null> | null = null;

  function renovar(): Promise<string | null> {
    renovacao ??= travado(async () => {
      const resposta = await enviar(
        new Request(`${origem()}/api/auth/refresh`, {
          method: 'POST',
          headers: { ...CLIENTE_WEB, Accept: 'application/json' },
        }),
      );
      // 401 (inválido, expirado, reusado) e 403 (Usuário desativado) encerram a sessão.
      // Rede e 5xx não: o erro sobe, e o mesmo refresh vale para tentar de novo.
      if (resposta.status === 401 || resposta.status === 403) return null;
      const dados: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) throw erroDaResposta(resposta.status, dados);
      const { access_token } = dados as Esquemas['RespostaRefresh'];
      fonte.renovado(access_token);
      return access_token;
    }).finally(() => {
      renovacao = null;
    });
    return renovacao;
  }

  async function fetchAutenticado(pedido: Request): Promise<Response> {
    const usado = fonte.access();
    // O corpo de um Request só pode ser lido uma vez: a cópia é a da repetição.
    const copia = pedido.clone();
    const resposta = await enviar(comToken(pedido, usado));
    const caminho = new URL(pedido.url).pathname;
    if (resposta.status !== 401 || !usado || SEM_RENOVACAO.includes(caminho)) return resposta;

    // Se outra requisição já renovou enquanto esta estava no ar, só repete.
    const vigente = fonte.access();
    const novo = vigente && vigente !== usado ? vigente : await renovar();
    if (!novo) {
      await fonte.expirada();
      return resposta;
    }
    const repetida = await enviar(comToken(copia, novo));
    if (repetida.status === 401) await fonte.expirada();
    return repetida;
  }

  const cliente = createClient<Caminhos>({ baseUrl: origem(), fetch: fetchAutenticado });
  return Object.assign(cliente, { renovar });
}

type RespostaOpenApi<T> = { data?: T; error?: unknown; response: Response };

/** Desembrulha a resposta do openapi-fetch: os dados, ou ErroApi com o envelope de erro. */
export async function exigir<T>(chamada: Promise<RespostaOpenApi<T>>): Promise<T> {
  const { data, error, response } = await chamada;
  if (!response.ok) throw erroDaResposta(response.status, error);
  if (data === undefined) throw new ErroApi(response.status, 'Resposta vazia do servidor.');
  return data;
}
