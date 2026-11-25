// PROTÓTIPO (ticket 39, Q120): os 3 lugares dos filtros (sheet, barra fixa, coluna), o
// segmentado de Tipo (em todas) e o índice A–Z.
import { useEffect, useRef, useState } from 'react';

import { Sheet } from '../componentes/Camada';
import { Icone } from '../componentes/Icone';
import { ativos, type Filtros, nomeDaOrdem, type Ordem, ORDENS, type TipoFiltro } from './dados';

export type PropsFiltros = {
  f: Filtros;
  mudar(p: Partial<Filtros>): void;
  opcoes: { generos: string[]; situacoes: { valor: string; titulo: string }[] };
  contagemTipo: Record<TipoFiltro, number>;
};

const FOCO = 'outline-none focus-visible:ring-2 focus-visible:ring-marca-texto';

const TIPOS: { v: TipoFiltro; nome: string }[] = [
  { v: 'todos', nome: 'Todos' },
  { v: 'anime', nome: 'Anime' },
  { v: 'manga', nome: 'Mangá' },
  { v: 'jogo', nome: 'Jogos' },
];

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
            onClick={() => mudar({ tipo: v, genero: null, situacao: null })}
            className={`relative rounded-md px-3 text-[13px] font-semibold transition-colors ${FOCO} ${
              marcado ? 'bg-superficie-alta text-texto-forte shadow-sm' : 'text-texto-suave hover:text-texto-forte'
            }`}
          >
            {nome}
            <span className={`ml-1.5 text-[11px] font-normal tabular-nums ${marcado ? 'text-texto-suave' : 'opacity-60'}`}>{contagemTipo[v]}</span>
          </button>
        );
      })}
    </div>
  );
}

function CampoBusca({ f, mudar, largura = 'w-64' }: Pick<PropsFiltros, 'f' | 'mudar'> & { largura?: string }) {
  return (
    <label className={`flex h-10 items-center gap-2 rounded-lg border border-borda bg-superficie px-3 transition-colors focus-within:border-marca-texto ${largura}`}>
      <Icone nome="busca" tamanho={15} className="shrink-0 text-texto-suave" />
      <input
        value={f.busca}
        onChange={(e) => mudar({ busca: e.target.value })}
        onKeyDown={(e) => e.key === 'Escape' && mudar({ busca: '' })}
        placeholder="Buscar na Lista"
        aria-label="Buscar na Lista"
        className="min-w-0 flex-1 bg-transparent text-[14px] text-texto-forte placeholder:text-texto-suave focus:outline-none"
      />
      {f.busca ? (
        <button type="button" aria-label="Limpar busca" onClick={() => mudar({ busca: '' })} className="text-texto-suave hover:text-texto-forte">
          <Icone nome="fechar" tamanho={14} />
        </button>
      ) : null}
    </label>
  );
}

function SeletorOrdem({ f, mudar }: Pick<PropsFiltros, 'f' | 'mudar'>) {
  return (
    <label className="relative flex h-10 shrink-0 items-center gap-2 rounded-lg border border-borda bg-superficie pl-3 pr-8 text-[13px] text-texto-suave transition-colors focus-within:border-marca-texto">
      <span className="hidden sm:inline">Ordem</span>
      <select
        value={f.ordem}
        onChange={(e) => mudar({ ordem: e.target.value as Ordem })}
        aria-label="Ordem"
        className="appearance-none bg-transparent font-semibold text-texto-forte focus:outline-none"
      >
        {ORDENS.map((o) => (
          <option key={o} value={o} className="bg-superficie">
            {nomeDaOrdem(o, f.tipo)}
          </option>
        ))}
      </select>
      <Icone nome="baixo" tamanho={14} className="pointer-events-none absolute right-2.5" />
    </label>
  );
}

