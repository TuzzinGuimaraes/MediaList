import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';

import { mensagemDeErro } from '../../../api/erros';
import { OpcoesComTodos } from '../../../componentes/OpcoesComTodos';

/** Opções visíveis antes do "+N" (Gênero, Plataforma, Estúdio). */
export const OPCOES_VISIVEIS = 8;

type Props = {
  rotulo: string;
  /** O plural do rótulo, para o "Mostrar mais N …". */
  plural: string;
  opcoes: string[];
  valor?: string;
  mudar(valor: string | undefined): void;
  todos: string;
};

/** Pílulas com as primeiras visíveis e um "+N" que mostra o resto; a escolhida nunca some. */
export function PilulasLimitadas({ rotulo, plural, opcoes, valor, mudar, todos }: Props) {
  const [tudo, setTudo] = useState(false);
  const base = tudo ? opcoes : opcoes.slice(0, OPCOES_VISIVEIS);
  const visiveis = valor && !base.includes(valor) ? [...base, valor] : base;
  const resto = opcoes.length - OPCOES_VISIVEIS;
  return (
    <OpcoesComTodos
      rotulo={rotulo}
      semLegenda
      todos={todos}
      opcoes={visiveis.map((g) => ({ valor: g, nome: g }))}
      valor={valor}
      mudar={mudar}
      depois={
        resto > 0 ? (
          <button
            type="button"
            aria-expanded={tudo}
            aria-label={tudo ? `Mostrar menos ${plural}` : `Mostrar mais ${resto} ${plural}`}
            onClick={() => setTudo((t) => !t)}
            className="inline-flex min-h-9 items-center rounded-full border border-dashed border-borda px-3.5 text-[14px] font-semibold text-marca-texto outline-none hover:border-marca-texto focus-visible:ring-2 focus-visible:ring-marca-texto"
          >
            {tudo ? 'Menos' : `+${resto}`}
          </button>
        ) : null
      }
    />
  );
}

/** As pílulas de opções que vêm da API (Gêneros, facetas): o erro com "Tentar de novo" no lugar delas. */
export function PilulasDaApi<T>({
  consulta,
  opcoes,
  ...props
}: Omit<Props, 'opcoes'> & { consulta: UseQueryResult<T>; opcoes(dados: T): string[] }) {
  if (consulta.isError && !consulta.data) {
    return (
      <p className="text-[13px] text-texto-suave">
        {mensagemDeErro(consulta.error)}{' '}
        <button type="button" onClick={() => void consulta.refetch()} className="text-marca-texto hover:underline">
          Tentar de novo
        </button>
      </p>
    );
  }
  return <PilulasLimitadas {...props} opcoes={consulta.data ? opcoes(consulta.data) : []} />;
}
