// PROTÓTIPO (ticket 50), variante B: a semana em 7 colunas, como um calendário de parede; no
// celular, uma coluna por tela com rolagem horizontal e encaixe, e a faixa de dias como índice.
import { useRef } from 'react';

import { AcaoLista, Controles, DiaVazio } from './Comum';
import { useAcoes } from './contexto';
import { type Dia, hora } from './dados';

function Bloco({ e }: { e: Dia['episodios'][number] }) {
  const { abrir } = useAcoes();
  return (
    <li
      onClick={() => abrir(e)}
      className={`flex cursor-pointer flex-col gap-1.5 rounded-md border-l-[3px] bg-superficie p-2 hover:ring-1 hover:ring-borda ${
        e.foi ? 'border-borda opacity-55' : 'border-marca'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[13px] font-bold tabular-nums text-texto-forte">{hora(e.quando)}</span>
        <span className="text-[11px] text-texto-suave">{e.foi ? 'foi ao ar' : `Ep. ${e.episodio}`}</span>
      </div>
      <div className="flex gap-2">
        <img src={e.capa} alt="" loading="lazy" className="h-12 w-8 shrink-0 rounded-sm object-cover" />
        <span className="line-clamp-3 text-[12px] leading-tight text-texto">{e.titulo}</span>
      </div>
      <div className="flex items-center justify-between">
        {e.foi ? <span className="text-[11px] text-texto-suave">Ep. {e.episodio}</span> : <span />}
        <AcaoLista id={e.id_midia} titulo={e.titulo} compacto />
      </div>
    </li>
  );
}

export function VarianteB({ dias }: { dias: Dia[] }) {
  const trilho = useRef<HTMLDivElement>(null);
  const irPara = (i: number) => {
    const el = trilho.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };
  return (
    <div className="flex flex-col gap-4">
      <Controles />
      {/* Índice dos dias: só no celular, onde as colunas viram páginas. */}
      <div className="sem-barra -mx-4 flex gap-1.5 overflow-x-auto px-4 @3xl:hidden">
        {dias.map((d, i) => (
          <button
            key={d.chave}
            type="button"
            onClick={() => irPara(i)}
            className="min-h-9 shrink-0 rounded-full border border-borda px-3 text-[13px] font-semibold capitalize text-texto hover:bg-superficie-alta"
          >
            {d.curto} <span className="text-texto-suave">{d.episodios.length}</span>
          </button>
        ))}
      </div>
      <div
        ref={trilho}
        className="sem-barra -mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-4 px-4 @3xl:mx-0 @3xl:grid @3xl:grid-cols-7 @3xl:gap-2 @3xl:overflow-visible @3xl:px-0"
      >
        {dias.map((d) => (
          <section
            key={d.chave}
            aria-label={d.rotulo}
            className={`flex w-[85%] shrink-0 snap-start flex-col gap-2 rounded-lg p-2 @3xl:w-auto @3xl:min-w-0 ${d.hoje ? 'bg-marca/10 ring-1 ring-marca/40' : 'bg-superficie/40'}`}
          >
            <h2 className="flex flex-col px-1 pb-1">
              <span className={`text-[15px] font-bold ${d.hoje ? 'text-marca-texto' : 'text-texto-forte'}`}>{d.rotulo}</span>
              <span className="text-[12px] text-texto-suave">{d.subtitulo}</span>
            </h2>
            {d.episodios.length === 0 ? (
              <DiaVazio compacto />
            ) : (
              <ul className="flex flex-col gap-2">
                {d.episodios.map((e) => (
                  <Bloco key={e.id_midia + e.episodio} e={e} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
