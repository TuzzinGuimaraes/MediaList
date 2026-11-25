// PROTÓTIPO (ticket 39, 2ª rodada): cartão de destaque das linhas (formatos 2 e 5), o do
// mosaico "invertido". Abre com o mouse parado ~300 ms numa linha ou com foco de teclado;
// fecha ao sair (com tolerância para o mouse chegar ao cartão), com Esc e ao rolar.
import { useLayoutEffect, useRef, useState } from 'react';

import { NOMES_ESTADO } from '@dominio/estadoConsumo';

import { COR_DO_ESTADO } from '../componentes/status';
import type { Ancora } from './contexto';
import { ano, estado, NOME_TIPO, nomeSituacao, titulo } from './dados';
import { Capa, Consumo, DETALHE, FOCO, Nota, PontoStatus } from './Itens';

const LARGURA = 320;
const MARGEM = 12;

/** Ao lado do cursor (ou do título, no foco); vira para a esquerda e sobe para caber na tela. */
function posicao(a: Ancora, altura: number) {
  const ref = a.x ?? a.linha.left + Math.min(a.linha.width * 0.42, 440);
  let left = ref + 24;
  if (left + LARGURA > innerWidth - MARGEM) left = ref - 24 - LARGURA;
  left = Math.max(MARGEM, Math.min(left, innerWidth - LARGURA - MARGEM));
  const topoMin = 56 + MARGEM; // abaixo da navegação
  let top = a.linha.top - 12;
  if (top + altura > innerHeight - MARGEM) top = a.linha.bottom - altura + 12;
  top = Math.max(topoMin, Math.min(top, innerHeight - altura - MARGEM));
  return { left, top };
}

export function CartaoDestaque({ a, segurar, soltar }: { a: Ancora; segurar(): void; soltar(): void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (caixa.current) setPos(posicao(a, caixa.current.offsetHeight));
  }, [a]);

  const { item } = a;
  const e = estado(item);
  const fundo = item.banner_url ?? item.poster_url;
  const dados = [NOME_TIPO[item.tipo], nomeSituacao(item), ano(item)].filter(Boolean).join(' · ');
  return (
    <div
      ref={caixa}
      id="cartao-destaque"
      role="dialog"
      aria-label={`Destaque: ${titulo(item)}`}
      onMouseEnter={segurar}
      onMouseLeave={soltar}
      className="fixed z-50 overflow-hidden rounded-xl border border-borda bg-superficie-alta shadow-[0_16px_48px_rgba(0,0,0,0.55)] motion-safe:animate-[surgir_140ms_ease-out]"
      style={{ width: LARGURA, left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div className="relative h-[104px] overflow-hidden bg-superficie">
        {fundo ? <img src={fundo} alt="" className={`h-full w-full object-cover ${item.banner_url ? '' : 'scale-125 blur-md'}`} /> : null}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-superficie-alta via-superficie-alta/30 to-transparent" />
      </div>
      <div className="relative -mt-12 flex gap-3 px-3.5">
        <span className="h-[84px] w-14 shrink-0 overflow-hidden rounded-md bg-superficie shadow-lg ring-1 ring-black/40">
          <Capa item={item} />
        </span>
        <div className="flex min-w-0 flex-col justify-end pb-0.5">
          <p className="line-clamp-2 text-[15px] font-bold leading-tight text-texto-forte">{titulo(item)}</p>
          {dados ? <p className="mt-1 truncate text-[12px] text-texto-suave">{dados}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-3.5 pb-3.5 pt-3">
        {item.sinopse ? <p className="line-clamp-3 text-[13px] leading-snug text-texto">{item.sinopse}</p> : <p className="text-[13px] italic text-texto-suave">Sem sinopse.</p>}
        <div className="flex items-center gap-4">
          <Nota n={item.nota_usuario} tamanho={14} />
          <Consumo item={item} tamanho={14} />
          <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: COR_DO_ESTADO[e] }}>
            <PontoStatus e={e} /> {NOMES_ESTADO[e]}
          </span>
        </div>
        <a
          href={DETALHE}
          className={`inline-flex h-9 items-center justify-center rounded-lg bg-marca-forte px-4 text-[13px] font-semibold text-sobre-marca transition-colors hover:bg-marca ${FOCO}`}
        >
          Ver detalhes
        </a>
      </div>
    </div>
  );
}