function Chip({ ativo, children, aoClicar }: { ativo: boolean; children: React.ReactNode; aoClicar(): void }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors ${FOCO} ${
        ativo ? 'border-marca-texto bg-marca/25 font-semibold text-texto-forte' : 'border-borda text-texto hover:border-texto-suave hover:text-texto-forte'
      }`}
    >
      {children}
      {ativo ? <Icone nome="fechar" tamanho={12} /> : null}
    </button>
  );
}

/** Gêneros extras num menu, para a faixa não virar parede de chips. */
function MaisGeneros({ resto, f, mudar }: { resto: string[]; f: Filtros; mudar: PropsFiltros['mudar'] }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);
  if (!resto.length) return null;
  const escolhido = f.genero !== null && resto.includes(f.genero);
  return (
    <div ref={caixa} className="relative">
      <Chip ativo={escolhido} aoClicar={() => (escolhido ? mudar({ genero: null }) : setAberto((a) => !a))}>
        {escolhido ? f.genero : `+${resto.length}`}
        {escolhido ? null : <Icone nome="baixo" tamanho={12} />}
      </Chip>
      {aberto ? (
        <div className="absolute left-0 z-40 mt-1 grid max-h-72 w-72 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-borda bg-superficie-alta p-2 shadow-2xl motion-safe:animate-[surgir_120ms_ease-out]">
          {resto.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                mudar({ genero: g });
                setAberto(false);
              }}
              className="truncate rounded px-2 py-1.5 text-left text-[13px] text-texto hover:bg-superficie hover:text-texto-forte"
            >
              {g}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- (b) barra fixa

export function BarraFiltros(p: PropsFiltros) {
  const { f, mudar, opcoes } = p;
  const visiveis = opcoes.generos.slice(0, 7);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <CampoBusca f={f} mudar={mudar} />
        <SegmentadoTipo {...p} />
        <div className="ml-auto">
          <SeletorOrdem f={f} mudar={mudar} />
        </div>
      </div>
      <div className="sem-barra -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
        <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-texto-suave">Gênero</span>
        {visiveis.map((g) => (
          <Chip key={g} ativo={f.genero === g} aoClicar={() => mudar({ genero: f.genero === g ? null : g })}>
            {g}
          </Chip>
        ))}
        <MaisGeneros resto={opcoes.generos.slice(7)} f={f} mudar={mudar} />
        <span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-borda" />
        <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-texto-suave">Situação</span>
        {opcoes.situacoes.map((s) => (
          <Chip key={s.valor} ativo={f.situacao === s.valor} aoClicar={() => mudar({ situacao: f.situacao === s.valor ? null : s.valor })}>
            {s.titulo}
          </Chip>
        ))}
        {ativos(f) ? (
          <button type="button" onClick={() => mudar({ genero: null, situacao: null })} className="ml-2 shrink-0 text-[13px] font-semibold text-marca-texto hover:underline">
            Limpar
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- (a) sheet (controle)

function Radios<T extends string>({ titulo, opcoes, valor, mudar }: { titulo: string; opcoes: { v: T; nome: string }[]; valor: T; mudar(v: T): void }) {
  return (
    <fieldset className="flex flex-col gap-0.5">
      <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-texto-suave">{titulo}</legend>
      {opcoes.map((o) => (
        <label key={o.v} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[14px] text-texto hover:bg-superficie-alta">
          <input type="radio" checked={valor === o.v} onChange={() => mudar(o.v)} className="accent-[var(--cor-marca)]" />
          <span className={valor === o.v ? 'font-semibold text-texto-forte' : ''}>{o.nome}</span>
        </label>
      ))}
    </fieldset>
  );
}

function ConteudoFiltros({ f, mudar, opcoes, generosVisiveis = 12 }: PropsFiltros & { generosVisiveis?: number }) {
  const [todos, setTodos] = useState(false);
  const generos = todos ? opcoes.generos : opcoes.generos.slice(0, generosVisiveis);
  return (
    <div className="flex flex-col gap-6">
      <Radios titulo="Ordem" valor={f.ordem} mudar={(ordem) => mudar({ ordem })} opcoes={ORDENS.map((v) => ({ v, nome: nomeDaOrdem(v, f.tipo) }))} />
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-texto-suave">Gênero</p>
        <div className="flex flex-wrap gap-1.5">
          {generos.map((g) => (
            <Chip key={g} ativo={f.genero === g} aoClicar={() => mudar({ genero: f.genero === g ? null : g })}>
              {g}
            </Chip>
          ))}
          {opcoes.generos.length > generosVisiveis ? (
            <button type="button" onClick={() => setTodos((t) => !t)} className="px-2 text-[13px] font-semibold text-marca-texto hover:underline">
              {todos ? 'Menos' : `+${opcoes.generos.length - generosVisiveis}`}
            </button>
          ) : null}
        </div>
      </div>
      <Radios
        titulo="Situação"
        valor={f.situacao ?? ''}
        mudar={(v) => mudar({ situacao: v || null })}
        opcoes={[{ v: '', nome: 'Todas' }, ...opcoes.situacoes.map((s) => ({ v: s.valor, nome: s.titulo }))]}
      />
    </div>
  );
}

export function FiltrosSheet(p: PropsFiltros) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState(false);
  const n = ativos(p.f);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentadoTipo {...p} />
      <div className="ml-auto flex items-center gap-2">
        {busca || p.f.busca ? (
          <CampoBusca f={p.f} mudar={p.mudar} largura="w-56" />
        ) : (
          <button type="button" aria-label="Buscar" onClick={() => setBusca(true)} className={`flex h-10 w-10 items-center justify-center rounded-md text-texto-forte hover:bg-superficie-alta ${FOCO}`}>
            <Icone nome="busca" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={`flex h-10 items-center gap-2 rounded-md border border-borda px-3 text-[14px] font-semibold text-texto-forte hover:bg-superficie-alta ${FOCO}`}
        >
          <Icone nome="filtro" tamanho={16} /> Filtros
          {n ? <span className="rounded-full bg-marca px-1.5 text-[12px] font-bold text-sobre-marca">{n}</span> : null}
        </button>
      </div>
      <Sheet titulo="Filtros da Lista" aberto={aberto} fechar={() => setAberto(false)}>
        <ConteudoFiltros {...p} generosVisiveis={20} />
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- (c) coluna

/** Coluna de filtros como no Explorar (o Tipo fica no topo da página). */
export function ColunaFiltros(p: PropsFiltros) {
  return (
    <div className="flex flex-col gap-6">
      <CampoBusca f={p.f} mudar={p.mudar} largura="w-full" />
      <ConteudoFiltros {...p} />
      {ativos(p.f) ? (
        <button type="button" onClick={() => p.mudar({ genero: null, situacao: null })} className="self-start text-[13px] font-semibold text-marca-texto hover:underline">
          Limpar filtros
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- índice A–Z

const LETRAS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

export function IndiceAZ({ existentes, letra, mudar }: { existentes: Set<string>; letra: string | null; mudar(l: string | null): void }) {
  return (
    <nav aria-label="Índice A–Z" className="fixed right-1.5 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center rounded-full bg-superficie/80 px-0.5 py-2 backdrop-blur">
      {LETRAS.map((l) => {
        const tem = existentes.has(l);
        const ativa = letra === l;
        return (
          <button
            key={l}
            type="button"
            disabled={!tem}
            aria-pressed={ativa}
            aria-label={ativa ? `Tirar filtro da inicial ${l}` : `Só a inicial ${l}`}
            onClick={() => mudar(ativa ? null : l)}
            className={`flex h-[19px] w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${FOCO} ${
              ativa ? 'bg-marca text-sobre-marca' : tem ? 'text-texto hover:bg-superficie-alta hover:text-texto-forte' : 'text-texto-suave/30'
            }`}
          >
            {l}
          </button>
        );
      })}
    </nav>
  );
}
