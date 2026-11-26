// PROTÓTIPO (ticket 50): barra de variantes (← → e as teclas) e o alternador de tela. Visual de
// ferramenta (amarelo/preto), fora do design avaliado. Some no build de produção.
import { useEffect } from 'react';

import { type Chave, type Tela, VARIANTES } from './variantes';

function digitando(alvo: EventTarget | null) {
  const el = alvo as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

const BOTAO = 'rounded border border-black px-2 py-0.5 hover:bg-black hover:text-yellow-300';

export function Barra({ v, tela, mudar }: { v: Chave; tela: Tela; mudar(p: { v?: Chave; tela?: Tela }): void }) {
  const i = VARIANTES.findIndex((x) => x.chave === v);
  const passo = (d: number) => mudar({ v: VARIANTES[(i + d + VARIANTES.length) % VARIANTES.length]!.chave });

  useEffect(() => {
    function tecla(ev: KeyboardEvent) {
      if (digitando(ev.target) || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key === 'ArrowLeft') passo(-1);
      else if (ev.key === 'ArrowRight') passo(1);
    }
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  });

  if (import.meta.env.PROD) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[1000] flex w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border-2 border-black bg-yellow-300 px-3 py-1.5 font-mono text-[12px] text-black shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
      <b className="hidden sm:inline">PROTÓTIPO</b>
      <button type="button" aria-label="Variante anterior" className={BOTAO} onClick={() => passo(-1)}>
        ←
      </button>
      <b className="sm:min-w-[150px] text-center">
        {v} · {VARIANTES[i]!.nome}
      </b>
      <button type="button" aria-label="Próxima variante" className={BOTAO} onClick={() => passo(1)}>
        →
      </button>
      <span className="sm:ml-2">Tela:</span>
      {(['desktop', 'celular'] as const).map((t) => (
        <button key={t} type="button" aria-pressed={tela === t} onClick={() => mudar({ tela: t })} className={`${BOTAO} ${tela === t ? 'bg-black text-yellow-300' : ''}`}>
          {t}
        </button>
      ))}
    </div>
  );
}
