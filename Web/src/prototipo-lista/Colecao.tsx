// PROTÓTIPO (ticket 39, 2ª rodada): um grupo de Itens no formato escolhido, sempre com
// virtualização (tamanho i), e os cabeçalhos ordenáveis das linhas (2 e 5).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { TipoMidia } from '@dominio/estadoConsumo';

import { ASCENDENTE, type Filtros, type Item, nomeDaOrdem, type Ordem } from './dados';
import { CardCapa, COLUNAS, FOCO, LinhaCompacta, LinhaTexto } from './Itens';
import type { Formato } from './variantes';

type Layout = { grade: boolean; min: number; gap: number; altura(largura: number): number };
const LAYOUT: Record<Formato, Layout> = {
  '3': { grade: true, min: 150, gap: 16, altura: (w) => Math.round(w * 1.5) },
  '2': { grade: false, min: 0, gap: 0, altura: () => 64 },
  '5': { grade: false, min: 0, gap: 0, altura: () => 34 },
};

export type Ordenacao = Pick<Filtros, 'ordem' | 'inversa'> & { mudar(p: Pick<Filtros, 'ordem' | 'inversa'>): void };

export function Colecao({ itens, formato, tipo, ordenacao, rotulo }: { itens: Item[]; formato: Formato; tipo: TipoMidia; ordenacao: Ordenacao; rotulo: string }) {
  const l = LAYOUT[formato];
  const render =
    formato === '3'
      ? (i: Item) => <CardCapa key={i.id_lista} item={i} />
      : formato === '2'
        ? (i: Item) => <LinhaCompacta key={i.id_lista} item={i} />
        : (i: Item) => <LinhaTexto key={i.id_lista} item={i} />;
  if (l.grade)
    return (
      <div role="list" aria-label={rotulo}>
        <Virtual itens={itens} layout={l} render={(i) => <div key={i.id_lista} role="listitem" className="h-full">{render(i)}</div>} />
      </div>
    );
  return (
    <div role="table" aria-label={rotulo} aria-rowcount={itens.length + 1}>
      <Cabecalho tipo={tipo} ordenacao={ordenacao} capa={formato === '2'} />
      <div role="rowgroup">
        <Virtual itens={itens} layout={l} render={render} />
      </div>
    </div>
  );
}

/** Virtualização por linha de grade: só as linhas visíveis (± 4) ficam no DOM. */
function Virtual({ itens, layout, render }: { itens: Item[]; layout: Layout; render(i: Item): React.ReactNode }) {
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
  const larguraCelula = (largura - layout.gap * (colunas - 1)) / colunas;
  const altura = layout.altura(larguraCelula);
  const passo = altura + layout.gap;
  const linhas = Math.ceil(itens.length / colunas);

  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const el = caixa.current;
        if (!el) return;
        const topo = el.getBoundingClientRect().top;
        const ini = Math.max(0, Math.floor(-topo / passo) - 4);
        const fim = Math.min(linhas, Math.ceil((innerHeight - topo) / passo) + 4);
        setJanela((j) => (j.ini === ini && j.fim === fim ? j : { ini, fim }));
      });
    };
    medir();
    addEventListener('scroll', medir, { passive: true });
    addEventListener('resize', medir);
    return () => {
      cancelAnimationFrame(quadro);
      removeEventListener('scroll', medir);
      removeEventListener('resize', medir);
    };
  }, [passo, linhas]);

  const ini = Math.min(janela.ini, linhas);
  const fim = Math.min(linhas, Math.max(janela.fim, ini + 1));
  return (
    <div ref={caixa} style={{ height: Math.max(0, linhas * passo - layout.gap), position: 'relative' }}>
      {largura ? (
        <div
          className="absolute inset-x-0 top-0 grid"
          style={{ transform: `translateY(${ini * passo}px)`, gridTemplateColumns: `repeat(${colunas}, minmax(0,1fr))`, gap: layout.gap, gridAutoRows: altura }}
        >
          {itens.slice(ini * colunas, fim * colunas).map(render)}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- cabeçalhos ordenáveis

function Cabecalho({ tipo, ordenacao, capa }: { tipo: TipoMidia; ordenacao: Ordenacao; capa: boolean }) {
  const { ordem, inversa, mudar } = ordenacao;
  // A Ordem padrão (Q120) é, neste grupo de um Tipo só, a nota (anime/mangá) ou as horas (jogo).
  const efetiva: Ordem = ordem === 'padrao' ? (tipo === 'jogo' ? 'consumo' : 'nota') : ordem;
  const subindo = ASCENDENTE[ordem] !== inversa;

  const col = (o: Ordem | null, rotulo: string, extra = '') => {
    if (!o)
      return (
        <span role="columnheader" className={`px-1.5 ${extra}`}>
          {rotulo}
        </span>
      );
    const ativa = efetiva === o;
    return (
      <span role="columnheader" aria-sort={ativa ? (subindo ? 'ascending' : 'descending') : 'none'} className={extra}>
        <button
          type="button"
          onClick={() => mudar(ativa ? { ordem: o, inversa: ordem === 'padrao' ? true : !inversa } : { ordem: o, inversa: false })}
          title={ativa && ordem === 'padrao' ? nomeDaOrdem('padrao', tipo) : undefined}
          className={`inline-flex h-7 items-center gap-1 rounded px-1 uppercase tracking-wide transition-colors hover:text-texto-forte ${FOCO} ${ativa ? 'text-texto-forte' : ''}`}
        >
          {rotulo}
          <span aria-hidden className={`w-3 text-[12px] ${ativa ? 'text-marca-texto' : 'opacity-0'}`}>
            {ativa ? (subindo ? '↑' : '↓') : '↓'}
          </span>
          {ativa && ordem === 'padrao' ? <span className="rounded-sm bg-marca/25 px-1 text-[9px] normal-case tracking-normal text-marca-texto">padrão</span> : null}
        </button>
      </span>
    );
  };
  return (
    <div role="row" className={`mb-1 grid h-9 items-center gap-3 border-b border-borda px-2 text-[11px] font-semibold uppercase tracking-wide text-texto-suave ${COLUNAS}`}>
      {col('titulo', 'Título', `justify-self-start ${capa ? 'ml-11' : '-ml-1'}`)}
      {col('nota', 'Nota', 'justify-self-end -mr-1')}
      {col('consumo', tipo === 'jogo' ? 'Horas' : 'Progresso', 'justify-self-end -mr-1')}
      {col(null, 'Status', 'hidden md:block')}
      {col('atualizacao', 'Atualizado', 'hidden md:block justify-self-end -mr-1')}
    </div>
  );
}
