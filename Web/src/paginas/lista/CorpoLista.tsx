// O corpo da Lista: um Status escolhido na coluna, ou "Todos", a Lista inteira separada por
// Status com o separador fixo (nome + contagem), sem recolher. Subseções por Tipo só com o
// Tipo "Todos" (Q120).
import type { ReactNode } from 'react';

import { type EstadoConsumo, NOMES_ESTADO } from '@dominio/estadoConsumo';
import { porTipo, secoesPorStatus, type TipoDaLista, tiposDoFiltro } from '@dominio/filtrosLista';
import { itensDoEstado } from '@dominio/itemLista';

import { COR_DO_ESTADO } from '../../componentes/status';
import type { ItemLista } from './api';
import { Colecao, type PropsColecao } from './Colecao';
import type { FormatoLista } from './preferencias';
import { NOMES_TIPO_DA_LISTA } from './textos';

/** O que todo grupo recebe igual. */
export type BaseDoCorpo = Pick<PropsColecao, 'ordenacao' | 'mudarStatus'> & { formato: FormatoLista; tipo: TipoDaLista };

function Grupos({ itens, base, rotulo }: { itens: ItemLista[]; base: BaseDoCorpo; rotulo: string }) {
  const { formato, tipo, ...props } = base;
  return (
    <div className="flex flex-col gap-6">
      {porTipo(itens, tiposDoFiltro(tipo)).map((g) => (
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

export function CorpoStatus({ estado, itens, base, vazio }: { estado: EstadoConsumo; itens: ItemLista[]; base: BaseDoCorpo; vazio: ReactNode }) {
  const doStatus = itensDoEstado(itens, estado);
  return (
    <section aria-label={NOMES_ESTADO[estado]} className="motion-safe:animate-[aparecer_180ms_ease-out]">
      {doStatus.length ? <Grupos itens={doStatus} base={base} rotulo={NOMES_ESTADO[estado]} /> : vazio}
    </section>
  );
}

type PropsTodos = { estados: readonly EstadoConsumo[]; itens: ItemLista[]; base: BaseDoCorpo; vazio: ReactNode };

export function CorpoTodos({ estados, itens, base, vazio }: PropsTodos) {
  const secoes = secoesPorStatus(itens, estados);
  if (!secoes.length) return <>{vazio}</>;
  return (
    <div className="flex flex-col gap-9 motion-safe:animate-[aparecer_180ms_ease-out]">
      {secoes.map(({ estado, itens: doStatus }) => (
        <section key={estado} aria-labelledby={`secao-${estado}`}>
          <h2
            id={`secao-${estado}`}
            className="sticky z-20 -mx-2 mb-3 flex items-center gap-3 border-b bg-fundo/95 px-2 py-2.5 backdrop-blur"
            style={{ top: 'var(--topo-da-lista)', borderColor: `color-mix(in srgb, ${COR_DO_ESTADO[estado]} 35%, transparent)` }}
          >
            <span aria-hidden className="h-5 w-1 rounded-full" style={{ background: COR_DO_ESTADO[estado] }} />
            <span className="text-[17px] font-bold" style={{ color: COR_DO_ESTADO[estado] }}>
              {NOMES_ESTADO[estado]}
            </span>{' '}
            <span className="text-[14px] tabular-nums text-texto-suave">{doStatus.length}</span>
          </h2>
          <Grupos itens={doStatus} base={base} rotulo={NOMES_ESTADO[estado]} />
        </section>
      ))}
    </div>
  );
}
