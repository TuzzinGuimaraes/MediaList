/** O servidor respondeu com erro. `mensagem` vem do campo `erro` da API, já em português. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
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
