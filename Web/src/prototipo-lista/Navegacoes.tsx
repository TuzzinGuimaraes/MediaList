// PROTÓTIPO (ticket 39, Q118): as 6 navegações entre Status. As faixas (abas, índice,
// chips) vão no topo fixo da página; os corpos, abaixo dele.
import { useEffect, useRef, useState } from 'react';

import type { EstadoConsumo } from '@dominio/estadoConsumo';

import { Icone } from '../componentes/Icone';
import { COR_DO_ESTADO } from '../componentes/status';
import { Colecao, type PropsColecao } from './Colecao';
import { type Item, NOME_SUBSECAO, NOMES_ESTADO, noEstado, porTipo, type TipoFiltro } from './dados';

export type Base = Pick<PropsColecao, 'formato' | 'tamanho' | 'colunas' | 'ordem' | 'mudarOrdem'>;
type Contagem = Record<EstadoConsumo, number>;

const FOCO = 'outline-none focus-visible:ring-2 focus-visible:ring-marca-texto';

/** Subseções "Anime · N", "Mangá · N", "Jogos · N" só com Tipo "Todos". */
export function Grupos({ itens, tipo, comStatus, base, previa }: { itens: Item[]; tipo: TipoFiltro; comStatus: boolean; base: Base; previa?: number }) {
  const grupos = porTipo(itens, tipo);
  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <div key={g.tipo ?? 'unico'}>
          {g.tipo ? (
            <h3 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-wide text-texto-suave">
              {NOME_SUBSECAO[g.tipo]} <span className="font-normal tabular-nums normal-case tracking-normal opacity-70">{g.itens.length}</span>
            </h3>
          ) : null}
          <Colecao {...base} itens={g.itens} tipo={g.tipo ?? tipo} comStatus={comStatus} previa={previa} />
        </div>
      ))}
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

function TituloStatus({ e, n }: { e: EstadoConsumo; n: number }) {
  return (
    <h2 className="mb-4 flex items-baseline gap-3 text-[22px] font-bold" style={{ color: COR_DO_ESTADO[e] }}>
      {NOMES_ESTADO[e]} <span className="text-[15px] font-normal tabular-nums text-texto-suave">{n}</span>
    </h2>
  );
}

/** Com busca, A e C trocam o Status por uma lista única de resultados, com o selo (Resolution do 34). */
export function Resultados({ itens, tipo, base, termo }: { itens: Item[]; tipo: TipoFiltro; base: Base; termo: string }) {
  return (
    <section aria-label="Resultados da busca">
      <p role="status" className="mb-4 text-[14px] text-texto-suave">
        {itens.length} {itens.length === 1 ? 'resultado' : 'resultados'} para “{termo}” em todos os Status
      </p>
      {itens.length ? <Grupos itens={itens} tipo={tipo} comStatus base={base} /> : <Vazio texto="Nada na sua Lista com esse título." />}
    </section>
  );
}

// ---------------------------------------------------------------- A: abas

export function FaixaAbas({ estados, contagem, ativa, escolher }: { estados: EstadoConsumo[]; contagem: Contagem; ativa: EstadoConsumo; escolher(e: EstadoConsumo): void }) {
  return (
    <div role="tablist" aria-label="Status" className="sem-barra flex gap-6 overflow-x-auto whitespace-nowrap">
      {estados.map((e) => {
        const sel = e === ativa;
        return (
          <button
            key={e}
            type="button"
            role="tab"
            aria-selected={sel}
            onClick={() => escolher(e)}
            className={`relative pb-3 pt-1 text-[15px] font-semibold transition-colors ${FOCO} ${sel ? 'text-texto-forte' : 'text-texto-suave hover:text-texto'}`}
          >
            {NOMES_ESTADO[e]} <span className="font-normal tabular-nums opacity-70">{contagem[e]}</span>
            <span
              aria-hidden
              className={`absolute inset-x-0 bottom-0 h-[3px] rounded-t transition-transform duration-200 ${sel ? 'scale-x-100' : 'scale-x-0'}`}
              style={{ background: COR_DO_ESTADO[e] }}
            />
          </button>
        );
      })}
    </div>
  );
}

export function CorpoStatus({ e, itens, tipo, base }: { e: EstadoConsumo; itens: Item[]; tipo: TipoFiltro; base: Base }) {
  const doStatus = itens.filter((i) => noEstado(i, e));
  return (
    <section key={e} className="motion-safe:animate-[aparecer_180ms_ease-out]">
      <TituloStatus e={e} n={doStatus.length} />
      {doStatus.length ? <Grupos itens={doStatus} tipo={tipo} comStatus={e === 'concluido' && doStatus.some((i) => i.status_consumo === 'platinado')} base={base} /> : <Vazio texto={`Nada em ${NOMES_ESTADO[e]} com esses filtros.`} />}
    </section>
  );
}

