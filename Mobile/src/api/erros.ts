import type { CodigoErro, Erro } from './tipos';

/**
 * O servidor respondeu com erro, no envelope `{erro, codigo, detalhes?}` (ADR 0011).
 * `message` é o `erro`, já em português, para a tela; decisões do app usam `codigo`,
 * nunca o texto. `codigo` é null quando a resposta não veio da API (proxy, HTML).
 */
export class ErroApi extends Error {
  readonly codigo: CodigoErro | null;
  /** Motivo por campo, nos erros de validação (`dados_invalidos`). */
  readonly detalhes: Record<string, string> | null;

  constructor(
    readonly status: number,
    mensagem: string,
    envelope?: Partial<Pick<Erro, 'codigo' | 'detalhes'>>,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
    this.codigo = envelope?.codigo ?? null;
    this.detalhes = envelope?.detalhes ?? null;
  }
}

/** Monta o ErroApi do corpo de uma resposta de erro; sem `erro` no corpo, a mensagem genérica do status. */
export function erroDaResposta(status: number, corpo: unknown): ErroApi {
  const envelope = (typeof corpo === 'object' && corpo !== null ? corpo : {}) as Partial<Erro>;
  const mensagem = typeof envelope.erro === 'string' ? envelope.erro : `Erro ${status}`;
  return new ErroApi(status, mensagem, envelope);
}

/** O servidor não foi alcançado (sem rede, API fora do ar, URL errada). */
export class ErroRede extends Error {
  constructor() {
    super('Sem conexão com o servidor.');
    this.name = 'ErroRede';
  }
}

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroApi || erro instanceof ErroRede) return erro.message;
  return 'Algo deu errado. Tente de novo.';
}
