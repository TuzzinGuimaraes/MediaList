// PROTÓTIPO (ticket 39, Q119): os 6 formatos do Item. Todos com a identidade do MediaList:
// fundo escuro, carmesim só na marca e no fio de progresso, Status em tons dessaturados.
import { useEffect, useRef, useState } from 'react';

import { type EstadoConsumo, NOMES_ESTADO, ROTULOS_POR_TIPO } from '@dominio/estadoConsumo';
import { passoDeProgresso } from '@dominio/itemLista';

import { FioProgresso } from '../componentes/FioProgresso';
import { Icone } from '../componentes/Icone';
import { Selo } from '../componentes/Selo';
import { COR_DO_ESTADO } from '../componentes/status';
import { useAcoes } from './contexto';
import {
  ano,
  autoria,
  ehJogo,
  estado,
  fio,
  formatarHoras,
  formatarNota,
  formatarNumero,
  haQuanto,
  type Item,
  textoConsumo,
  titulo,
  total,
  UNIDADE,
} from './dados';

export type PropsItem = { item: Item; comStatus: boolean; estreito?: boolean };

const FOCO = 'outline-none focus-visible:ring-2 focus-visible:ring-marca-texto';

// ---------------------------------------------------------------- peças

function Capa({ item, className = '' }: { item: Item; className?: string }) {
  return item.poster_url ? (
    <img src={item.poster_url} alt="" loading="lazy" decoding="async" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-superficie-alta text-[18px] font-bold text-marca">M</span>
  );
}

function Nota({ n, tamanho = 13 }: { n: number | null; tamanho?: number }) {
  if (n === null) return <span className="text-texto-suave/50">—</span>;
  return (
    <span aria-label={`Nota pessoal: ${formatarNota(n)}`} className="inline-flex items-center gap-1 font-semibold tabular-nums text-nota" style={{ fontSize: tamanho }}>
      <Icone nome="estrela" tamanho={tamanho - 2} cheio /> {formatarNota(n)}
    </span>
  );
}

/** Horas de jogo grandes; o "h" menor para o número ler primeiro. */
function Horas({ h, tamanho = 18 }: { h: number | null; tamanho?: number }) {
  if (!h) return <span className="text-texto-suave/50" style={{ fontSize: tamanho * 0.8 }}>— h</span>;
  return (
    <span aria-label={`${formatarHoras(h)} jogadas`} className="font-bold tabular-nums leading-none text-texto-forte" style={{ fontSize: tamanho }}>
      {formatarNumero(h)}
      <span className="ml-0.5 font-semibold text-texto-suave" style={{ fontSize: tamanho * 0.62 }}>
        h
      </span>
    </span>
  );
}

/** Episódios/capítulos: "12/24" com um fio carmesim curto embaixo. */
function Progresso({ item, tamanho = 14, largura = 72 }: { item: Item; tamanho?: number; largura?: number }) {
  const t = total(item);
  const atual = item.progresso_atual ?? 0;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="font-semibold tabular-nums leading-none text-texto-forte" style={{ fontSize: tamanho }}>
        {atual}
        <span className="font-normal text-texto-suave">{t !== null ? `/${t}` : ''}</span>
        <span className="ml-1 text-[11px] font-normal text-texto-suave">{UNIDADE[item.tipo]}</span>
      </span>
      <span aria-hidden className="relative h-[3px] overflow-hidden rounded-full bg-borda" style={{ width: largura }}>
        <span className="absolute inset-y-0 left-0 rounded-full bg-marca-forte transition-[width] duration-300" style={{ width: `${(fio(item) ?? 0.08) * 100}%` }} />
      </span>
    </span>
  );
}

function Consumo({ item, tamanho }: { item: Item; tamanho?: number }) {
  return ehJogo(item) ? <Horas h={item.progresso_atual} tamanho={tamanho} /> : <Progresso item={item} tamanho={tamanho ? tamanho * 0.8 : 14} />;
}