// ---------------------------------------------------------------- B: seções empilhadas

/** Qual seção está sob o topo fixo, para o índice acender. */
function useSecaoAtual(estados: EstadoConsumo[]) {
  const [atual, setAtual] = useState<EstadoConsumo | null>(null);
  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const fixo = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fixo')) || 160;
        let achada: EstadoConsumo | null = null;
        for (const e of estados) {
          const el = document.getElementById(`secao-${e}`);
          if (el && el.getBoundingClientRect().top <= fixo + 8) achada = e;
        }
        setAtual(achada ?? estados[0] ?? null);
      });
    };
    medir();
    addEventListener('scroll', medir, { passive: true });
    return () => {
      cancelAnimationFrame(quadro);
      removeEventListener('scroll', medir);
    };
  }, [estados]);
  return atual;
}

export function FaixaIndice({ estados, contagem, recolhidas, alternarTodas }: { estados: EstadoConsumo[]; contagem: Contagem; recolhidas: Set<EstadoConsumo>; alternarTodas(): void }) {
  const atual = useSecaoAtual(estados);
  return (
    <div className="flex items-center gap-2 pb-3">
      <nav aria-label="Ir para o Status" className="sem-barra flex flex-1 gap-1.5 overflow-x-auto">
        {estados.map((e) => {
          const sel = atual === e;
          return (
            <a
              key={e}
              href={`#secao-${e}`}
              onClick={(ev) => {
                ev.preventDefault();
                document.getElementById(`secao-${e}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
              }}
              aria-current={sel ? 'location' : undefined}
              className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors ${FOCO} ${
                sel ? 'border-transparent bg-superficie-alta text-texto-forte' : 'border-borda text-texto-suave hover:text-texto-forte'
              } ${contagem[e] ? '' : 'opacity-40'}`}
            >
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: COR_DO_ESTADO[e] }} />
              {NOMES_ESTADO[e]}
              <span className="tabular-nums opacity-70">{contagem[e]}</span>
            </a>
          );
        })}
      </nav>
      <button type="button" onClick={alternarTodas} className={`shrink-0 rounded-md px-2 py-1 text-[13px] font-semibold text-texto-suave hover:text-texto-forte ${FOCO}`}>
        {recolhidas.size ? 'Expandir tudo' : 'Recolher tudo'}
      </button>
    </div>
  );
}

