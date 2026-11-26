// PROTÓTIPO (ticket 50), variante C: dia em foco. Faixa de dias no topo (nome e contagem),
// a lista do dia escolhido em cartões grandes, e o bloco "A seguir" com o próximo dos seus.
import { useState } from 'react';

import { AcaoLista, DiaVazio, FiltroMeus, NotaHorario } from './Comum';
import { useAcoes } from './contexto';
import { capaGrande, type Dia, hora, relativo, semana } from './dados';

function CartaoGrande({ e }: { e: Dia['episodios'][number] }) {
  const { abrir } = useAcoes();
  return (
    <li
      onClick={() => abrir(e)}
      className={`relative flex cursor-pointer gap-4 overflow-hidden rounded-lg bg-superficie p-3 hover:ring-1 hover:ring-borda ${e.foi ? 'opacity-60' : ''}`}
    >
      <img src={capaGrande(e.capa)} alt="" loading="lazy" className="aspect-[2/3] w-[84px] shrink-0 rounded-md object-cover @2xl:w-[104px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
        <span className="flex items-baseline gap-2">
          <span className="text-[22px] font-bold tabular-nums leading-none text-texto-forte">{hora(e.quando)}</span>
          <span className={`text-[13px] font-semibold ${e.foi ? 'text-texto-suave' : 'text-marca-texto'}`}>{e.foi ? 'foi ao ar' : relativo(e.quando)}</span>
        </span>
        <span className="line-clamp-2 text-[16px] font-bold leading-snug text-texto-forte">{e.titulo}</span>
        <span className="text-[13px] text-texto-suave">
          Ep. {e.episodio}
          {e.total ? ` de ${e.total}` : ''}
          {e.estudio ? ` · ${e.estudio}` : ''}
        </span>
        <span className="mt-auto pt-1">
          <AcaoLista id={e.id_midia} titulo={e.titulo} />
        </span>
      </div>
    </li>
  );
}

function ASeguir() {
  const { lista, abrir } = useAcoes();
  const prox = semana(lista, true)
    .flatMap((d) => d.episodios.map((e) => ({ ...e, dia: d })))
    .find((e) => !e.foi);
  return (
    <aside aria-label="A seguir" className="flex flex-col gap-2 rounded-lg bg-gradient-to-br from-marca/25 to-superficie p-4 ring-1 ring-marca/30">
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-marca-texto">A seguir dos seus</h2>
      {prox ? (
        <button type="button" onClick={() => abrir(prox)} className="flex gap-3 text-left">
          <img src={capaGrande(prox.capa)} alt="" className="aspect-[2/3] w-16 shrink-0 rounded-md object-cover" />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="line-clamp-2 font-bold text-texto-forte">{prox.titulo}</span>
            <span className="text-[13px] text-texto">Ep. {prox.episodio}</span>
            <span className="text-[13px] text-texto-suave">
              {prox.dia.rotulo}, {hora(prox.quando)} · {relativo(prox.quando)}
            </span>
          </span>
        </button>
      ) : (
        <p className="text-[13px] text-texto-suave">Nenhum dos seus sai nos próximos 7 dias.</p>
      )}
    </aside>
  );
}

export function VarianteC({ dias }: { dias: Dia[] }) {
  const [i, setI] = useState(0);
  const dia = dias[i]!;
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Dias" className="sem-barra -mx-4 flex gap-2 overflow-x-auto px-4 @2xl:mx-0 @2xl:px-0">
        {dias.map((d, j) => (
          <button
            key={d.chave}
            role="tab"
            type="button"
            aria-selected={j === i}
            onClick={() => setI(j)}
            className={`flex min-w-[68px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition @2xl:min-w-[92px] ${
              j === i ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-texto hover:bg-superficie-alta'
            }`}
          >
            <span className="text-[13px] font-bold capitalize">{d.curto}</span>
            <span className={`text-[11px] ${j === i ? 'opacity-90' : 'text-texto-suave'}`}>{d.chave.slice(8)}/{d.chave.slice(5, 7)}</span>
            <span className={`mt-1 text-[18px] font-bold leading-none ${d.episodios.length ? '' : 'opacity-40'}`}>{d.episodios.length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col-reverse gap-6 @4xl:grid @4xl:grid-cols-[1fr_300px] @4xl:items-start">
        <section aria-label={dia.rotulo} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[20px] font-bold text-texto-forte">
              {dia.rotulo} <span className="text-[14px] font-normal normal-case text-texto-suave">{dia.subtitulo}</span>
            </h2>
            <FiltroMeus />
          </div>
          {dia.episodios.length === 0 ? (
            <DiaVazio />
          ) : (
            <ul className="grid gap-3 @3xl:grid-cols-2">
              {dia.episodios.map((e) => (
                <CartaoGrande key={e.id_midia + e.episodio} e={e} />
              ))}
            </ul>
          )}
          <NotaHorario />
        </section>
        <div className="@4xl:sticky @4xl:top-[96px]">
          <ASeguir />
        </div>
      </div>
    </div>
  );
}