function Passo({ item, delta }: { item: Item; delta: 1 | -1 }) {
  const { passo } = useAcoes();
  const pode = passoDeProgresso(item, delta) !== null;
  return (
    <button
      type="button"
      aria-label={`${delta > 0 ? 'Mais' : 'Menos'} um em ${titulo(item)}`}
      disabled={!pode}
      onClick={(e) => {
        e.stopPropagation();
        passo(item, delta);
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-texto-forte hover:bg-superficie-alta disabled:opacity-25 ${FOCO}`}
    >
      <Icone nome={delta > 0 ? 'mais' : 'menos'} tamanho={14} />
    </button>
  );
}

function PontoStatus({ e, tamanho = 8 }: { e: EstadoConsumo; tamanho?: number }) {
  return <span aria-hidden className="shrink-0 rounded-full" style={{ width: tamanho, height: tamanho, background: COR_DO_ESTADO[e] }} />;
}

/** Status do Item como menu: troca na hora, em memória. `fantasma` só aparece no hover. */
export function MenuStatus({ item, fantasma = false, compacto = false }: { item: Item; fantasma?: boolean; compacto?: boolean }) {
  const { mudarStatus } = useAcoes();
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
  const cor = COR_DO_ESTADO[atual];
  const estados = Object.keys(ROTULOS_POR_TIPO[item.tipo]) as EstadoConsumo[];
  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Status de ${titulo(item)}: ${NOMES_ESTADO[atual]}. Mudar`}
        onClick={(e) => {
          e.stopPropagation();
          setAberto((a) => !a);
        }}
        className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold whitespace-nowrap transition ${FOCO} ${
          fantasma && !aberto ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : ''
        }`}
        style={{ borderColor: `color-mix(in srgb, ${cor} 45%, transparent)`, color: cor, background: `color-mix(in srgb, ${cor} 10%, transparent)` }}
      >
        <PontoStatus e={atual} />
        {compacto ? null : NOMES_ESTADO[atual]}
        <Icone nome="baixo" tamanho={12} />
      </button>
      {aberto ? (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-lg border border-borda bg-superficie-alta py-1 shadow-2xl motion-safe:animate-[surgir_120ms_ease-out]">
          {estados.map((e) => (
            <button
              key={e}
              role="menuitemradio"
              aria-checked={e === atual}
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
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

function Meta({ item }: { item: Item }) {
  const partes = [autoria(item), ano(item), item.generos_lista.slice(0, 2).join(', ')].filter(Boolean);
  return <span className="truncate text-[12px] text-texto-suave">{partes.join(' · ')}</span>;
}

function Marcas({ item }: { item: Item }) {
  return (
    <>
      {item.favorito ? (
        <span role="img" aria-label="Favorito" className="shrink-0 text-marca-texto">
          <Icone nome="coracao" tamanho={12} cheio />
        </span>
      ) : null}
      {item.recontagem ? <span className="shrink-0 text-[11px] text-texto-suave">{item.recontagem + 1}×</span> : null}
    </>
  );
}

// Link morto: o detalhe não faz parte do protótipo.
const DETALHE = '#detalhe';

// ---------------------------------------------------------------- 1: card atual (controle)

export function CardAtual({ item, comStatus }: PropsItem) {
  const fundo = item.banner_url ?? item.poster_url;
  return (
    <article aria-label={titulo(item)} className="group relative flex h-[104px] overflow-hidden rounded-md bg-superficie transition hover:ring-1 hover:ring-borda">
      {fundo ? <img src={fundo} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover opacity-25 ${item.banner_url ? '' : 'blur-md'}`} /> : null}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-superficie via-superficie/90 to-superficie/70" />
      <a href={DETALHE} aria-label={`Abrir ${titulo(item)}`} className={`relative m-2 aspect-[2/3] shrink-0 overflow-hidden rounded bg-superficie-alta ${FOCO}`}>
        <Capa item={item} />
      </a>
      <div className="relative flex min-w-0 flex-1 flex-col items-start gap-1 py-2 pr-2">
        <span className="line-clamp-2 text-[14px] font-semibold leading-tight text-texto-forte group-hover:underline">{titulo(item)}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <Selo texto={{ anime: 'Anime', manga: 'Mangá', jogo: 'Jogo' }[item.tipo]} />
          {comStatus ? <Selo texto={NOMES_ESTADO[estado(item)]} tom={estado(item)} /> : null}
          {item.nota_usuario !== null ? <Nota n={item.nota_usuario} tamanho={12} /> : null}
          <Marcas item={item} />
        </span>
      </div>
      <div className="absolute bottom-2 right-2">
        {ehJogo(item) ? (
          <span className="text-[12px] text-texto-suave">{`${formatarNumero(item.progresso_atual ?? 0)} h`}</span>
        ) : (
          <div className="flex items-center rounded-full border border-borda bg-superficie-alta">
            <Passo item={item} delta={-1} />
            <span className="min-w-12 text-center text-[13px] font-semibold tabular-nums text-texto-forte">{textoConsumo(item)}</span>
            <Passo item={item} delta={1} />
          </div>
        )}
      </div>
      <FioProgresso proporcao={fio(item)} />
    </article>
  );
}

