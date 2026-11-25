// PROTÓTIPO (ticket 39, 2ª rodada): os formatos que ficaram. 3 (grade de capas, padrão) com
// tudo dentro do card; 2 (linha compacta) e 5 (só texto) com colunas e cartão de destaque.
// Sem stepper de Progresso: na Lista só se muda o Status (veredito de 2026-11-25).
import { useEffect, useRef, useState } from 'react';

import { type EstadoConsumo, NOMES_ESTADO, ROTULOS_POR_TIPO } from '@dominio/estadoConsumo';

import { FioProgresso } from '../componentes/FioProgresso';
import { Icone } from '../componentes/Icone';
import { COR_DO_ESTADO } from '../componentes/status';
import { useAcoes } from './contexto';
import { autoria, ehJogo, estado, fio, formatarHoras, formatarNota, formatarNumero, haQuanto, type Item, textoConsumo, titulo, total, UNIDADE } from './dados';

export const FOCO = 'outline-none focus-visible:ring-2 focus-visible:ring-marca-texto';
// Link morto: o detalhe não faz parte do protótipo.
export const DETALHE = '#detalhe';

// ---------------------------------------------------------------- peças

export function Capa({ item, className = '' }: { item: Item; className?: string }) {
  return item.poster_url ? (
    <img src={item.poster_url} alt="" loading="lazy" decoding="async" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-superficie-alta text-[18px] font-bold text-marca">M</span>
  );
}

export function Nota({ n, tamanho = 13 }: { n: number | null; tamanho?: number }) {
  if (n === null) return <span className="text-texto-suave/50">—</span>;
  return (
    <span aria-label={`Nota pessoal ${formatarNota(n)}`} className="inline-flex items-center gap-1 font-semibold tabular-nums text-nota" style={{ fontSize: tamanho }}>
      <Icone nome="estrela" tamanho={tamanho - 2} cheio /> {formatarNota(n)}
    </span>
  );
}

/** "148 h" com o "h" menor; "12/24 ep" com o total suave. */
export function Consumo({ item, tamanho = 14 }: { item: Item; tamanho?: number }) {
  if (ehJogo(item)) {
    if (!item.progresso_atual) return <span className="text-texto-suave/50" style={{ fontSize: tamanho * 0.85 }}>— h</span>;
    return (
      <span aria-label={`${formatarHoras(item.progresso_atual)} jogadas`} className="font-bold tabular-nums leading-none text-texto-forte" style={{ fontSize: tamanho }}>
        {formatarNumero(item.progresso_atual)}
        <span className="ml-0.5 font-semibold text-texto-suave" style={{ fontSize: tamanho * 0.7 }}>
          h
        </span>
      </span>
    );
  }
  const t = total(item);
  return (
    <span className="font-semibold tabular-nums leading-none text-texto-forte" style={{ fontSize: tamanho }}>
      {item.progresso_atual ?? 0}
      <span className="font-normal text-texto-suave">{t !== null ? `/${t}` : ''}</span>
      <span className="ml-1 font-normal text-texto-suave" style={{ fontSize: tamanho * 0.78 }}>
        {UNIDADE[item.tipo]}
      </span>
    </span>
  );
}

export function PontoStatus({ e, tamanho = 8 }: { e: EstadoConsumo; tamanho?: number }) {
  return <span aria-hidden className="shrink-0 rounded-full" style={{ width: tamanho, height: tamanho, background: COR_DO_ESTADO[e] }} />;
}

function Favorito({ item }: { item: Item }) {
  if (!item.favorito) return null;
  return (
    <span role="img" aria-label="Favorito" className="shrink-0 text-marca-texto">
      <Icone nome="coracao" tamanho={12} cheio />
    </span>
  );
}

/**
 * Status como menu discreto: troca na hora, em memória. `capa`: botão ⋯ sobre a capa, que
 * só aparece no hover/foco; `linha`: ponto + nome sem borda, que ganha fundo no hover.
 */
