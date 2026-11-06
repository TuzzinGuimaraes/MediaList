import { ErroApi, ErroRede } from './erros';

export type Tokens = { access: string; refresh: string | null };

/** O que o cliente precisa da sessão autenticada: ler os tokens e avisar mudanças. */
export type FonteTokens = {
  atuais(): Tokens | null;
};

export type OpcoesRequisicao = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  corpo?: unknown;
};

export type Cliente = {
  requisitar<T>(caminho: string, opcoes?: OpcoesRequisicao): Promise<T>;
};

export function criarCliente(baseUrl: string, fonte: FonteTokens): Cliente {
  async function enviar(caminho: string, opcoes: OpcoesRequisicao, access: string | null) {
    const cabecalhos: Record<string, string> = { Accept: 'application/json' };
    if (opcoes.corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
    if (access) cabecalhos.Authorization = `Bearer ${access}`;
    try {
      return await fetch(`${baseUrl}${caminho}`, {
        method: opcoes.metodo ?? 'GET',
        headers: cabecalhos,
        body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
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

  return {
    async requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}) {
      const resposta = await enviar(caminho, opcoes, fonte.atuais()?.access ?? null);
      return ler<T>(resposta);
    },
  };
}
