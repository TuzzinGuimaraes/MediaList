import { useState } from 'react';

import { ErroApi, mensagemDeErro } from '../api/erros';

/** Para onde voltar depois de entrar: só caminhos internos, nunca outro site. */
export function destinoSeguro(destino: string | undefined): string {
  return destino && destino.startsWith('/') && !destino.startsWith('//') ? destino : '/';
}

/** Mensagem do erro e o motivo por campo (400 `dados_invalidos`). */
export function useErroDeFormulario() {
  const [erro, setErro] = useState<unknown>(null);
  const detalhes = erro instanceof ErroApi ? (erro.detalhes ?? {}) : {};
  return { erro, setErro, mensagem: erro ? mensagemDeErro(erro) : null, detalhes };
}