// ---------------------------------------------------------------- 2: linha compacta

export const COLUNAS_LINHA = 'grid-cols-[minmax(0,1fr)_64px_104px] md:grid-cols-[minmax(0,1fr)_72px_120px_150px_96px]';
export const COLUNAS_LINHA_ESTREITA = 'grid-cols-[minmax(0,1fr)_76px]';

export function LinhaCompacta({ item, comStatus, estreito }: PropsItem) {
  return (
    <article
      aria-label={titulo(item)}
      className={`group grid h-16 items-center gap-3 rounded-md px-2 transition-colors hover:bg-superficie ${estreito ? COLUNAS_LINHA_ESTREITA : COLUNAS_LINHA}`}
    >
      <a href={DETALHE} className={`flex min-w-0 items-center gap-3 rounded ${FOCO}`}>
        <span className="relative h-[54px] w-9 shrink-0 overflow-hidden rounded-[3px] bg-superficie-alta">
          <Capa item={item} />
          {!ehJogo(item) ? <FioProgresso proporcao={fio(item)} /> : null}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            {comStatus ? <PontoStatus e={estado(item)} /> : null}
            <span className="truncate text-[14px] font-semibold text-texto-forte group-hover:text-white">{titulo(item)}</span>
            <Marcas item={item} />
          </span>
          {estreito ? (
            <Nota n={item.nota_usuario} tamanho={12} />
          ) : (
            <Meta item={item} />
          )}
        </span>
      </a>
      {estreito ? null : (
        <span className="justify-self-end">
          <Nota n={item.nota_usuario} tamanho={14} />
        </span>
      )}
      <span className="flex items-center justify-end gap-1">
        {!ehJogo(item) && !estreito ? (
          <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Passo item={item} delta={1} />
          </span>
        ) : null}
        <Consumo item={item} tamanho={estreito ? 16 : 19} />
      </span>
      {estreito ? null : (
        <span className="hidden justify-self-start md:block">
          <MenuStatus item={item} fantasma={!comStatus} />
        </span>
      )}
      {estreito ? null : <span className="hidden justify-self-end text-[12px] text-texto-suave md:block">{haQuanto(item.data_atualizacao)}</span>}
    </article>
  );
}

// ---------------------------------------------------------------- 3: grade de capas

