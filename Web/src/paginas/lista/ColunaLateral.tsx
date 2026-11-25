// A coluna lateral da Lista (veredito e Resolution do ticket 39), de cima para baixo: busca,
// Tipo, Status com "Todos", Gênero, Situação e Ordem com a direção.
import { type ReactNode, useState } from 'react';

import { type EstadoConsumo, NOMES_ESTADO } from '@dominio/estadoConsumo';
import { crescente, ORDENS_DA_LISTA, type OrdemLista, type TipoDaLista } from '@dominio/filtrosLista';

import { FOCO } from '../../componentes/estilos';
import { Icone } from '../../componentes/Icone';
import { COR_DO_ESTADO } from '../../componentes/status';
import { nomeDaOrdem, NOMES_TIPO_DA_LISTA, textos } from './textos';

/** O Status escolhido na coluna: um deles ou "todos" (a Lista inteira separada por Status). */
export type StatusEscolhido = 'todos' | EstadoConsumo;

function Titulo({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave">
      {children}
    </h2>
  );
}

// ---------------------------------------------------------------- busca

export function CampoBusca({ valor, mudar }: { valor: string; mudar(valor: string): void }) {
  return (
    <div role="search" className="flex h-10 w-full items-center gap-2 rounded-lg border border-borda bg-superficie px-3 transition-colors focus-within:border-marca-texto">
      <Icone nome="busca" tamanho={15} className="shrink-0 text-texto-suave" />
      <input
        type="search"
        value={valor}
        onChange={(e) => mudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && valor) {
            e.preventDefault();
            mudar('');
          }
        }}
        placeholder={textos.buscar}
        aria-label={textos.buscar}
        className="min-w-0 flex-1 bg-transparent text-[14px] text-texto-forte placeholder:text-texto-suave focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {valor ? (
        <button type="button" aria-label={textos.limparBusca} onClick={() => mudar('')} className={`rounded text-texto-suave hover:text-texto-forte ${FOCO}`}>
          <Icone nome="fechar" tamanho={14} />
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Tipo

const TIPOS_DA_LISTA: readonly TipoDaLista[] = ['todos', 'anime', 'manga', 'jogo'];

