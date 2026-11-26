// PROTÓTIPO (ticket 50), variante A: agenda vertical por dia, horário numa coluna à esquerda,
// cartões compactos, o que já foi ao ar esmaecido e o marcador "agora" em "Hoje".
import { Fragment } from 'react';

import { AcaoLista, Controles, DiaVazio, Selinho } from './Comum';
import { useAcoes } from './contexto';
import { AGORA, type Dia, hora, HORA_AGORA } from './dados';

function Agora() {
  return (
    <li aria-label={`Agora, ${HORA_AGORA}`} className="flex items-center gap-3 py-1">
      <span className="w-14 shrink-0 text-right text-[12px] font-bold text-marca-texto">{HORA_AGORA}</span>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-marca" />
      <span className="h-[2px] flex-1 rounded-full bg-marca" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-marca-texto">agora</span>
    </li>
  );
}

function Linha({ e }: { e: Dia['episodios'][number] }) {
  const { abrir } = useAcoes();
  return (
    <li className={`flex items-center gap-3 ${e.foi ? 'opacity-55' : ''}`}>
      <span className="w-14 shrink-0 text-right text-[15px] font-bold tabular-nums text-texto-forte">{hora(e.quando)}</span>
      <div
        role="button"
        tabIndex={0}
        onClick={() => abrir(e)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md bg-superficie p-2 pr-3 hover:ring-1 hover:ring-borda"
      >
        <img src={e.capa} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded-sm object-cover" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[14px] font-semibold text-texto-forte">{e.titulo}</span>
          <span className="flex items-center gap-2 text-[12px] text-texto-suave">
            <span>Ep. {e.episodio}{e.total ? ` de ${e.total}` : ''}</span>
            {e.foi ? <Selinho>foi ao ar</Selinho> : null}
          </span>
        </div>
        <AcaoLista id={e.id_midia} titulo={e.titulo} compacto />
      </div>
    </li>
  );
}

export function VarianteA({ dias }: { dias: Dia[] }) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <Controles />
      {dias.map((d) => {
        const iAgora = d.hoje ? d.episodios.findIndex((e) => e.quando > AGORA) : -2;
        return (
          <section key={d.chave} aria-label={d.rotulo} className="flex flex-col gap-2">
            <h2 className="sticky top-[72px] z-10 -mx-1 flex items-baseline gap-2 bg-fundo/95 px-1 py-2 backdrop-blur">
              <span className="text-[18px] font-bold text-texto-forte">{d.rotulo}</span>
              <span className="text-[13px] text-texto-suave">{d.subtitulo}</span>
              <span className="ml-auto text-[12px] text-texto-suave">{d.episodios.length || ''}</span>
            </h2>
            {d.episodios.length === 0 ? (
              <DiaVazio />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {d.episodios.map((e, i) => (
                  <Fragment key={e.id_midia + e.episodio}>
                    {i === iAgora ? <Agora /> : null}
                    <Linha e={e} />
                  </Fragment>
                ))}
                {iAgora === -1 ? <Agora /> : null}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