/** Selo grande: horas no jogo, Nota pessoal no anime e mangá. */
function SeloGrande({ item }: { item: Item }) {
  if (ehJogo(item)) {
    if (!item.progresso_atual) return null;
    return (
      <span className="rounded-md bg-black/75 px-2 py-1 text-white backdrop-blur-sm">
        <span className="text-[20px] font-bold tabular-nums leading-none">{formatarNumero(item.progresso_atual)}</span>
        <span className="ml-0.5 text-[12px] font-semibold text-white/70">h</span>
      </span>
    );
  }
  if (item.nota_usuario === null) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-[18px] font-bold leading-none tabular-nums text-nota backdrop-blur-sm">
      <Icone nome="estrela" tamanho={14} cheio /> {formatarNota(item.nota_usuario)}
    </span>
  );
}

export function GradeCapa({ item, comStatus }: PropsItem) {
  const sub = ehJogo(item)
    ? item.nota_usuario !== null
      ? `Nota ${formatarNota(item.nota_usuario)}`
      : (autoria(item) ?? '')
    : textoConsumo(item) + ` ${UNIDADE[item.tipo]}`;
  return (
    <article aria-label={titulo(item)} className="group flex h-full flex-col gap-1.5">
      <a
        href={DETALHE}
        className={`relative block aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-superficie-alta shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition duration-200 motion-safe:group-hover:-translate-y-0.5 group-hover:ring-1 group-hover:ring-white/15 ${FOCO}`}
      >
        <Capa item={item} className="transition duration-300 motion-safe:group-hover:scale-[1.03]" />
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
        <span className="absolute bottom-2.5 left-2">
          <SeloGrande item={item} />
        </span>
        {comStatus ? (
          <span className="absolute left-2 top-2">
            <Selo texto={NOMES_ESTADO[estado(item)]} tom={estado(item)} sobreImagem />
          </span>
        ) : null}
        {item.favorito ? (
          <span className="absolute right-2 top-2 text-marca-texto drop-shadow">
            <Icone nome="coracao" tamanho={14} cheio />
          </span>
        ) : null}
        {!ehJogo(item) ? <FioProgresso proporcao={fio(item)} /> : null}
      </a>
      <span className="truncate text-[13px] font-semibold leading-tight text-texto-forte">{titulo(item)}</span>
      <span className="-mt-1 truncate text-[12px] tabular-nums text-texto-suave">{sub}</span>
    </article>
  );
}

// ---------------------------------------------------------------- 4: card médio

export function CardMedio({ item, comStatus, estreito }: PropsItem) {
  const jogo = ehJogo(item);
  const t = total(item);
  return (
    <article aria-label={titulo(item)} className="group relative flex h-[132px] overflow-hidden rounded-lg bg-superficie transition hover:bg-superficie-alta/60 hover:ring-1 hover:ring-borda">
      <a href={DETALHE} className={`relative w-[88px] shrink-0 overflow-hidden bg-superficie-alta ${FOCO}`}>
        <Capa item={item} />
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3">
        <div className="flex items-start gap-2">
          <a href={DETALHE} className="line-clamp-2 flex-1 text-[15px] font-semibold leading-snug text-texto-forte hover:underline">
            {titulo(item)}
          </a>
          <MenuStatus item={item} compacto={!comStatus || estreito} />
        </div>
        <Meta item={item} />
        <div className="mt-auto flex items-end justify-between gap-2">
          <span className="flex items-center gap-2">
            <Nota n={item.nota_usuario} tamanho={15} />
            <Marcas item={item} />
          </span>
          {jogo ? (
            <span className="text-right">
              <Horas h={item.progresso_atual} tamanho={28} />
              <span className="block text-[11px] text-texto-suave">jogadas</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Passo item={item} delta={-1} />
              <span className="text-right">
                <span className="text-[22px] font-bold tabular-nums leading-none text-texto-forte">{item.progresso_atual ?? 0}</span>
                <span className="text-[13px] tabular-nums text-texto-suave">{t !== null ? `/${t}` : ''}</span>
                <span className="block text-[11px] text-texto-suave">{item.tipo === 'anime' ? 'episódios' : 'capítulos'}</span>
              </span>
              <Passo item={item} delta={1} />
            </span>
          )}
        </div>
      </div>
      {!jogo ? <FioProgresso proporcao={fio(item)} grosso /> : null}
    </article>
  );
}

