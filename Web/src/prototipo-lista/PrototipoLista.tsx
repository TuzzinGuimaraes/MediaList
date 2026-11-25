// PROTÓTIPO (ticket 39): a Lista do web desenhada do zero, com a barra de variantes dos 4
// eixos (Q118–Q121). Abre sem login nem backend em /prototipo/lista; dados fixos em
// dados.json, mudanças só em memória. Descartável: vira a tag prototipo/lista.
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { type EstadoConsumo, ROTULOS_POR_TIPO } from '@dominio/estadoConsumo';
import { passoDeProgresso } from '@dominio/itemLista';

import { Icone } from '../componentes/Icone';
import { Barra } from './Barra';
import { type Acoes, AcoesCtx } from './contexto';
import {
  contar,
  ehJogo,
  estado,
  estadosDe,
  type Filtros,
  filtrarBase,
  formatarNumero,
  inicial,
  type Item,
  ITENS,
  noEstado,
  opcoes as opcoesDe,
  type Ordem,
  ORDENS,
  organizar,
  type TipoFiltro,
  total,
} from './dados';
import { BarraFiltros, ColunaFiltros, FiltrosSheet, IndiceAZ, type PropsFiltros, SegmentadoTipo } from './Filtros';
import {
  type Base,
  CorpoFileiras,
  CorpoQuadro,
  CorpoSecoes,
  CorpoStatus,
  CorpoUnica,
  FaixaAbas,
  FaixaChips,
  FaixaIndice,
  LateralStatus,
  Resultados,
  Vazio,
} from './Navegacoes';
import { ajustar, useVariantes } from './variantes';

const CHAVE_ORDEM = 'prototipo-lista.ordem';
const AGORA_ISO = '2026-11-24T20:00:00Z';

function ordemSalva(): Ordem {
  const o = localStorage.getItem(CHAVE_ORDEM) as Ordem | null;
  return o && ORDENS.includes(o) ? o : 'padrao';
}

const consultaToque = () => matchMedia('(hover: none)');
function useToque() {
  return useSyncExternalStore(
    (avisar) => {
      const q = consultaToque();
      q.addEventListener('change', avisar);
      return () => q.removeEventListener('change', avisar);
    },
    () => consultaToque().matches,
  );
}

/** Altura do topo fixo em --fixo, para cabeçalhos de seção e colunas laterais grudarem abaixo dele. */
function useTopoFixo() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(() => document.documentElement.style.setProperty('--fixo', `${el.getBoundingClientRect().height + 56}px`));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function NavFalsa() {
  const links = ['Início', 'Explorar', 'Minha Lista', 'Notícias'];
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-borda/60 bg-nav/95 backdrop-blur">
      <div className="flex h-full items-center gap-8 px-6 lg:px-10">
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-[26px] font-bold leading-none text-marca">M</span>
          <span className="text-[17px] font-bold text-texto-forte">MediaList</span>
        </span>
        <nav aria-label="Principal (falsa)" className="hidden gap-6 text-[14px] font-semibold sm:flex">
          {links.map((l) => (
            <a key={l} href="#" aria-current={l === 'Minha Lista' ? 'page' : undefined} className={`relative py-4 ${l === 'Minha Lista' ? 'text-texto-forte' : 'text-texto-suave hover:text-texto-forte'}`}>
              {l}
              {l === 'Minha Lista' ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-marca-forte" /> : null}
            </a>
          ))}
        </nav>
        <span className="ml-auto flex items-center gap-4 text-texto-suave">
          <Icone nome="sino" />
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-superficie-alta text-[13px] font-bold text-texto-forte">A</span>
        </span>
      </div>
    </header>
  );
}

function PreviaCapa({ p }: { p: { url: string; x: number; y: number } | null }) {
  if (!p) return null;
  const x = Math.min(p.x + 20, innerWidth - 120);
  const y = Math.max(64, Math.min(p.y - 72, innerHeight - 160));
  return (
    <img
      src={p.url}
      alt=""
      aria-hidden
      className="pointer-events-none fixed z-50 h-[150px] w-[100px] rounded-md object-cover shadow-[0_8px_30px_rgba(0,0,0,0.6)] ring-1 ring-white/10 motion-safe:animate-[surgir_120ms_ease-out]"
      style={{ left: x, top: y }}
    />
  );
}

