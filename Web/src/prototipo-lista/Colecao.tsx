// PROTÓTIPO (ticket 39, Q119 e Q121): um grupo de Itens no formato escolhido, com o
// Tamanho (virtualização, prévia de 12 ou páginas de 50) e os cabeçalhos ordenáveis.
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Paginacao } from '../componentes/Paginacao';
import { type Item, nomeDaOrdem, type Ordem, type TipoFiltro } from './dados';
import {
  CardAtual,
  CardMedio,
  COLUNAS_LINHA,
  COLUNAS_TEXTO,
  GradeCapa,
  LinhaCompacta,
  LinhaTexto,
  Mosaico,
  type PropsItem,
} from './Itens';

const FORMATOS: Record<string, (p: PropsItem) => React.JSX.Element> = {
  '1': CardAtual,
  '2': LinhaCompacta,
  '3': GradeCapa,
  '4': CardMedio,
  '5': LinhaTexto,
  '6': Mosaico,
};

type Layout = { grade: boolean; min: number; fixo?: boolean; gap: number; altura(largura: number): number };
const LAYOUT: Record<string, Layout> = {
  '1': { grade: true, min: 280, gap: 12, altura: () => 104 },
  '2': { grade: false, min: 0, gap: 0, altura: () => 64 },
  '3': { grade: true, min: 138, gap: 18, altura: (w) => Math.round(w * 1.5) + 40 },
  '4': { grade: true, min: 360, gap: 12, altura: () => 132 },
  '5': { grade: false, min: 0, gap: 0, altura: () => 34 },
  '6': { grade: true, min: 64, fixo: true, gap: 6, altura: () => 96 },
};

function colunasCss(l: Layout, n?: number): string {
  if (!l.grade) return '1fr';
  const celula = l.fixo ? `${l.min}px` : `minmax(min(${l.min}px,100%),1fr)`;
  return n ? `repeat(${n}, ${l.fixo ? celula : 'minmax(0,1fr)'})` : `repeat(auto-fill, ${celula})`;
}

export type PropsColecao = {
  itens: Item[];
  formato: string;
  tamanho: string;
  comStatus: boolean;
  colunas: boolean;
  ordem: Ordem;
  mudarOrdem(o: Ordem): void;
  /** Tipo do grupo, para o rótulo da coluna de horas/Progresso e para a Ordem padrão. */
  tipo: TipoFiltro;
  estreito?: boolean;
  /** Elemento que rola (coluna do quadro); sem ele, a janela. */
  rolagem?: RefObject<HTMLElement | null>;
  /** Prévia: quantos mostrar antes do "Ver todos". */
  previa?: number;
};

export function Colecao(p: PropsColecao) {
  const l = LAYOUT[p.formato]!;
  const Formato = FORMATOS[p.formato]!;
  const cabecalho = p.colunas && !p.estreito && !l.grade ? <Cabecalho {...p} /> : null;
  const render = (i: Item) => <Formato key={i.id_lista} item={i} comStatus={p.comStatus} estreito={p.estreito} />;

  if (p.tamanho === 'i')
    return (
      <div>
        {cabecalho}
        <Virtual itens={p.itens} layout={l} render={render} rolagem={p.rolagem} />
      </div>
    );
  if (p.tamanho === 'iii') return <Paginado {...p} cabecalho={cabecalho} layout={l} render={render} />;
  return <Previa {...p} cabecalho={cabecalho} layout={l} render={render} />;
}

type Interno = PropsColecao & { cabecalho: React.ReactNode; layout: Layout; render(i: Item): React.ReactNode };

function Grade({ layout, itens, render }: { layout: Layout; itens: Item[]; render(i: Item): React.ReactNode }) {
  return (
    <div className="grid motion-safe:animate-[aparecer_180ms_ease-out]" style={{ gridTemplateColumns: colunasCss(layout), gap: layout.gap }}>
      {itens.map(render)}
    </div>
  );
}

function Previa({ itens, previa = 12, cabecalho, layout, render }: Interno) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? itens : itens.slice(0, previa);
  return (
    <div>
      {cabecalho}
      <Grade layout={layout} itens={visiveis} render={render} />
      {itens.length > previa ? (
        <button
          type="button"
          onClick={() => setTodos((t) => !t)}
          aria-expanded={todos}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-borda px-4 text-[13px] font-semibold text-texto-forte transition hover:border-marca-texto hover:text-marca-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-texto"
        >
          {todos ? 'Mostrar menos' : `Ver todos (${itens.length})`}
        </button>
      ) : null}
    </div>
  );
}

const POR_PAGINA = 50;

