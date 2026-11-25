// PROTÓTIPO (ticket 39, 2ª rodada): a coluna lateral (navegação C + filtros c), de cima
// para baixo: busca, Tipo (com tipo=lateral), Status com "Todos", Gênero, Situação e Ordem.
// Também o segmentado de Tipo do topo (tipo=topo) e o alternador de Formato.
import { useState } from 'react';

import type { EstadoConsumo } from '@dominio/estadoConsumo';

import { Icone } from '../componentes/Icone';
import { COR_DO_ESTADO } from '../componentes/status';
import { ASCENDENTE, ativos, type Contagem, type Filtros, nomeDaOrdem, NOMES_ESTADO, type Ordem, ORDENS, type TipoFiltro } from './dados';
import { FOCO } from './Itens';
import type { Formato } from './variantes';

export type StatusEscolhido = 'todos' | EstadoConsumo;

export type PropsFiltros = {
  f: Filtros;
  mudar(p: Partial<Filtros>): void;
  opcoes: { generos: string[]; situacoes: { valor: string; titulo: string }[] };
  contagemTipo: Record<TipoFiltro, number>;
};

const TIPOS: { v: TipoFiltro; nome: string }[] = [
  { v: 'todos', nome: 'Todos' },
  { v: 'anime', nome: 'Anime' },
  { v: 'manga', nome: 'Mangá' },
  { v: 'jogo', nome: 'Jogos' },
];

const trocarTipo = (v: TipoFiltro): Partial<Filtros> => ({ tipo: v, genero: null, situacao: null });

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave">{children}</h2>;
}

// ---------------------------------------------------------------- busca

export function CampoBusca({ f, mudar }: Pick<PropsFiltros, 'f' | 'mudar'>) {
  return (
    <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-borda bg-superficie px-3 transition-colors focus-within:border-marca-texto">
      <Icone nome="busca" tamanho={15} className="shrink-0 text-texto-suave" />
      <input
        type="search"
        value={f.busca}
        onChange={(e) => mudar({ busca: e.target.value })}
        onKeyDown={(e) => e.key === 'Escape' && mudar({ busca: '' })}
        placeholder="Buscar na Lista"
        aria-label="Buscar na Lista"
        className="min-w-0 flex-1 bg-transparent text-[14px] text-texto-forte placeholder:text-texto-suave focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {f.busca ? (
        <button type="button" aria-label="Limpar busca" onClick={() => mudar({ busca: '' })} className={`rounded text-texto-suave hover:text-texto-forte ${FOCO}`}>
          <Icone nome="fechar" tamanho={14} />
        </button>
      ) : null}
    </label>
  );
}

// ---------------------------------------------------------------- Tipo

