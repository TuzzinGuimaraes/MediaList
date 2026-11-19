import type { ReactNode } from 'react';

import { Opcoes } from './Opcoes';

/** Valor da pílula "Todos"/"Todas": as pílulas só trabalham com texto. */
export const TODOS = '';

type Props = {
  rotulo: string;
  opcoes: readonly { valor: string; nome: string }[];
  /** Ausente (undefined ou null) é "Todos". */
  valor?: string | null;
  /** Recebe undefined quando a escolha é "Todos". */
  mudar(valor: string | undefined): void;
  /** O texto da primeira pílula, conforme o gênero da palavra ("Todos", "Todas"). */
  todos?: string;
  semLegenda?: boolean;
  depois?: ReactNode;
};

/** Pílulas de um filtro com a primeira "Todos", que tira o filtro. */
export function OpcoesComTodos({ rotulo, opcoes, valor, mudar, todos = 'Todos', semLegenda, depois }: Props) {
  return (
    <Opcoes
      rotulo={rotulo}
      semLegenda={semLegenda}
      opcoes={[{ valor: TODOS, nome: todos }, ...opcoes]}
      valor={valor ?? TODOS}
      mudar={(v) => mudar(v || undefined)}
      depois={depois}
    />
  );
}