function Paginado({ itens, cabecalho, layout, render }: Interno) {
  const [pagina, setPagina] = useState(1);
  const total = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const atual = Math.min(pagina, total);
  const de = (atual - 1) * POR_PAGINA;
  const topo = useRef<HTMLDivElement>(null);
  const ir = (n: number) => {
    setPagina(n);
    // Volta ao começo do grupo, abaixo dos cabeçalhos fixos.
    const el = topo.current;
    if (el && el.getBoundingClientRect().top < 0) scrollTo({ top: scrollY + el.getBoundingClientRect().top - 220 });
  };
  return (
    <div ref={topo}>
      {cabecalho}
      <Grade layout={layout} itens={itens.slice(de, de + POR_PAGINA)} render={render} />
      {total > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-texto-suave tabular-nums">
            {de + 1}–{Math.min(de + POR_PAGINA, itens.length)} de {itens.length}
          </span>
          <Paginacao
            numeros
            ir={ir}
            paginacao={{ pagina: atual, totalDePaginas: total, temAnterior: atual > 1, temProxima: atual < total, faixa: null }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Virtualização por linha de grade: só as linhas visíveis (± 4) ficam no DOM. */
function Virtual({ itens, layout, render, rolagem }: { itens: Item[]; layout: Layout; render(i: Item): React.ReactNode; rolagem?: RefObject<HTMLElement | null> }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [janela, setJanela] = useState({ ini: 0, fim: 12 });

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setLargura(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const colunas = layout.grade ? Math.max(1, Math.floor((largura + layout.gap) / (layout.min + layout.gap))) : 1;
  const larguraCelula = layout.fixo ? layout.min : (largura - layout.gap * (colunas - 1)) / colunas;
  const altura = layout.altura(larguraCelula);
  const passo = altura + layout.gap;
  const linhas = Math.ceil(itens.length / colunas);

  useEffect(() => {
    const alvo: HTMLElement | Window = rolagem?.current ?? window;
    let quadro = 0;
    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const el = caixa.current;
        if (!el) return;
        const base = rolagem?.current ? rolagem.current.getBoundingClientRect().top : 0;
        const vista = rolagem?.current ? rolagem.current.clientHeight : innerHeight;
        const topo = el.getBoundingClientRect().top - base;
        const ini = Math.max(0, Math.floor(-topo / passo) - 4);
        const fim = Math.min(linhas, Math.ceil((vista - topo) / passo) + 4);
        setJanela((j) => (j.ini === ini && j.fim === fim ? j : { ini, fim }));
      });
    };
    medir();
    alvo.addEventListener('scroll', medir, { passive: true });
    addEventListener('resize', medir);
    return () => {
      cancelAnimationFrame(quadro);
      alvo.removeEventListener('scroll', medir);
      removeEventListener('resize', medir);
    };
  }, [passo, linhas, rolagem]);

  const fim = Math.max(janela.fim, Math.min(linhas, janela.ini + 1));
  return (
    <div ref={caixa} style={{ height: Math.max(0, linhas * passo - layout.gap), position: 'relative' }}>
      {largura ? (
        <div
          className="absolute inset-x-0 top-0 grid"
          style={{ transform: `translateY(${janela.ini * passo}px)`, gridTemplateColumns: colunasCss(layout, colunas), gap: layout.gap, gridAutoRows: altura }}
        >
          {itens.slice(janela.ini * colunas, fim * colunas).map(render)}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- cabeçalhos (7)

function Cabecalho({ formato, ordem, mudarOrdem, tipo }: PropsColecao) {
  const consumo = tipo === 'jogo' ? 'Horas' : tipo === 'todos' ? 'Progresso · Horas' : 'Progresso';
  // A Ordem padrão (Q120) ordena por horas nos jogos e por nota no resto.
  const efetiva: Ordem = ordem === 'padrao' ? (tipo === 'jogo' ? 'consumo' : 'nota') : ordem;
  const col = (rotulo: string, o: Ordem | null, alinhar = 'justify-self-end', extra = '') => {
    if (!o) return <span className={`${alinhar} ${extra}`}>{rotulo}</span>;
    const ativa = efetiva === o;
    return (
      <button
        type="button"
        onClick={() => mudarOrdem(ativa && ordem !== 'padrao' ? 'padrao' : o)}
        aria-label={`Ordenar por ${rotulo}`}
        title={ativa && ordem === 'padrao' ? nomeDaOrdem('padrao', tipo) : `Ordenar: ${rotulo}`}
        className={`${alinhar} ${extra} inline-flex items-center gap-1 rounded px-1 uppercase tracking-wide transition-colors hover:text-texto-forte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-texto ${
          ativa ? 'text-marca-texto' : ''
        }`}
      >
        {rotulo}
        {ativa ? <span aria-hidden>{o === 'titulo' ? '↑' : '↓'}</span> : null}
        {ativa && ordem === 'padrao' ? <span className="rounded-sm bg-marca/25 px-1 text-[9px] normal-case tracking-normal text-marca-texto">padrão</span> : null}
      </button>
    );
  };
  return (
    <div
      className={`mb-1 grid h-8 items-center gap-3 border-b border-borda px-2 text-[11px] font-semibold uppercase tracking-wide text-texto-suave ${
        formato === '5' ? COLUNAS_TEXTO : COLUNAS_LINHA
      }`}
    >
      {col('Título', 'titulo', 'justify-self-start', formato === '2' ? 'ml-12' : '')}
      {col('Nota', 'nota')}
      {col(consumo, 'consumo')}
      {col('Status', null, 'hidden md:block justify-self-start')}
      {col('Atualizado', 'atualizacao', 'hidden md:inline-flex justify-self-end')}
    </div>
  );
}
