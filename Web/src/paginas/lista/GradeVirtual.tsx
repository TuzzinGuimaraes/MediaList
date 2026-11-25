// Virtualização da Lista (ticket 39, tamanho i): os Itens em linhas de grade de altura fixa,
// e só as linhas perto da janela (± OVERSCAN) ficam no DOM. A página rola a janela, e cada
// grupo (Status × Tipo) tem a sua grade; o deslocamento dela na página é o `scrollMargin`.
// Serve à grade de capas (várias colunas) e às linhas compacta e só texto (uma coluna, `minima` 0).
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Fragment, type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';

const OVERSCAN = 4;

/** Largura do elemento, acompanhando o redimensionamento; 0 antes do layout (e no jsdom). */
function useLargura(ref: RefObject<HTMLElement | null>): number {
  const [largura, setLargura] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setLargura(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => setLargura(el.clientWidth));
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref]);
  return largura;
}

/** Onde o elemento começa na página: muda quando o que vem antes cresce ou encolhe. */
function useTopoNaPagina(ref: RefObject<HTMLElement | null>): number {
  const [topo, setTopo] = useState(0);
  // Sem dependências de propósito: o que vem antes muda sem avisar este componente, então
  // mede a cada render; só atualiza quando mudou, o que encerra a cadeia.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const novo = Math.round(el.getBoundingClientRect().top + window.scrollY);
    if (novo !== topo) setTopo(novo);
  });
  return topo;
}

/**
 * Se o elemento está perto da janela (até uma tela acima ou abaixo). Longe, a grade não
 * desenha linha nenhuma: o virtualizador sempre devolve as primeiras, mesmo fora da tela, e
 * o "Todos" tem até 18 grades. Sem IntersectionObserver (jsdom), sempre perto.
 */
function usePerto(ref: RefObject<HTMLElement | null>): boolean {
  const [perto, setPerto] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observador = new IntersectionObserver(([entrada]) => setPerto(entrada?.isIntersecting ?? true), {
      rootMargin: '100% 0px',
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref]);
  return perto;
}

type Props<T> = {
  itens: readonly T[];
  chave(item: T): string;
  /** Largura mínima da célula (as colunas saem da largura disponível); 0 é uma coluna só. */
  minima: number;
  gap: number;
  /** Altura da linha pela largura da célula. */
  altura(largura: number): number;
  /**
   * `lista`: a grade é uma lista com nome (`rotulo`) e cada célula um item; `linhas`: é o
   * corpo (rowgroup) de uma tabela, e `render` devolve a linha inteira (role="row", com o
   * `aria-rowindex` pelo índice).
   */
  papel?: 'lista' | 'linhas';
  rotulo?: string;
  render(item: T, indice: number): ReactNode;
};

export function GradeVirtual<T>({ itens, chave, minima, gap, altura, papel = 'lista', rotulo, render }: Props<T>) {
  const caixa = useRef<HTMLDivElement>(null);
  const largura = useLargura(caixa);
  const topo = useTopoNaPagina(caixa);
  const perto = usePerto(caixa);
  const colunas = minima > 0 && largura > 0 ? Math.max(1, Math.floor((largura + gap) / (minima + gap))) : 1;
  // Antes de medir, a célula mínima: dá uma estimativa de linhas visíveis razoável.
  const celula = largura > 0 ? (largura - gap * (colunas - 1)) / colunas : minima;
  const alturaLinha = Math.round(altura(celula));
  const linhas = Math.ceil(itens.length / colunas);

  const virtual = useWindowVirtualizer({
    count: linhas,
    estimateSize: () => alturaLinha + gap,
    // A linha leva a chave do primeiro Item dela: mudar a ordem move as linhas no DOM em vez
    // de remontar as células (e o foco, o menu aberto e as imagens ficam onde estão).
    getItemKey: (i) => {
      const primeiro = itens[i * colunas];
      return primeiro ? chave(primeiro) : i;
    },
    overscan: OVERSCAN,
    scrollMargin: topo,
    enabled: perto,
  });
  // A estimativa é a medida (linhas de altura fixa): mudou a altura, remede.
  useLayoutEffect(() => virtual.measure(), [virtual, alturaLinha, colunas]);

  return (
    <div
      ref={caixa}
      role={papel === 'lista' ? 'list' : 'rowgroup'}
      aria-label={rotulo}
      className="relative"
      style={{ height: Math.max(0, linhas * (alturaLinha + gap) - gap) }}
    >
      {virtual.getVirtualItems().map((linha) => (
        <div
          key={linha.key}
          role="none"
          // O menu aberto numa linha passa por cima da seguinte.
          className="absolute inset-x-0 top-0 grid focus-within:z-10 hover:z-10"
          style={{
            transform: `translateY(${linha.start - topo}px)`,
            gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`,
            gap,
            height: alturaLinha,
          }}
        >
          {itens.slice(linha.index * colunas, (linha.index + 1) * colunas).map((item, j) => {
            const indice = linha.index * colunas + j;
            return papel === 'lista' ? (
              <div key={chave(item)} role="listitem" aria-setsize={itens.length} aria-posinset={indice + 1} className="min-w-0">
                {render(item, indice)}
              </div>
            ) : (
              <Fragment key={chave(item)}>{render(item, indice)}</Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}
