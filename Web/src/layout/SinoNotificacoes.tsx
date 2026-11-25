// Sino da nav (Q76): ponto carmesim quando há Notificação não lida e um painel com as mais
// recentes. A lista completa fica no Perfil; as duas telas dividem a mesma consulta.
import { Link } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';

import { mensagemDeErro } from '../api/erros';
import { Botao } from '../componentes/Botao';
import { Icone } from '../componentes/Icone';
import { chaveDaNotificacao, useMarcarTodasLidas, useNotificacoes } from '../notificacoes/consultas';
import { ItemNotificacao } from '../notificacoes/ItemNotificacao';

/** Quantas Notificações o painel mostra. */
const RECENTES = 5;

const rotuloDoSino = (naoLidas: number) =>
  naoLidas === 0 ? 'Notificações' : `Notificações, ${naoLidas} ${naoLidas === 1 ? 'não lida' : 'não lidas'}`;

export function SinoNotificacoes({ sobreImagem }: { sobreImagem: boolean }) {
  const consulta = useNotificacoes();
  const marcar = useMarcarTodasLidas();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const titulo = useId();
  const notificacoes = consulta.data ?? [];
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  const fechar = () => {
    setAberto(false);
    botao.current?.focus();
  };

  return (
    <div
      ref={raiz}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && aberto) fechar();
      }}
    >
      <button
        ref={botao}
        type="button"
        aria-label={rotuloDoSino(naoLidas)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        onClick={() => setAberto((a) => !a)}
        className={`relative flex h-11 w-11 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-marca-texto ${
          sobreImagem ? 'text-white hover:bg-white/10' : 'text-texto-forte hover:bg-superficie-alta'
        }`}
      >
        <Icone nome="sino" />
        {naoLidas > 0 ? (
          <span
            data-testid="ponto-nao-lidas"
            aria-hidden
            className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-marca ring-2 ring-nav"
          />
        ) : null}
      </button>
      {aberto ? (
        <div
          role="dialog"
          aria-labelledby={titulo}
          className="absolute right-0 top-12 z-50 flex max-h-[70vh] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-borda bg-superficie shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-borda px-4 py-3">
            <h2 id={titulo} className="font-semibold text-texto-forte">
              Notificações
            </h2>
            {naoLidas > 0 ? (
              <Botao variante="fantasma" className="ml-auto -mr-2" carregando={marcar.isPending} onClick={() => marcar.mutate()}>
                Marcar todas como lidas
              </Botao>
            ) : null}
          </div>
          <div className="overflow-y-auto p-2">
            {consulta.isError && !consulta.data ? (
              <p className="p-3 text-[14px] text-texto-suave">{mensagemDeErro(consulta.error)}</p>
            ) : notificacoes.length ? (
              <ul className="flex flex-col gap-1">
                {notificacoes.slice(0, RECENTES).map((n, i) => (
                  <ItemNotificacao key={chaveDaNotificacao(n, i)} notificacao={n} aoAbrir={() => setAberto(false)} />
                ))}
              </ul>
            ) : (
              <p className="p-3 text-center text-[14px] text-texto-suave">Nenhuma notificação por aqui.</p>
            )}
            {marcar.isError ? (
              <p role="alert" className="px-3 pb-2 text-[13px] text-erro">
                {mensagemDeErro(marcar.error)}
              </p>
            ) : null}
          </div>
          <Link
            to="/perfil"
            onClick={() => setAberto(false)}
            className="border-t border-borda px-4 py-3 text-center text-[14px] font-semibold text-marca-texto outline-none hover:bg-superficie-alta focus-visible:bg-superficie-alta"
          >
            Ver todas no Perfil
          </Link>
        </div>
      ) : null}
    </div>
  );
}