/** Quatro opções iguais com a contagem, que cabem na coluna; rádios nativos (setas do teclado). */
export function SeletorTipo({ tipo, contagem, mudar }: { tipo: TipoDaLista; contagem: Record<TipoDaLista, number>; mudar(t: TipoDaLista): void }) {
  return (
    <fieldset>
      <legend className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave">{textos.tipo}</legend>
      <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-superficie p-1">
        {TIPOS_DA_LISTA.map((t) => (
          <label
            key={t}
            className={`flex cursor-pointer flex-col items-center rounded-md py-1.5 text-[12.5px] font-semibold leading-tight transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-marca-texto ${
              tipo === t ? 'bg-superficie-alta text-texto-forte shadow-sm' : 'text-texto-suave hover:text-texto-forte'
            }`}
          >
            <input type="radio" name="tipo-da-lista" value={t} checked={tipo === t} onChange={() => mudar(t)} className="sr-only" />
            {NOMES_TIPO_DA_LISTA[t]}{' '}
            <span className="text-[11px] font-normal tabular-nums opacity-70">{contagem[t]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------- Status

type PropsStatus = {
  estados: readonly EstadoConsumo[];
  contagem: Record<EstadoConsumo, number>;
  total: number;
  ativo: StatusEscolhido;
  escolher(s: StatusEscolhido): void;
};

export function ListaStatus({ estados, contagem, total, ativo, escolher }: PropsStatus) {
  const linha = (s: StatusEscolhido, nome: string, n: number, cor: string | null) => {
    const marcado = s === ativo;
    return (
      <li key={s}>
        <button
          type="button"
          aria-current={marcado ? 'true' : undefined}
          onClick={() => escolher(s)}
          className={`relative flex h-9 items-center gap-2.5 rounded-md pl-3 pr-2 text-left text-[14px] transition-colors lg:w-full ${FOCO} ${
            marcado ? 'bg-superficie-alta font-semibold text-texto-forte' : 'text-texto hover:bg-superficie'
          } ${n ? '' : 'opacity-60'}`}
        >
          <span
            aria-hidden
            className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-full transition-opacity ${marcado ? 'opacity-100' : 'opacity-0'}`}
            style={{ background: cor ?? 'var(--cor-texto-forte)' }}
          />
          {cor ? (
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} />
          ) : (
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full border border-texto-suave" />
          )}
          <span className="flex-1 whitespace-nowrap">{nome}</span>{' '}
          <span className="text-[13px] tabular-nums text-texto-suave">{n}</span>
        </button>
      </li>
    );
  };
  return (
    <nav aria-labelledby="titulo-status-lista">
      <Titulo id="titulo-status-lista">{textos.status}</Titulo>
      <ul className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap lg:gap-0.5">
        {linha('todos', textos.todos, total, null)}
        {estados.map((e) => linha(e, NOMES_ESTADO[e], contagem[e], COR_DO_ESTADO[e]))}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------- Gênero e Situação

function Chip({ ativo, children, aoClicar }: { ativo: boolean; children: ReactNode; aoClicar(): void }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[12.5px] transition-colors ${FOCO} ${
        ativo ? 'border-marca-texto bg-marca/25 font-semibold text-texto-forte' : 'border-borda text-texto hover:border-texto-suave hover:text-texto-forte'
      }`}
    >
      {children}
      {ativo ? <Icone nome="fechar" tamanho={11} /> : null}
    </button>
  );
}

/** Quantos gêneros aparecem antes do "+N". */
const GENEROS_VISIVEIS = 10;

type PropsFiltros = {
  /** Os mais frequentes primeiro. */
  generos: readonly string[];
  situacoes: readonly { valor: string; titulo: string }[];
  genero: string | null;
  situacao: string | null;
  mudar(m: { genero?: string | null; situacao?: string | null }): void;
};

export function FiltrosColuna({ generos, situacoes, genero, situacao, mudar }: PropsFiltros) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? [...generos] : generos.slice(0, GENEROS_VISIVEIS);
  // O gênero escolhido fica à vista mesmo fora dos primeiros.
  if (genero && !visiveis.includes(genero)) visiveis.push(genero);
  return (
    <>
      {generos.length ? (
        <section aria-labelledby="titulo-genero-lista">
          <Titulo id="titulo-genero-lista">{textos.genero}</Titulo>
          <div className="flex flex-wrap gap-1.5">
            {visiveis.map((g) => (
              <Chip key={g} ativo={genero === g} aoClicar={() => mudar({ genero: genero === g ? null : g })}>
                {g}
              </Chip>
            ))}
            {generos.length > GENEROS_VISIVEIS ? (
              <button
                type="button"
                onClick={() => setTodos((t) => !t)}
                aria-expanded={todos}
                className={`rounded px-1.5 text-[12.5px] font-semibold text-marca-texto hover:underline ${FOCO}`}
              >
                {todos ? textos.menosGeneros : textos.maisGeneros(generos.length - GENEROS_VISIVEIS)}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
      {situacoes.length ? (
        <section aria-labelledby="titulo-situacao-lista">
          <Titulo id="titulo-situacao-lista">{textos.situacao}</Titulo>
          <div className="flex flex-wrap gap-1.5">
            {situacoes.map((s) => (
              <Chip key={s.valor} ativo={situacao === s.valor} aoClicar={() => mudar({ situacao: situacao === s.valor ? null : s.valor })}>
                {s.titulo}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}
      {genero !== null || situacao !== null ? (
        <button
          type="button"
          onClick={() => mudar({ genero: null, situacao: null })}
          className={`-mt-3 self-start rounded px-1 text-[13px] font-semibold text-marca-texto hover:underline ${FOCO}`}
        >
          {textos.limparFiltros}
        </button>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- Ordem

type PropsOrdem = {
  ordem: OrdemLista;
  inversa: boolean;
  tipo: TipoDaLista;
  mudar(m: { ordem: OrdemLista; inversa: boolean }): void;
};

/** Seletor da Ordem e o ↑/↓ ao lado; escolher outra Ordem volta à direção natural dela. */
export function OrdemColuna({ ordem, inversa, tipo, mudar }: PropsOrdem) {
  const subindo = crescente(ordem, inversa);
  return (
    <section aria-labelledby="titulo-ordem-lista">
      <Titulo id="titulo-ordem-lista">{textos.ordem}</Titulo>
      <div className="flex gap-1.5">
        <div className="relative flex h-10 min-w-0 flex-1 items-center rounded-lg border border-borda bg-superficie pl-3 pr-8 text-[13px] transition-colors focus-within:border-marca-texto">
          <select
            value={ordem}
            onChange={(e) => mudar({ ordem: e.target.value as OrdemLista, inversa: false })}
            aria-labelledby="titulo-ordem-lista"
            className="w-full min-w-0 appearance-none truncate bg-transparent font-semibold text-texto-forte focus:outline-none"
          >
            {ORDENS_DA_LISTA.map((o) => (
              <option key={o} value={o} className="bg-superficie">
                {nomeDaOrdem(o, tipo)}
              </option>
            ))}
          </select>
          <Icone nome="baixo" tamanho={14} className="pointer-events-none absolute right-2.5 text-texto-suave" />
        </div>
        <button
          type="button"
          onClick={() => mudar({ ordem, inversa: !inversa })}
          aria-label={textos.direcao(subindo)}
          title={textos.inverter}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-borda bg-superficie text-[16px] text-texto-forte hover:border-texto-suave ${FOCO}`}
        >
          <span aria-hidden>{subindo ? '↑' : '↓'}</span>
        </button>
      </div>
    </section>
  );
}