export function MenuStatus({ item, jeito }: { item: Item; jeito: 'capa' | 'linha' }) {
  const { mudarStatus, soltar } = useAcoes();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const atual = estado(item);
  useEffect(() => {
    if (!aberto) return;
    const fora = (ev: MouseEvent) => !caixa.current?.contains(ev.target as Node) && setAberto(false);
    const esc = (ev: KeyboardEvent) => ev.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);
  const estados = Object.keys(ROTULOS_POR_TIPO[item.tipo]) as EstadoConsumo[];
  const capa = jeito === 'capa';
  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Status de ${titulo(item)}: ${NOMES_ESTADO[atual]}. Mudar`}
        title={capa ? `Status: ${NOMES_ESTADO[atual]}` : undefined}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          soltar(true);
          setAberto((a) => !a);
        }}
        className={
          capa
            ? `flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-opacity hover:bg-black/90 ${FOCO} ${
                aberto ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'
              }`
            : `inline-flex h-7 max-w-full items-center gap-1.5 rounded-md px-1.5 text-[12px] whitespace-nowrap text-texto transition-colors hover:bg-superficie-alta ${FOCO} ${aberto ? 'bg-superficie-alta' : ''}`
        }
      >
        {capa ? (
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        ) : (
          <>
            <PontoStatus e={atual} />
            <span className="truncate">{NOMES_ESTADO[atual]}</span>
            <Icone nome="baixo" tamanho={12} className="shrink-0 text-texto-suave opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
          </>
        )}
      </button>
      {aberto ? (
        <div role="menu" aria-label="Status" className="absolute left-0 z-40 mt-1 w-44 overflow-hidden rounded-lg border border-borda bg-superficie-alta py-1 shadow-2xl motion-safe:animate-[surgir_120ms_ease-out]">
          {estados.map((e) => (
            <button
              key={e}
              role="menuitemradio"
              aria-checked={e === atual}
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                mudarStatus(item, e);
                setAberto(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-texto hover:bg-superficie focus-visible:bg-superficie focus-visible:outline-none"
            >
              <PontoStatus e={e} />
              <span className="flex-1">{NOMES_ESTADO[e]}</span>
              {e === atual ? <span className="text-marca-texto">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- 3: grade de capas (padrão)

// Degradê sólido sob o texto e só esmaecendo nos 48 px de cima: branco sobre ≥ 85% de preto
// dá contraste > 4,5:1 mesmo sobre uma capa branca.
const DEGRADE = 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.85) calc(100% - 48px), rgba(0,0,0,0) 100%)';

export function CardCapa({ item }: { item: Item }) {
  const consumo = ehJogo(item) ? (item.progresso_atual ? `${formatarNumero(item.progresso_atual)} h` : null) : textoConsumo(item);
  const rotulo = [titulo(item), item.nota_usuario !== null ? `nota ${formatarNota(item.nota_usuario)}` : null, consumo && (ehJogo(item) ? `${consumo} jogadas` : `${consumo} ${UNIDADE[item.tipo]}`)]
    .filter(Boolean)
    .join(', ');
  return (
    <article className="group relative h-full hover:z-20 focus-within:z-20">
      <a
        href={DETALHE}
        aria-label={rotulo}
        className={`absolute inset-0 overflow-hidden rounded-md bg-superficie-alta shadow-[0_2px_10px_rgba(0,0,0,0.35)] ring-white/20 transition-shadow group-hover:ring-1 ${FOCO}`}
      >
        <Capa item={item} className="transition-transform duration-300 motion-safe:group-hover:scale-[1.03]" />
        {item.nota_usuario !== null || item.favorito ? (
          <span aria-hidden className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-[3px] text-[11px] font-semibold leading-none tabular-nums text-nota backdrop-blur-sm">
            {item.favorito ? <Icone nome="coracao" tamanho={10} cheio className="text-marca-texto" /> : null}
            {item.nota_usuario !== null ? (
              <>
                <Icone nome="estrela" tamanho={10} cheio /> {formatarNota(item.nota_usuario)}
              </>
            ) : null}
          </span>
        ) : null}
        <span aria-hidden className="absolute inset-x-0 bottom-0 flex items-end gap-2 px-2 pb-2.5 pt-12" style={{ backgroundImage: DEGRADE }}>
          <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-[1.25] text-white [overflow-wrap:anywhere] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">{titulo(item)}</span>
          {consumo ? <span className="shrink-0 text-[11.5px] font-semibold leading-[1.25] tabular-nums text-white/90">{consumo}</span> : null}
        </span>
        {!ehJogo(item) ? <FioProgresso proporcao={fio(item)} /> : null}
      </a>
      <span className="absolute left-1.5 top-1.5 z-10">
        <MenuStatus item={item} jeito="capa" />
      </span>
    </article>
  );
}

// ---------------------------------------------------------------- 2 e 5: linhas

/** Título, Nota, Progresso/Horas, Status, Atualizado (os dois últimos só a partir de md). */
export const COLUNAS = 'grid-cols-[minmax(0,1fr)_64px_96px] md:grid-cols-[minmax(0,1fr)_72px_112px_148px_104px]';

/** Eventos do cartão de destaque: hover parado ~300 ms ou foco no link do título. */
function useDestaque(item: Item) {
  const { destacar, soltar } = useAcoes();
  return {
    linha: {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => destacar({ item, linha: e.currentTarget.getBoundingClientRect(), x: e.clientX, origem: 'mouse' }),
      onMouseMove: (e: React.MouseEvent<HTMLElement>) => destacar({ item, linha: e.currentTarget.getBoundingClientRect(), x: e.clientX, origem: 'mouse' }),
      onMouseLeave: () => soltar(),
    },
    link: {
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        // Só foco de teclado (clique também foca o link).
        if (!e.currentTarget.matches(':focus-visible')) return;
        const linha = e.currentTarget.closest('[role="row"]')!;
        destacar({ item, linha: linha.getBoundingClientRect(), x: null, origem: 'foco' });
      },
      onBlur: () => soltar(),
    },
  };
}

export function LinhaCompacta({ item }: { item: Item }) {
  const d = useDestaque(item);
  return (
    <div role="row" {...d.linha} className={`group grid h-16 items-center gap-3 rounded-md px-2 transition-colors hover:bg-superficie focus-within:bg-superficie ${COLUNAS}`}>
      <span role="cell" className="min-w-0">
        <a href={DETALHE} {...d.link} className={`flex min-w-0 items-center gap-3 rounded ${FOCO}`}>
          <span className="relative h-[54px] w-9 shrink-0 overflow-hidden rounded-[3px] bg-superficie-alta">
            <Capa item={item} />
            {!ehJogo(item) ? <FioProgresso proporcao={fio(item)} /> : null}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[14px] font-semibold text-texto-forte">{titulo(item)}</span>
              <Favorito item={item} />
            </span>
            <span className="truncate text-[12px] text-texto-suave">{[autoria(item), item.generos_lista.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</span>
          </span>
        </a>
      </span>
      <span role="cell" className="justify-self-end">
        <Nota n={item.nota_usuario} tamanho={14} />
      </span>
      <span role="cell" className="justify-self-end">
        <Consumo item={item} tamanho={ehJogo(item) ? 17 : 14} />
      </span>
      <span role="cell" className="hidden min-w-0 md:block">
        <MenuStatus item={item} jeito="linha" />
      </span>
      <span role="cell" className="hidden justify-self-end text-[12px] text-texto-suave md:block">
        {haQuanto(item.data_atualizacao)}
      </span>
    </div>
  );
}

export function LinhaTexto({ item }: { item: Item }) {
  const d = useDestaque(item);
  return (
    <div role="row" {...d.linha} className={`group grid h-[34px] items-center gap-3 border-b border-borda/40 px-2 text-[13px] transition-colors hover:bg-superficie focus-within:bg-superficie ${COLUNAS}`}>
      <span role="cell" className="min-w-0">
        <a href={DETALHE} {...d.link} className={`flex min-w-0 items-center gap-2 rounded ${FOCO}`}>
          <span className="truncate font-semibold text-texto-forte">{titulo(item)}</span>
          <Favorito item={item} />
          <span className="hidden truncate text-[12px] text-texto-suave lg:inline">{autoria(item)}</span>
        </a>
      </span>
      <span role="cell" className="justify-self-end">
        <Nota n={item.nota_usuario} tamanho={13} />
      </span>
      <span role="cell" className="justify-self-end">
        <Consumo item={item} tamanho={13} />
      </span>
      <span role="cell" className="hidden min-w-0 md:block">
        <MenuStatus item={item} jeito="linha" />
      </span>
      <span role="cell" className="hidden justify-self-end text-[12px] text-texto-suave md:block">
        {haQuanto(item.data_atualizacao)}
      </span>
    </div>
  );
}
