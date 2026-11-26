// PROTÓTIPO (ticket 50): moldura da Temporada (nav falsa, título, abas) e as peças que toda
// variante usa: filtro "Só os meus", nota do horário, "Na Lista"/"Planejado", dia vazio.
import type { ReactNode } from 'react';

import { Botao } from '../componentes/Botao';
import { Icone } from '../componentes/Icone';
import { Monograma } from '../componentes/Monograma';
import { useAcoes } from './contexto';
import { NOME_FUSO, NOTA_JAPAO } from './dados';

function NavFalsa() {
  const links = ['Início', 'Explorar', 'Minha Lista', 'Notícias'];
  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center gap-3 border-b border-borda bg-nav px-6 @2xl:gap-8 @2xl:px-12">
      <span className="flex h-11 w-11 items-center justify-center text-texto-forte @4xl:hidden">
        <Icone nome="menu" />
      </span>
      <span className="flex items-center gap-2.5">
        <Monograma tamanho={34} rotulo={null} />
        <span className="hidden text-[20px] font-bold text-texto-forte @4xl:inline">MediaList</span>
      </span>
      <nav aria-label="Principal (falsa)" className="hidden items-center gap-1 text-[16px] @4xl:flex">
        {links.map((l) => (
          <a key={l} href="#" className="flex h-11 items-center rounded-md px-4 font-semibold text-texto-suave hover:bg-superficie-alta hover:text-texto-forte">
            {l}
          </a>
        ))}
      </nav>
      <span className="ml-auto flex items-center gap-4 text-texto-suave">
        <Icone nome="busca" />
        <Icone nome="sino" />
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-superficie-alta text-[13px] font-bold text-texto-forte">A</span>
      </span>
    </header>
  );
}

function Abas() {
  return (
    <div role="tablist" aria-label="Temporada" className="flex gap-6 border-b border-borda text-[16px] font-semibold">
      {['Animes', 'Calendário'].map((a) => (
        <button
          key={a}
          role="tab"
          type="button"
          aria-selected={a === 'Calendário'}
          onClick={() => a === 'Animes' && alert('PROTÓTIPO: voltaria para a grade de animes')}
          className={`relative -mb-px pb-3 ${a === 'Calendário' ? 'text-texto-forte' : 'text-texto-suave hover:text-texto-forte'}`}
        >
          {a}
          {a === 'Calendário' ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-marca" /> : null}
        </button>
      ))}
    </div>
  );
}

export function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavFalsa />
      <div className="flex flex-col gap-6 px-4 pb-32 pt-6 @2xl:px-12">
        <header className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[14px] font-semibold text-texto-suave">Temporada de anime</p>
              <h1 className="text-[28px] font-bold text-texto-forte">Outono 2026</h1>
            </div>
            <div className="hidden flex-wrap items-center gap-2 @2xl:flex">
              <Botao variante="secundario" icone={<Icone nome="esquerda" tamanho={16} />}>
                Anterior
              </Botao>
              <Botao variante="secundario" disabled>
                Atual
              </Botao>
              <Botao variante="secundario">
                Próxima <Icone nome="direita" tamanho={16} />
              </Botao>
            </div>
          </div>
          <Abas />
        </header>
        {children}
      </div>
    </div>
  );
}

/** Interruptor "Só os meus". */
export function FiltroMeus() {
  const { soOsMeus, mudarFiltro } = useAcoes();
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-texto-forte">
      <input type="checkbox" className="peer sr-only" checked={soOsMeus} onChange={(e) => mudarFiltro(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-6 w-10 rounded-full bg-superficie-alta ring-1 ring-borda transition peer-checked:bg-marca peer-focus-visible:ring-2 peer-focus-visible:ring-marca-texto after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4"
      />
      Só os meus
    </label>
  );
}

export function NotaHorario({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[12px] text-texto-suave ${className}`}>
      Horários de {NOME_FUSO} · {NOTA_JAPAO}
    </p>
  );
}

/** A barra padrão: filtro à esquerda, nota à direita. */
export function Controles() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
      <FiltroMeus />
      <NotaHorario />
    </div>
  );
}

/** "Na Lista" para quem tem Item; botão "Planejado" (só em memória) para o resto. */
export function AcaoLista({ id, titulo, compacto = false }: { id: string; titulo: string; compacto?: boolean }) {
  const { lista, planejar } = useAcoes();
  if (lista[id]) return <span className="inline-flex min-h-8 shrink-0 items-center text-[12px] font-semibold text-texto-suave">Na Lista</span>;
  return compacto ? (
    <button
      type="button"
      aria-label={`Pôr ${titulo} em Planejado`}
      onClick={(e) => {
        e.stopPropagation();
        planejar(id);
      }}
      className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md border border-borda px-2 text-[12px] font-bold text-texto-forte hover:bg-superficie-alta"
    >
      <Icone nome="mais" tamanho={12} /> Planejado
    </button>
  ) : (
    <Botao
      variante="secundario"
      aria-label={`Pôr ${titulo} em Planejado`}
      onClick={(e) => {
        e.stopPropagation();
        planejar(id);
      }}
      icone={<Icone nome="mais" tamanho={14} />}
    >
      Planejado
    </Botao>
  );
}

export function DiaVazio({ compacto = false }: { compacto?: boolean }) {
  const { soOsMeus } = useAcoes();
  return (
    <p className={`rounded-md border border-dashed border-borda text-center text-[13px] text-texto-suave ${compacto ? 'px-2 py-4' : 'px-4 py-6'}`}>
      {soOsMeus ? 'Nenhum dos seus sai neste dia.' : 'Nenhum episódio neste dia.'}
    </p>
  );
}

/** Quando o filtro esvazia a semana inteira. */
export function SemanaVazia() {
  const { mudarFiltro } = useAcoes();
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-texto-suave">
      <Monograma tamanho={44} rotulo={null} />
      <p>Nenhum dos seus animes sai nos próximos 7 dias.</p>
      <Botao variante="secundario" onClick={() => mudarFiltro(false)}>
        Ver todos os animes
      </Botao>
    </div>
  );
}

export function Selinho({ children, forte = false }: { children: ReactNode; forte?: boolean }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-sm px-1.5 text-[12px] font-semibold leading-[18px] ${forte ? 'bg-marca text-sobre-marca' : 'border border-borda text-texto-suave'}`}>
      {children}
    </span>
  );
}
