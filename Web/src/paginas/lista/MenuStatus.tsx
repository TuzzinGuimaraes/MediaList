// Menu de Status do Item (veredito do ticket 39): na Lista só se muda o Status; o resto se
// edita no detalhe. Botão de menu (padrão ARIA): abre no Status atual, setas/Home/End movem,
// Esc ou Tab fecham e o foco volta ao botão.
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { estadoDe, NOMES_ESTADO, rotuloPara } from '@dominio/estadoConsumo';
import { estadosDaLista } from '@dominio/itemLista';
import { tituloDaMidia } from '@dominio/midia';

import { FOCO } from '../../componentes/estilos';
import { COR_DO_ESTADO } from '../../componentes/status';
import type { ItemLista } from './api';
import { textos } from './textos';

type Props = {
  item: ItemLista;
  mudar(item: ItemLista, rotulo: string): void;
  /** Classes do botão (o ⋯ da capa ou, no ticket 02, o Status da linha). */
  classeBotao: string;
  children: React.ReactNode;
};

export function MenuStatus({ item, mudar, classeBotao, children }: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idMenu = useId();
  const estados = estadosDaLista([item.tipo]);
  const atual = estadoDe(item.status_consumo, item.tipo);
  const titulo = tituloDaMidia(item);

  const opcoes = () => [...(caixa.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
  const fechar = (devolverFoco: boolean) => {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  };

  useEffect(() => {
    if (!aberto) return;
    const marcada = opcoes().find((o) => o.getAttribute('aria-checked') === 'true') ?? opcoes()[0];
    marcada?.focus();
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const teclas = (e: KeyboardEvent) => {
    const lista = opcoes();
    const i = lista.indexOf(document.activeElement as HTMLElement);
    const alvo =
      e.key === 'ArrowDown' ? (i + 1) % lista.length
      : e.key === 'ArrowUp' ? (i - 1 + lista.length) % lista.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? lista.length - 1
      : null;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      fechar(true);
    } else if (e.key === 'Tab') {
      fechar(false);
    } else if (alvo !== null) {
      e.preventDefault();
      lista[alvo]?.focus();
    }
  };

  return (
    <div ref={caixa} className="relative" onKeyDown={aberto ? teclas : undefined}>
      <button
        ref={botao}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        aria-label={textos.menuStatus(titulo, atual ? NOMES_ESTADO[atual] : item.status_consumo)}
        title={atual ? `${textos.status}: ${NOMES_ESTADO[atual]}` : undefined}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={(e) => {
          if (!aberto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setAberto(true);
          }
        }}
        className={`${classeBotao} ${FOCO}`}
      >
        {children}
      </button>
      {aberto ? (
        <div
          id={idMenu}
          role="menu"
          aria-label={`${textos.status} de ${titulo}`}
          className="absolute left-0 z-40 mt-1 w-44 overflow-hidden rounded-lg border border-borda bg-superficie-alta py-1 shadow-2xl motion-safe:animate-[surgir_120ms_ease-out]"
        >
          {estados.map((e) => {
            const rotulo = rotuloPara(e, item.tipo);
            return (
              <button
                key={e}
                type="button"
                role="menuitemradio"
                aria-checked={e === atual}
                tabIndex={-1}
                onClick={() => {
                  if (rotulo && e !== atual) mudar(item, rotulo);
                  fechar(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-texto outline-none hover:bg-superficie focus-visible:bg-superficie"
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: COR_DO_ESTADO[e] }} />
                <span className="flex-1">{NOMES_ESTADO[e]}</span>
                {e === atual ? (
                  <span aria-hidden className="text-marca-texto">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
