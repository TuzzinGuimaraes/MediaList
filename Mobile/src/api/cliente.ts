import { ErroApi, ErroRede } from './erros';
import type { RespostaRefresh } from './tipos';

export type Tokens = { access: string; refresh: string | null };

/** O que o cliente precisa da sessão autenticada: ler os tokens e avisar mudanças. */
export type FonteTokens = {
  atuais(): Tokens | null;
  /** O refresh trocou o par: guardar antes de repetir as requisições. */
  renovados(tokens: Tokens): Promise<void>;
  /** A sessão não pôde ser renovada: limpar e voltar ao login. */
  expirada(): void;
};

/** Rotas em que um 401 é a resposta final (credenciais erradas, refresh inválido). */
const SEM_RENOVACAO = new Set(['/auth/login', '/auth/registro', '/auth/refresh']);

type Corpo = Record<string, unknown> | unknown[];

export type OpcoesRequisicao = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Função quando o corpo depende dos tokens (ex.: logout manda o refresh vigente). */
  corpo?: Corpo | ((tokens: Tokens | null) => Corpo | undefined);
};

export type Cliente = {
  requisitar<T>(caminho: string, opcoes?: OpcoesRequisicao): Promise<T>;
};

export function criarCliente(baseUrl: string, fonte: FonteTokens): Cliente {
  async function enviar(caminho: string, opcoes: OpcoesRequisicao, tokens: Tokens | null) {
    const corpo = typeof opcoes.corpo === 'function' ? opcoes.corpo(tokens) : opcoes.corpo;
    const cabecalhos: Record<string, string> = { Accept: 'application/json' };
    if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
    if (tokens) cabecalhos.Authorization = `Bearer ${tokens.access}`;
    try {
      return await fetch(`${baseUrl}${caminho}`, {
        method: opcoes.metodo ?? 'GET',
        headers: cabecalhos,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw new ErroRede();
    }
  }

  async function ler<T>(resposta: Response): Promise<T> {
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new ErroApi(resposta.status, corpo?.erro ?? corpo?.msg ?? `Erro ${resposta.status}`);
    }
    return corpo as T;
  }

  // Um refresh por vez, compartilhado: o refresh token é rotativo (ADR 0006), e dois
  // refreshes com o mesmo token contam como reuso e derrubam a família inteira.
  let renovacao: Promise<Tokens | null> | null = null;

  function renovar(): Promise<Tokens | null> {
    renovacao ??= (async () => {
      const refresh = fonte.atuais()?.refresh;
      if (!refresh) return null;
      const resposta = await enviar(
        '/auth/refresh',
        { metodo: 'POST', corpo: { refresh_token: refresh } },
        null,
      );
      // 401 (inválido, expirado, reusado) e 403 (Usuário desativado) encerram a sessão.
      // Rede e 5xx não: o erro sobe e a tela oferece "tentar de novo".
      if (resposta.status === 401 || resposta.status === 403) return null;
      const dados = await ler<RespostaRefresh>(resposta);
      const novos = { access: dados.access_token, refresh: dados.refresh_token };
      await fonte.renovados(novos);
      return novos;
    })().finally(() => {
      renovacao = null;
    });
    return renovacao;
  }

  return {
    async requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}) {
      const usados = fonte.atuais();
      const resposta = await enviar(caminho, opcoes, usados);
      if (resposta.status !== 401 || !usados || SEM_RENOVACAO.has(caminho)) {
        return ler<T>(resposta);
      }

      // Se outra requisição já renovou enquanto esta estava no ar, só repete.
      const vigentes = fonte.atuais();
      const novos = vigentes && vigentes.access !== usados.access ? vigentes : await renovar();
      if (!novos) {
        fonte.expirada();
        return ler<T>(resposta);
      }

      const repetida = await enviar(caminho, opcoes, novos);
      if (repetida.status === 401) fonte.expirada();
      return ler<T>(repetida);
    },
  };
}