// ---------------------------------------------------------------- 5: só texto

export const COLUNAS_TEXTO = 'grid-cols-[minmax(0,1fr)_56px_88px] md:grid-cols-[minmax(0,1fr)_72px_120px_150px_96px]';

export function LinhaTexto({ item, comStatus, estreito }: PropsItem) {
  const { previa } = useAcoes();
  const mostrar = (x: number, y: number) => item.poster_url && previa({ url: item.poster_url, x, y });
  return (
    <article
      aria-label={titulo(item)}
      onMouseMove={(e) => mostrar(e.clientX, e.clientY)}
      onMouseLeave={() => previa(null)}
      className={`group grid h-[34px] items-center gap-3 border-b border-borda/40 px-2 text-[13px] transition-colors hover:bg-superficie ${estreito ? 'grid-cols-[minmax(0,1fr)_64px]' : COLUNAS_TEXTO}`}
    >
      <a
        href={DETALHE}
        onFocus={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          mostrar(r.left + 120, r.top);
        }}
        onBlur={() => previa(null)}
        className={`flex min-w-0 items-center gap-2 rounded ${FOCO}`}
      >
        {comStatus ? <PontoStatus e={estado(item)} tamanho={7} /> : null}
        <span className="truncate font-semibold text-texto-forte">{titulo(item)}</span>
        <Marcas item={item} />
        {estreito ? null : <span className="hidden truncate text-[12px] text-texto-suave lg:inline">{autoria(item)}</span>}
      </a>
      {estreito ? null : (
        <span className="justify-self-end">
          <Nota n={item.nota_usuario} tamanho={13} />
        </span>
      )}
      <span className="justify-self-end tabular-nums">
        {ehJogo(item) ? <Horas h={item.progresso_atual} tamanho={15} /> : <span className="font-semibold text-texto-forte">{textoConsumo(item)}</span>}
      </span>
      {estreito ? null : (
        <span className="hidden md:block">
          <MenuStatus item={item} fantasma={!comStatus} />
        </span>
      )}
      {estreito ? null : <span className="hidden justify-self-end text-[12px] text-texto-suave md:block">{haQuanto(item.data_atualizacao)}</span>}
    </article>
  );
}

// ---------------------------------------------------------------- 6: mosaico

export function Mosaico({ item, comStatus }: PropsItem) {
  const e = estado(item);
  return (
    <article aria-label={titulo(item)} className="group relative h-24 w-16 hover:z-30 focus-within:z-30">
      <a href={DETALHE} className={`relative block h-full w-full overflow-hidden rounded-[4px] bg-superficie-alta transition duration-150 group-hover:ring-2 group-hover:ring-white/70 ${FOCO}`}>
        <Capa item={item} />
        {comStatus ? <span aria-hidden className="absolute left-1 top-1 h-2 w-2 rounded-full ring-1 ring-black/60" style={{ background: COR_DO_ESTADO[e] }} /> : null}
        {!ehJogo(item) ? <FioProgresso proporcao={fio(item)} /> : null}
      </a>
      <div
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-56 -translate-x-1/2 rounded-lg border border-borda bg-superficie-alta p-3 shadow-2xl group-hover:block group-focus-within:block motion-safe:animate-[surgir_120ms_ease-out]"
      >
        <span className="line-clamp-2 text-[14px] font-semibold leading-tight text-texto-forte">{titulo(item)}</span>
        <span className="mt-1 flex items-center gap-1.5 text-[12px]" style={{ color: COR_DO_ESTADO[e] }}>
          <PontoStatus e={e} /> {NOMES_ESTADO[e]}
        </span>
        <span className="mt-2 flex items-end justify-between">
          <Nota n={item.nota_usuario} tamanho={14} />
          <Consumo item={item} tamanho={22} />
        </span>
      </div>
    </article>
  );
}
