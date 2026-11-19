// Estados de tela: carregando, vazio e erro, todos com o monograma (Resolution do 29).
import type { ReactNode } from 'react';

import { mensagemDeErro } from '../api/erros';
import { Botao } from './Botao';
import { Monograma } from './Monograma';

export function Carregando({ rotulo = 'Carregando', telaCheia = false }: { rotulo?: string; telaCheia?: boolean }) {
  return (
    <div
      role="status"
      aria-label={rotulo}
      className={`flex items-center justify-center ${telaCheia ? 'min-h-screen' : 'min-h-[40vh]'}`}
    >
      <Monograma tamanho={56} rotulo={null} className="motion-safe:animate-pulse" />
    </div>
  );
}

export function Vazio({ texto, acao }: { texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-texto-suave">
      <Monograma tamanho={44} rotulo={null} />
      <p>{texto}</p>
      {acao}
    </div>
  );
}

/** Erro de uma consulta: a mensagem da API (ou de rede) e, se der, "Tentar de novo". */
export function ErroTela({ erro, tentarDeNovo, telaCheia = false }: { erro: unknown; tentarDeNovo?(): void; telaCheia?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-16 text-center ${telaCheia ? 'min-h-screen' : ''}`}
    >
      <Monograma tamanho={44} rotulo={null} />
      <p role="alert" className="text-texto-forte">
        {mensagemDeErro(erro)}
      </p>
      {tentarDeNovo ? (
        <Botao variante="secundario" onClick={tentarDeNovo}>
          Tentar de novo
        </Botao>
      ) : null}
    </div>
  );
}
