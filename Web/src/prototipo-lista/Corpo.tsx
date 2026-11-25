// PROTÓTIPO (ticket 39, 2ª rodada): o corpo da Lista. Um Status escolhido na coluna, ou
// "Todos": a Lista inteira separada por Status, com o separador fixo (nome + contagem) e
// sem recolher. Subseções por Tipo só com Tipo "Todos" (Q120).
import type { EstadoConsumo } from '@dominio/estadoConsumo';

import { COR_DO_ESTADO } from '../componentes/status';
import { Colecao, type Ordenacao } from './Colecao';
import { type Item, NOME_SUBSECAO, NOMES_ESTADO, noEstado, porTipo, type TipoFiltro } from './dados';
import type { Formato } from './variantes';

export type Base = { formato: Formato; tipo: TipoFiltro; ordenacao: Ordenacao };

function Grupos({ itens, base, rotulo }: { itens: Item[]; base: Base; rotulo: string }) {
  const grupos = porTipo(itens, base.tipo);
  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => {
        const tipo = g.tipo ?? (base.tipo as Exclude<TipoFiltro, 'todos'>);
        return (
          <div key={tipo}>
            {g.tipo ? (
              <h3 className="mb-2.5 flex items-baseline gap-2 text-[12px] font-semibold uppercase tracking-wide text-texto-suave">
                {NOME_SUBSECAO[g.tipo]} <span className="font-normal tabular-nums normal-case tracking-normal opacity-70">{g.itens.length}</span>
              </h3>
            ) : null}
            <Colecao itens={g.itens} formato={base.formato} tipo={tipo} ordenacao={base.ordenacao} rotulo={g.tipo ? `${rotulo}, ${NOME_SUBSECAO[g.tipo]}` : rotulo} />
          </div>
        );
      })}
    </div>
  );
}

export function Vazio({ texto, acao }: { texto: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center motion-safe:animate-[aparecer_200ms_ease-out]">
      <span aria-hidden className="text-[44px] font-bold leading-none text-marca">M</span>
      <p className="text-[15px] text-texto-suave">{texto}</p>
      {acao}
    </div>
  );
}

export function CorpoStatus({ e, itens, base, vazio }: { e: EstadoConsumo; itens: Item[]; base: Base; vazio: React.ReactNode }) {
  const doStatus = itens.filter((i) => noEstado(i, e));
  return (
    <section key={e} aria-label={NOMES_ESTADO[e]} className="motion-safe:animate-[aparecer_180ms_ease-out]">
      {doStatus.length ? <Grupos itens={doStatus} base={base} rotulo={NOMES_ESTADO[e]} /> : vazio}
    </section>
  );
}

export function CorpoTodos({ estados, itens, base, vazio }: { estados: EstadoConsumo[]; itens: Item[]; base: Base; vazio: React.ReactNode }) {
  const secoes = estados.map((e) => ({ e, itens: itens.filter((i) => noEstado(i, e)) })).filter((s) => s.itens.length);
  if (!secoes.length) return <>{vazio}</>;
  return (
    <div className="flex flex-col gap-9 motion-safe:animate-[aparecer_180ms_ease-out]">
      {secoes.map(({ e, itens: doStatus }) => (
        <section key={e} aria-labelledby={`secao-${e}`}>
          <h2
            id={`secao-${e}`}
            className="sticky z-30 -mx-2 mb-3 flex items-center gap-3 border-b bg-fundo/95 px-2 py-2.5 backdrop-blur"
            style={{ top: 'var(--fixo)', borderColor: `color-mix(in srgb, ${COR_DO_ESTADO[e]} 35%, transparent)` }}
          >
            <span aria-hidden className="h-5 w-1 rounded-full" style={{ background: COR_DO_ESTADO[e] }} />
            <span className="text-[17px] font-bold" style={{ color: COR_DO_ESTADO[e] }}>
              {NOMES_ESTADO[e]}
            </span>
            <span className="text-[14px] tabular-nums text-texto-suave">{doStatus.length}</span>
          </h2>
          <Grupos itens={doStatus} base={base} rotulo={NOMES_ESTADO[e]} />
        </section>
      ))}
    </div>
  );
}