/** Na coluna: 4 botões iguais, nome e contagem, cabem nos 232 px. */
export function TipoColuna({ f, mudar, contagemTipo }: PropsFiltros) {
  return (
    <section aria-labelledby="titulo-tipo">
      <Titulo>
        <span id="titulo-tipo">Tipo</span>
      </Titulo>
      <div role="radiogroup" aria-labelledby="titulo-tipo" className="grid grid-cols-4 gap-0.5 rounded-lg bg-superficie p-1">
        {TIPOS.map(({ v, nome }) => {
          const marcado = f.tipo === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={marcado}
              onClick={() => mudar(trocarTipo(v))}
              className={`flex flex-col items-center rounded-md py-1.5 text-[12.5px] font-semibold leading-tight transition-colors ${FOCO} ${
                marcado ? 'bg-superficie-alta text-texto-forte shadow-sm' : 'text-texto-suave hover:text-texto-forte'
              }`}
            >
              {nome}
              <span className="text-[11px] font-normal tabular-nums opacity-70">{contagemTipo[v]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** No topo (tipo=topo): o segmentado da 1ª rodada. */
export function SegmentadoTipo({ f, mudar, contagemTipo }: PropsFiltros) {
  return (
    <div role="radiogroup" aria-label="Tipo" className="inline-flex h-10 shrink-0 rounded-lg bg-superficie p-1">
      {TIPOS.map(({ v, nome }) => {
        const marcado = f.tipo === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={marcado}
            onClick={() => mudar(trocarTipo(v))}
            className={`rounded-md px-3 text-[13px] font-semibold transition-colors ${FOCO} ${marcado ? 'bg-superficie-alta text-texto-forte shadow-sm' : 'text-texto-suave hover:text-texto-forte'}`}
          >
            {nome}
            <span className={`ml-1.5 text-[11px] font-normal tabular-nums ${marcado ? 'text-texto-suave' : 'opacity-60'}`}>{contagemTipo[v]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Status

export function ListaStatus({ estados, contagem, total, ativa, escolher }: { estados: EstadoConsumo[]; contagem: Contagem; total: number; ativa: StatusEscolhido; escolher(e: StatusEscolhido): void }) {
  const linha = (e: StatusEscolhido, nome: string, n: number, cor: string | null) => {
    const sel = e === ativa;
    return (
      <li key={e}>
        <button
          type="button"
          aria-current={sel ? 'true' : undefined}
          onClick={() => escolher(e)}
          className={`relative flex h-9 items-center gap-2.5 lg:w-full rounded-md pl-3 pr-2 text-left text-[14px] transition-colors ${FOCO} ${
            sel ? 'bg-superficie-alta font-semibold text-texto-forte' : 'text-texto hover:bg-superficie'
          } ${n ? '' : 'opacity-50'}`}
        >
          <span aria-hidden className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-full transition-opacity ${sel ? 'opacity-100' : 'opacity-0'}`} style={{ background: cor ?? 'var(--cor-texto-forte)' }} />
          {cor ? <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} /> : <span aria-hidden className="h-2 w-2 shrink-0 rounded-full border border-texto-suave" />}
          <span className="flex-1 whitespace-nowrap">{nome}</span>
          <span className="tabular-nums text-[13px] text-texto-suave">{n}</span>
        </button>
      </li>
    );
  };
  return (
    <nav aria-labelledby="titulo-status">
      <Titulo>
        <span id="titulo-status">Status</span>
      </Titulo>
      <ul className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap lg:gap-0.5">
        {linha('todos', 'Todos', total, null)}
        {estados.map((e) => linha(e, NOMES_ESTADO[e], contagem[e], COR_DO_ESTADO[e]))}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------- filtros e Ordem

function Chip({ ativo, children, aoClicar }: { ativo: boolean; children: React.ReactNode; aoClicar(): void }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[12.5px] whitespace-nowrap transition-colors ${FOCO} ${
        ativo ? 'border-marca-texto bg-marca/25 font-semibold text-texto-forte' : 'border-borda text-texto hover:border-texto-suave hover:text-texto-forte'
      }`}
    >
      {children}
      {ativo ? <Icone nome="fechar" tamanho={11} /> : null}
    </button>
  );
}

const GENEROS_VISIVEIS = 10;

export function FiltrosColuna({ f, mudar, opcoes }: PropsFiltros) {
  const [todos, setTodos] = useState(false);
  const generos = todos ? opcoes.generos : opcoes.generos.slice(0, GENEROS_VISIVEIS);
  // O gênero escolhido fica visível mesmo fora dos 10 primeiros.
  if (f.genero && !generos.includes(f.genero)) generos.push(f.genero);
  return (
    <>
      <section aria-label="Gênero">
        <Titulo>Gênero</Titulo>
        <div className="flex flex-wrap gap-1.5">
          {generos.map((g) => (
            <Chip key={g} ativo={f.genero === g} aoClicar={() => mudar({ genero: f.genero === g ? null : g })}>
              {g}
            </Chip>
          ))}
          {opcoes.generos.length > GENEROS_VISIVEIS ? (
            <button type="button" onClick={() => setTodos((t) => !t)} aria-expanded={todos} className={`rounded px-1.5 text-[12.5px] font-semibold text-marca-texto hover:underline ${FOCO}`}>
              {todos ? 'Menos' : `+${opcoes.generos.length - GENEROS_VISIVEIS}`}
            </button>
          ) : null}
        </div>
      </section>
      <section aria-label="Situação">
        <Titulo>Situação</Titulo>
        <div className="flex flex-wrap gap-1.5">
          {opcoes.situacoes.map((s) => (
            <Chip key={s.valor} ativo={f.situacao === s.valor} aoClicar={() => mudar({ situacao: f.situacao === s.valor ? null : s.valor })}>
              {s.titulo}
            </Chip>
          ))}
        </div>
      </section>
      {ativos(f) ? (
        <button type="button" onClick={() => mudar({ genero: null, situacao: null })} className={`-mt-3 self-start rounded px-1 text-[13px] font-semibold text-marca-texto hover:underline ${FOCO}`}>
          Limpar filtros
        </button>
      ) : null}
    </>
  );
}

export function OrdemColuna({ f, mudar }: Pick<PropsFiltros, 'f' | 'mudar'>) {
  const subindo = ASCENDENTE[f.ordem] !== f.inversa;
  return (
    <section aria-label="Ordem">
      <Titulo>Ordem</Titulo>
      <div className="flex gap-1.5">
        <label className="relative flex h-10 min-w-0 flex-1 items-center rounded-lg border border-borda bg-superficie pl-3 pr-8 text-[13px] transition-colors focus-within:border-marca-texto">
          <select
            value={f.ordem}
            onChange={(e) => mudar({ ordem: e.target.value as Ordem, inversa: false })}
            aria-label="Ordem"
            className="w-full min-w-0 appearance-none truncate bg-transparent font-semibold text-texto-forte focus:outline-none"
          >
            {ORDENS.map((o) => (
              <option key={o} value={o} className="bg-superficie">
                {nomeDaOrdem(o, f.tipo)}
              </option>
            ))}
          </select>
          <Icone nome="baixo" tamanho={14} className="pointer-events-none absolute right-2.5 text-texto-suave" />
        </label>
        <button
          type="button"
          onClick={() => mudar({ inversa: !f.inversa })}
          aria-label={`Direção: ${subindo ? 'crescente' : 'decrescente'}. Inverter`}
          title="Inverter a direção"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-borda bg-superficie text-[16px] text-texto-forte hover:border-texto-suave ${FOCO}`}
        >
          {subindo ? '↑' : '↓'}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- alternador de Formato

const ICONES: Record<Formato, React.ReactNode> = {
  '3': (
    <>
      <rect x="3" y="3" width="7.5" height="11" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="11" rx="1.5" />
      <path d="M3 18h7.5M13.5 18h7.5M3 21h5M13.5 21h5" />
    </>
  ),
  '2': (
    <>
      <rect x="3" y="4" width="4" height="6" rx="1" />
      <rect x="3" y="14" width="4" height="6" rx="1" />
      <path d="M10 6h11M10 9h6M10 16h11M10 19h6" />
    </>
  ),
  '5': <path d="M3 5h18M3 9.5h18M3 14h18M3 18.5h18" />,
};
const NOMES_FORMATO: Record<Formato, string> = { '3': 'Grade de capas', '2': 'Linhas compactas', '5': 'Só texto' };

export function AlternadorFormato({ formato, mudar }: { formato: Formato; mudar(f: Formato): void }) {
  return (
    <div role="group" aria-label="Formato da Lista" className="inline-flex h-10 shrink-0 rounded-lg bg-superficie p-1">
      {(['3', '2', '5'] as const).map((v) => {
        const marcado = formato === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={marcado}
            aria-label={NOMES_FORMATO[v]}
            title={NOMES_FORMATO[v]}
            onClick={() => mudar(v)}
            className={`flex w-9 items-center justify-center rounded-md transition-colors ${FOCO} ${marcado ? 'bg-superficie-alta text-texto-forte shadow-sm' : 'text-texto-suave hover:text-texto-forte'}`}
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {ICONES[v]}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
