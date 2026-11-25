// O corpo da Lista: um Status escolhido na coluna, ou "Todos", a Lista inteira separada por
// Status com o separador fixo (nome + contagem), sem recolher. Subseções por Tipo só com o
// Tipo "Todos" (Q120).
import type { ReactNode } from 'react';

import { NOMES_ESTADO } from '@dominio/estadoConsumo';
import type { TipoDaLista } from '@dominio/filtrosLista';

import { COR_DO_ESTADO } from '../../componentes/status';
import { Colecao, type PropsColecao } from './Colecao';
import { idDaSecao } from './focoDaLista';
import type { FormatoLista } from './preferencias';
import type { Grupo, SecaoNaTela } from './secoes';
import { NOMES_TIPO_DA_LISTA } from './textos';

/** Altura do separador grudento de Status no "Todos" (a folga de rolagem conta com ela). */
export const ALTURA_SEPARADOR = 48;

/** O que todo grupo recebe igual. */
export type BaseDoCorpo = Pick<PropsColecao, 'ordenacao' | 'mudarStatus'> & { formato: FormatoLista; tipo: TipoDaLista };

function Grupos({ grupos, base, rotulo }: { grupos: Grupo[]; base: BaseDoCorpo; rotulo: string }) {
  const { formato, tipo, ...props } = base;
  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <div key={g.tipo ?? tipo}>
          {g.tipo ? (
            <h3 className="mb-2.5 flex items-baseline gap-2 text-[12px] font-semibold uppercase tracking-wide text-texto-suave">
              {NOMES_TIPO_DA_LISTA[g.tipo]}{' '}
              <span className="font-normal normal-case tracking-normal tabular-nums opacity-80">{g.itens.length}</span>
            </h3>
          ) : null}
          <Colecao
            {...props}
            formato={formato}
            itens={g.itens}
            tipo={g.tipo ?? (tipo === 'todos' ? null : tipo)}
            rotulo={g.tipo ? `${rotulo}, ${NOMES_TIPO_DA_LISTA[g.tipo]}` : rotulo}
          />
        </div>
      ))}
    </div>
  );
}

export function CorpoStatus({ secao, base, vazio }: { secao: SecaoNaTela; base: BaseDoCorpo; vazio: ReactNode }) {
  return (
    <section aria-label={NOMES_ESTADO[secao.estado]} className="motion-safe:animate-[aparecer_180ms_ease-out]">
      {secao.grupos.length ? <Grupos grupos={secao.grupos} base={base} rotulo={NOMES_ESTADO[secao.estado]} /> : vazio}
    </section>
  );
}

export function CorpoTodos({ secoes, base, vazio }: { secoes: SecaoNaTela[]; base: BaseDoCorpo; vazio: ReactNode }) {
  if (!secoes.length) return <>{vazio}</>;
  return (
    <div className="flex flex-col gap-9 motion-safe:animate-[aparecer_180ms_ease-out]">
      {secoes.map(({ estado, grupos }) => (
        <section key={estado} aria-labelledby={idDaSecao(estado)}>
          <h2
            id={idDaSecao(estado)}
            // Focável só por código: o foco de último caso depois de mudar um Status.
            tabIndex={-1}
            className="sticky z-20 -mx-2 mb-3 flex items-center gap-3 border-b bg-fundo/95 px-2 outline-none backdrop-blur"
            style={{ top: 'var(--topo-da-lista)', height: ALTURA_SEPARADOR, borderColor: `color-mix(in srgb, ${COR_DO_ESTADO[estado]} 35%, transparent)` }}
          >
            <span aria-hidden className="h-5 w-1 rounded-full" style={{ background: COR_DO_ESTADO[estado] }} />
            <span className="text-[17px] font-bold" style={{ color: COR_DO_ESTADO[estado] }}>
              {NOMES_ESTADO[estado]}
            </span>{' '}
            <span className="text-[14px] tabular-nums text-texto-suave">{grupos.reduce((n, g) => n + g.itens.length, 0)}</span>
          </h2>
          <Grupos grupos={grupos} base={base} rotulo={NOMES_ESTADO[estado]} />
        </section>
      ))}
    </div>
  );
}