export function CorpoSecoes({ estados, itens, tipo, base, recolhidas, alternar }: { estados: EstadoConsumo[]; itens: Item[]; tipo: TipoFiltro; base: Base; recolhidas: Set<EstadoConsumo>; alternar(e: EstadoConsumo): void }) {
  const secoes = estados.map((e) => ({ e, itens: itens.filter((i) => noEstado(i, e)) })).filter((s) => s.itens.length);
  if (!secoes.length) return <Vazio texto="Nada na Lista com esses filtros." />;
  return (
    <div className="flex flex-col gap-8">
      {secoes.map(({ e, itens: doStatus }) => {
        const fechada = recolhidas.has(e);
        return (
          <section key={e} id={`secao-${e}`} aria-label={NOMES_ESTADO[e]} style={{ scrollMarginTop: 'var(--fixo)' }}>
            <h2 className="sticky z-20 -mx-2 mb-3 bg-fundo/95 px-2 backdrop-blur" style={{ top: 'var(--fixo)' }}>
              <button
                type="button"
                aria-expanded={!fechada}
                onClick={() => alternar(e)}
                className={`group flex w-full items-center gap-3 border-b py-2.5 text-left ${FOCO}`}
                style={{ borderColor: `color-mix(in srgb, ${COR_DO_ESTADO[e]} 35%, transparent)` }}
              >
                <span aria-hidden className="h-5 w-1 rounded-full" style={{ background: COR_DO_ESTADO[e] }} />
                <span className="text-[18px] font-bold" style={{ color: COR_DO_ESTADO[e] }}>
                  {NOMES_ESTADO[e]}
                </span>
                <span className="text-[14px] tabular-nums text-texto-suave">{doStatus.length}</span>
                <span className="ml-auto flex items-center gap-1 text-[12px] text-texto-suave opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {fechada ? 'Expandir' : 'Recolher'}
                </span>
                <Icone nome="baixo" tamanho={16} className={`text-texto-suave transition-transform duration-200 ${fechada ? '-rotate-90' : ''}`} />
              </button>
            </h2>
            <div className={`grid transition-[grid-template-rows] duration-200 ${fechada ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}>
              <div className={fechada ? 'overflow-hidden' : ''}>{fechada ? null : <Grupos itens={doStatus} tipo={tipo} comStatus={e === 'concluido'} base={base} />}</div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- C: coluna de Status

export function LateralStatus({ estados, contagem, ativa, escolher }: { estados: EstadoConsumo[]; contagem: Contagem; ativa: EstadoConsumo; escolher(e: EstadoConsumo): void }) {
  return (
    <nav aria-label="Status" className="flex gap-1 overflow-x-auto lg:flex-col">
      {estados.map((e) => {
        const sel = e === ativa;
        return (
          <button
            key={e}
            type="button"
            aria-current={sel ? 'page' : undefined}
            onClick={() => escolher(e)}
            className={`relative flex h-10 shrink-0 items-center gap-2.5 rounded-md pl-3 pr-2 text-left text-[14px] transition-colors ${FOCO} ${
              sel ? 'bg-superficie-alta font-semibold text-texto-forte' : 'text-texto hover:bg-superficie'
            }`}
          >
            <span aria-hidden className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-opacity ${sel ? 'opacity-100' : 'opacity-0'}`} style={{ background: COR_DO_ESTADO[e] }} />
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: COR_DO_ESTADO[e] }} />
            <span className="flex-1 whitespace-nowrap">{NOMES_ESTADO[e]}</span>
            <span className="ml-3 tabular-nums text-[13px] text-texto-suave">{contagem[e]}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------- D: fileiras

const LARGURA_FILEIRA: Record<string, number> = { '1': 300, '3': 152, '4': 380 };

function Trilho({ itens, base, verTodos }: { itens: Item[]; base: Base & { formatoFileira: string }; verTodos(): void }) {
  const trilho = useRef<HTMLDivElement>(null);
  const largura = LARGURA_FILEIRA[base.formatoFileira] ?? 152;
  const rolar = (d: 1 | -1) => trilho.current?.scrollBy({ left: d * trilho.current.clientWidth * 0.85, behavior: 'smooth' });
  const mostrados = itens.slice(0, 12);
  return (
    <div className="group/trilho relative">
      <div ref={trilho} className="sem-barra -mx-1 flex snap-x gap-4 overflow-x-auto scroll-smooth px-1 pb-1">
        {mostrados.map((i) => (
          <div key={i.id_lista} className="shrink-0 snap-start" style={{ width: largura }}>
            <Colecao {...base} formato={base.formatoFileira} tamanho="ii" colunas={false} itens={[i]} tipo={i.tipo} comStatus={false} />
          </div>
        ))}
        {itens.length > mostrados.length ? (
          <button
            type="button"
            onClick={verTodos}
            className={`flex shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-borda text-[13px] font-semibold text-texto-suave transition-colors hover:border-marca-texto hover:text-marca-texto ${FOCO}`}
            style={{ width: Math.min(largura, 160), minHeight: 120 }}
          >
            <Icone nome="direita" />
            Ver todos ({itens.length})
          </button>
        ) : null}
      </div>
      {(['esquerda', 'direita'] as const).map((lado) => (
        <button
          key={lado}
          type="button"
          aria-label={lado === 'esquerda' ? 'Rolar para trás' : 'Rolar para a frente'}
          onClick={() => rolar(lado === 'esquerda' ? -1 : 1)}
          className={`absolute top-1/3 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-superficie-alta/95 text-texto-forte shadow-lg opacity-0 transition-opacity group-hover/trilho:opacity-100 focus-visible:opacity-100 md:flex ${lado === 'esquerda' ? '-left-3' : '-right-3'}`}
        >
          <Icone nome={lado} />
        </button>
      ))}
    </div>
  );
}

export function CorpoFileiras({ estados, itens, base, foco, focar, tipo }: { estados: EstadoConsumo[]; itens: Item[]; base: Base & { formatoFileira: string }; foco: EstadoConsumo | null; focar(e: EstadoConsumo | null): void; tipo: TipoFiltro }) {
  if (foco) {
    return (
      <div className="motion-safe:animate-[aparecer_180ms_ease-out]">
        <button type="button" onClick={() => focar(null)} className={`mb-4 inline-flex items-center gap-1 text-[14px] font-semibold text-texto-suave hover:text-texto-forte ${FOCO}`}>
          <Icone nome="esquerda" tamanho={16} /> Todas as fileiras
        </button>
        <CorpoStatus e={foco} itens={itens} tipo={tipo} base={base} />
      </div>
    );
  }
  const fileiras = estados.map((e) => ({ e, itens: itens.filter((i) => noEstado(i, e)) })).filter((f) => f.itens.length);
  if (!fileiras.length) return <Vazio texto="Nada na Lista com esses filtros." />;
  return (
    <div className="flex flex-col gap-9">
      {fileiras.map(({ e, itens: doStatus }) => (
        <section key={e} aria-label={NOMES_ESTADO[e]}>
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="text-[19px] font-bold" style={{ color: COR_DO_ESTADO[e] }}>
              {NOMES_ESTADO[e]}
            </h2>
            <span className="text-[14px] tabular-nums text-texto-suave">{doStatus.length}</span>
            <button type="button" onClick={() => focar(e)} className={`ml-auto text-[13px] font-semibold text-texto-suave hover:text-marca-texto ${FOCO}`}>
              Ver todos →
            </button>
          </div>
          <Trilho itens={doStatus} base={base} verTodos={() => focar(e)} />
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- E: quadro

function Coluna({ e, itens, base }: { e: EstadoConsumo; itens: Item[]; base: Base }) {
  const rolagem = useRef<HTMLDivElement>(null);
  return (
    <section aria-label={NOMES_ESTADO[e]} className="flex w-[300px] shrink-0 flex-col rounded-xl bg-superficie/50">
      <h2 className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: `color-mix(in srgb, ${COR_DO_ESTADO[e]} 40%, transparent)` }}>
        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: COR_DO_ESTADO[e] }} />
        <span className="text-[15px] font-bold" style={{ color: COR_DO_ESTADO[e] }}>
          {NOMES_ESTADO[e]}
        </span>
        <span className="ml-auto text-[13px] tabular-nums text-texto-suave">{itens.length}</span>
      </h2>
      <div ref={rolagem} className="overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - var(--fixo) - 64px)' }}>
        {itens.length ? (
          <PropsEstreitas base={base} itens={itens} rolagem={rolagem} />
        ) : (
          <p className="px-2 py-6 text-center text-[13px] text-texto-suave">Vazio</p>
        )}
      </div>
    </section>
  );
}

function PropsEstreitas({ base, itens, rolagem }: { base: Base; itens: Item[]; rolagem: React.RefObject<HTMLDivElement | null> }) {
  return <Colecao {...base} itens={itens} tipo="todos" comStatus={false} estreito rolagem={rolagem} />;
}

export function CorpoQuadro({ estados, itens, base }: { estados: EstadoConsumo[]; itens: Item[]; base: Base }) {
  return (
    <div className="sem-barra -mx-6 flex gap-3 overflow-x-auto px-6 pb-4 lg:-mx-10 lg:px-10">
      {estados.map((e) => (
        <Coluna key={e} e={e} itens={itens.filter((i) => noEstado(i, e))} base={base} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- F: lista única

export function FaixaChips({ estados, contagem, marcados, mudar }: { estados: EstadoConsumo[]; contagem: Contagem; marcados: EstadoConsumo[]; mudar(m: EstadoConsumo[]): void }) {
  const alternar = (e: EstadoConsumo) => mudar(marcados.includes(e) ? marcados.filter((x) => x !== e) : [...marcados, e]);
  return (
    <div className="sem-barra flex items-center gap-1.5 overflow-x-auto pb-3" role="group" aria-label="Status">
      <button
        type="button"
        aria-pressed={!marcados.length}
        onClick={() => mudar([])}
        className={`h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold transition-colors ${FOCO} ${
          marcados.length ? 'border-borda text-texto-suave hover:text-texto-forte' : 'border-transparent bg-superficie-alta text-texto-forte'
        }`}
      >
        Todos os Status
      </button>
      {estados.map((e) => {
        const sel = marcados.includes(e);
        const cor = COR_DO_ESTADO[e];
        return (
          <button
            key={e}
            type="button"
            aria-pressed={sel}
            onClick={() => alternar(e)}
            className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors ${FOCO}`}
            style={
              sel
                ? { borderColor: `color-mix(in srgb, ${cor} 60%, transparent)`, background: `color-mix(in srgb, ${cor} 16%, transparent)`, color: cor, fontWeight: 600 }
                : { borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }
            }
          >
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: cor }} />
            {NOMES_ESTADO[e]}
            <span className="tabular-nums opacity-70">{contagem[e]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CorpoUnica({ itens, tipo, base }: { itens: Item[]; tipo: TipoFiltro; base: Base }) {
  if (!itens.length) return <Vazio texto="Nada na Lista com esses filtros." />;
  return <Grupos itens={itens} tipo={tipo} comStatus base={base} />;
}