export function PrototipoLista() {
  const [v, mudarV] = useVariantes();
  const toque = useToque();
  const ef = ajustar(v, toque);
  const topo = useTopoFixo();

  // ---- Itens em memória
  const [mudancas, setMudancas] = useState<Record<string, Partial<Item>>>({});
  const itens = useMemo(() => ITENS.map((i) => (mudancas[i.id_lista] ? { ...i, ...mudancas[i.id_lista] } : i)), [mudancas]);
  const [previa, setPrevia] = useState<{ url: string; x: number; y: number } | null>(null);
  const acoes = useMemo<Acoes>(() => {
    const aplicar = (i: Item, p: Partial<Item>) => setMudancas((m) => ({ ...m, [i.id_lista]: { ...m[i.id_lista], ...p, data_atualizacao: AGORA_ISO } }));
    return {
      mudarStatus(i, e) {
        const t = total(i);
        aplicar(i, { status_consumo: ROTULOS_POR_TIPO[i.tipo][e]!, ...((e === 'concluido' || e === 'platinado') && t !== null ? { progresso_atual: t } : {}) });
      },
      passo(i, d) {
        const novo = passoDeProgresso(i, d);
        if (novo === null) return;
        const t = total(i);
        // ADR-0009: atingir o total conclui; baixar dele volta a Em progresso.
        const e = t !== null && novo === t ? 'concluido' : estado(i) === 'concluido' || estado(i) === 'planejado' ? 'em_progresso' : estado(i);
        aplicar(i, { progresso_atual: novo, status_consumo: ROTULOS_POR_TIPO[i.tipo][e]! });
      },
      previa: setPrevia,
    };
  }, []);

  // ---- Filtros e Ordem (a Ordem escolhida fica salva, Q120)
  const [f, setF] = useState<Filtros>(() => ({ busca: '', tipo: 'todos', genero: null, situacao: null, ordem: ordemSalva(), status: [], letra: null }));
  const mudarF = useCallback((p: Partial<Filtros>) => {
    if (p.ordem) localStorage.setItem(CHAVE_ORDEM, p.ordem);
    setF((x) => ({ ...x, ...p }));
  }, []);

  // ---- Navegação
  const estados = estadosDe(f.tipo);
  const [aba, setAba] = useState<EstadoConsumo>('em_progresso');
  const ativa = estados.includes(aba) ? aba : estados[0]!;
  const [recolhidas, setRecolhidas] = useState<Set<EstadoConsumo>>(new Set());
  const [foco, setFoco] = useState<EstadoConsumo | null>(null);

  const ops = opcoesDe(itens, f.tipo);
  const organizados = organizar(itens, f);
  const contagem = contar(organizados);
  const iniciais = new Set(filtrarBase(itens, { ...f, letra: null }).map(inicial));
  const semTipo = filtrarBase(itens, { ...f, tipo: 'todos', letra: null });
  const contagemTipo: Record<TipoFiltro, number> = {
    todos: semTipo.length,
    anime: semTipo.filter((i) => i.tipo === 'anime').length,
    manga: semTipo.filter((i) => i.tipo === 'manga').length,
    jogo: semTipo.filter((i) => i.tipo === 'jogo').length,
  };
  const pf: PropsFiltros = { f, mudar: mudarF, opcoes: ops, contagemTipo };
  const base: Base = { formato: ef.formato, tamanho: ef.tamanho, colunas: ef.colunas, ordem: f.ordem, mudarOrdem: (ordem) => mudarF({ ordem }) };
  const termo = f.busca.trim();

  const doTipo = itens.filter((i) => f.tipo === 'todos' || i.tipo === f.tipo);
  const horas = doTipo.filter(ehJogo).reduce((s, i) => s + (i.progresso_atual ?? 0), 0);
  const notas = doTipo.map((i) => i.nota_usuario).filter((n): n is number => n !== null);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

  // ---- Faixa do topo fixo e corpo, por navegação
  const comBusca = termo && (ef.nav === 'A' || ef.nav === 'C');
  let faixa: React.ReactNode = null;
  let corpo: React.ReactNode;
  if (comBusca) corpo = <Resultados itens={organizados} tipo={f.tipo} base={base} termo={termo} />;
  else if (ef.nav === 'A') corpo = <CorpoStatus e={ativa} itens={organizados} tipo={f.tipo} base={base} />;
  else if (ef.nav === 'B')
    corpo = (
      <CorpoSecoes
        estados={estados}
        itens={organizados}
        tipo={f.tipo}
        base={base}
        recolhidas={recolhidas}
        alternar={(e) =>
          setRecolhidas((r) => {
            const n = new Set(r);
            if (n.has(e)) n.delete(e);
            else n.add(e);
            return n;
          })
        }
      />
    );
  else if (ef.nav === 'C') corpo = <CorpoStatus e={ativa} itens={organizados} tipo={f.tipo} base={base} />;
  else if (ef.nav === 'D') corpo = <CorpoFileiras estados={estados} itens={organizados} tipo={f.tipo} base={{ ...base, formatoFileira: ef.formatoFileira }} foco={foco && estados.includes(foco) ? foco : null} focar={setFoco} />;
  else if (ef.nav === 'E') corpo = <CorpoQuadro estados={estados} itens={organizados} base={base} />;
  else {
    const filtrados = f.status.length ? organizados.filter((i) => f.status.some((e) => noEstado(i, e))) : organizados;
    corpo = <CorpoUnica itens={filtrados} tipo={f.tipo} base={base} />;
  }
  if (!comBusca && ef.nav === 'A') faixa = <FaixaAbas estados={estados} contagem={contagem} ativa={ativa} escolher={setAba} />;
  if (ef.nav === 'B')
    faixa = <FaixaIndice estados={estados} contagem={contagem} recolhidas={recolhidas} alternarTodas={() => setRecolhidas((r) => (r.size ? new Set() : new Set(estados)))} />;
  if (ef.nav === 'F') faixa = <FaixaChips estados={estados} contagem={contagem} marcados={f.status} mudar={(status) => mudarF({ status })} />;

  if (!organizados.length && !comBusca)
    corpo = (
      <Vazio
        texto="Nada na Lista com esses filtros."
        acao={
          <button type="button" onClick={() => mudarF({ busca: '', genero: null, situacao: null, letra: null })} className="text-[14px] font-semibold text-marca-texto hover:underline">
            Limpar filtros
          </button>
        }
      />
    );

  const lateralStatus = ef.nav === 'C' && !comBusca;
  const colunaFiltros = ef.filtros === 'c';
  const temLateral = lateralStatus || colunaFiltros;

  return (
    <AcoesCtx.Provider value={acoes}>
      <div className={`min-h-screen pb-[360px] ${v.az ? 'pr-8' : ''}`}>
        <NavFalsa />
        <main className="px-6 lg:px-10">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-1 pt-7 pb-4">
            <h1 className="text-[30px] font-bold leading-none text-texto-forte">Minha Lista</h1>
            <p className="text-[14px] text-texto-suave tabular-nums">
              {doTipo.length} Itens
              {f.tipo === 'todos' || f.tipo === 'jogo' ? (
                <>
                  {' · '}
                  <span className="font-semibold text-texto-forte">{formatarNumero(horas)} h</span> em jogos
                </>
              ) : null}
              {media !== null ? ` · nota média ${formatarNumero(Math.round(media * 10) / 10)}` : ''}
            </p>
            {f.letra ? (
              <button type="button" onClick={() => mudarF({ letra: null })} className="inline-flex items-center gap-1 rounded-full bg-marca/25 px-2.5 py-0.5 text-[13px] font-semibold text-texto-forte">
                Inicial {f.letra} <Icone nome="fechar" tamanho={12} />
              </button>
            ) : null}
          </div>

          <div ref={topo} className="sticky top-14 z-30 -mx-6 border-b border-borda/70 bg-fundo/95 px-6 pt-3 backdrop-blur lg:-mx-10 lg:px-10">
            <div className="pb-3">
              {ef.filtros === 'a' ? <FiltrosSheet {...pf} /> : ef.filtros === 'b' ? <BarraFiltros {...pf} /> : <SegmentadoTipo {...pf} />}
            </div>
            {faixa}
          </div>

          <div className={`pt-6 ${temLateral ? 'flex flex-col gap-6 lg:flex-row lg:gap-8' : ''}`}>
            {temLateral ? (
              <aside className="shrink-0 lg:sticky lg:w-[232px] lg:self-start lg:overflow-y-auto" style={{ top: 'calc(var(--fixo) + 16px)', maxHeight: 'calc(100vh - var(--fixo) - 24px)' }}>
                <div className="flex flex-col gap-6">
                  {lateralStatus ? <LateralStatus estados={estados} contagem={contagem} ativa={ativa} escolher={setAba} /> : null}
                  {lateralStatus && colunaFiltros ? <hr className="border-borda" /> : null}
                  {colunaFiltros ? <ColunaFiltros {...pf} /> : null}
                </div>
              </aside>
            ) : null}
            <div className="min-w-0 flex-1">{corpo}</div>
          </div>
        </main>
        {v.az ? <IndiceAZ existentes={iniciais} letra={f.letra} mudar={(letra) => mudarF({ letra })} /> : null}
        <PreviaCapa p={ef.formato === '5' ? previa : null} />
        <Barra v={v} mudar={mudarV} ef={ef} />
      </div>
    </AcoesCtx.Provider>
  );
}
