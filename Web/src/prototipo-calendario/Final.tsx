// PROTÓTIPO (ticket 50), 2ª rodada: a proposta final. De cima para baixo: "A seguir dos seus",
// linha de controles (filtro, alternador Agenda | Semana, nota do horário), faixa de dias
// (opcional, para comparar) e a visualização escolhida.
import { Fragment, type RefObject, useEffect, useRef, useState } from 'react';

import { AcaoLista, DiaVazio, FiltroMeus, NotaHorario, Selinho } from './Comum';
import { useAcoes } from './contexto';
import { AGORA, capaGrande, type Dia, hora, HORA_AGORA, relativo, semana } from './dados';
import type { Vista } from './variantes';

type Ep = Dia['episodios'][number];
const dataCurta = (d: Dia) => `${d.chave.slice(8)}/${d.chave.slice(5, 7)}`;

/** O próximo episódio ainda não exibido de um dos seus, mesmo com o filtro desligado. */
function ASeguir() {
  const { lista, abrir } = useAcoes();
  const prox = semana(lista, true)
    .flatMap((d) => d.episodios.map((e) => ({ ...e, dia: d })))
    .find((e) => !e.foi);
  if (!prox) return null;
  return (
    <aside aria-label="A seguir dos seus" className="rounded-lg bg-gradient-to-br from-marca/25 to-superficie p-3 ring-1 ring-marca/30 @2xl:p-4">
      <button type="button" onClick={() => abrir(prox)} className="flex w-full items-center gap-3 text-left">
        <img src={capaGrande(prox.capa)} alt="" className="aspect-[2/3] w-14 shrink-0 rounded-md object-cover" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[12px] font-bold uppercase tracking-wide text-marca-texto">A seguir dos seus</span>
          <span className="line-clamp-2 font-bold leading-snug text-texto-forte">{prox.titulo}</span>
          <span className="text-[13px] text-texto">
            Ep. {prox.episodio} · {prox.dia.rotulo}, {hora(prox.quando)} <span className="text-texto-suave">· {relativo(prox.quando)}</span>
          </span>
        </span>
      </button>
    </aside>
  );
}

function Alternador({ vista, mudar }: { vista: Vista; mudar(v: Vista): void }) {
  return (
    <div role="radiogroup" aria-label="Visualização" className="inline-flex rounded-lg border border-borda p-0.5">
      {(['agenda', 'semana'] as const).map((x) => (
        <button
          key={x}
          type="button"
          role="radio"
          aria-checked={vista === x}
          onClick={() => mudar(x)}
          className={`min-h-9 rounded-md px-3 text-[13px] font-semibold capitalize ${vista === x ? 'bg-superficie-alta text-texto-forte' : 'text-texto-suave hover:text-texto-forte'}`}
        >
          {x}
        </button>
      ))}
    </div>
  );
}

function Faixa({ dias, ativo, ir, ref }: { dias: Dia[]; ativo: number; ir(i: number): void; ref: RefObject<HTMLDivElement | null> }) {
  const trilho = useRef<HTMLDivElement>(null);
  // Mantém o chip ativo visível quando a faixa rola (celular).
  useEffect(() => {
    const t = trilho.current;
    const b = t?.children[ativo] as HTMLElement | undefined;
    if (t && b && t.scrollWidth > t.clientWidth) t.scrollTo({ left: b.offsetLeft - t.clientWidth / 2 + b.clientWidth / 2, behavior: 'smooth' });
  }, [ativo]);
  return (
    <div ref={ref} className="sticky top-[72px] z-20 -mx-4 bg-fundo/95 px-4 py-2 backdrop-blur @2xl:mx-0 @2xl:px-0">
      <div ref={trilho} role="tablist" aria-label="Dias" className="sem-barra relative -mx-4 flex gap-2 overflow-x-auto px-4 @2xl:mx-0 @2xl:px-0">
        {dias.map((d, j) => (
          <button
            key={d.chave}
            role="tab"
            type="button"
            aria-selected={j === ativo}
            onClick={() => ir(j)}
            className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-2.5 py-1.5 transition @3xl:flex-1 ${
              j === ativo ? 'border-marca bg-marca text-sobre-marca' : `border-borda hover:bg-superficie-alta ${d.hoje ? 'text-marca-texto' : 'text-texto'}`
            }`}
          >
            <span className="text-[13px] font-bold capitalize">{d.curto}</span>
            <span className={`text-[11px] ${j === ativo ? 'opacity-90' : 'text-texto-suave'}`}>{dataCurta(d)}</span>
            <span className={`mt-0.5 text-[17px] font-bold leading-none ${d.episodios.length ? '' : 'opacity-40'}`}>{d.episodios.length}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Agenda ----------

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

function Linha({ e }: { e: Ep }) {
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
            <span>
              Ep. {e.episodio}
              {e.total ? ` de ${e.total}` : ''}
            </span>
            {e.foi ? <Selinho>foi ao ar</Selinho> : null}
          </span>
        </div>
        <AcaoLista id={e.id_midia} titulo={e.titulo} compacto />
      </div>
    </li>
  );
}

function Agenda({ dias, secoes, comFaixa }: { dias: Dia[]; secoes: RefObject<(HTMLElement | null)[]>; comFaixa: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      {dias.map((d, j) => {
        const iAgora = d.hoje ? d.episodios.findIndex((e) => e.quando > AGORA) : -2;
        return (
          <section
            key={d.chave}
            ref={(el) => {
              secoes.current[j] = el;
            }}
            aria-label={d.rotulo}
            className="flex scroll-mt-[168px] flex-col gap-2"
          >
            {/* Com a faixa fixa, o título do dia não precisa grudar no topo. */}
            <h2 className={`-mx-1 flex items-baseline gap-2 px-1 py-2 ${comFaixa ? '' : 'sticky top-[72px] z-10 bg-fundo/95 backdrop-blur'}`}>
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

// ---------- Semana ----------

function Bloco({ e }: { e: Ep }) {
  const { abrir } = useAcoes();
  return (
    <li
      onClick={() => abrir(e)}
      className={`flex cursor-pointer flex-col gap-1.5 rounded-md border-l-[3px] bg-superficie p-2 hover:ring-1 hover:ring-borda ${e.foi ? 'border-borda opacity-55' : 'border-marca'}`}
    >
      <div className="flex items-center gap-2">
        <img src={e.capa} alt="" loading="lazy" className="h-10 w-7 shrink-0 rounded-sm object-cover" />
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-bold tabular-nums leading-tight text-texto-forte">{hora(e.quando)}</span>
          <span className="text-[12px] text-texto-suave">
            Ep. {e.episodio}
            {e.foi ? ' · foi ao ar' : ''}
          </span>
        </span>
      </div>
      <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-texto-forte" title={e.titulo}>
        {e.titulo}
      </span>
      <AcaoLista id={e.id_midia} titulo={e.titulo} compacto />
    </li>
  );
}

function Semana({ dias, ativo, trilho, aoRolar }: { dias: Dia[]; ativo: number | null; trilho: RefObject<HTMLDivElement | null>; aoRolar(): void }) {
  return (
    <div
      ref={trilho}
      onScroll={aoRolar}
      className="sem-barra relative -mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-4 px-4 @3xl:mx-0 @3xl:grid @3xl:grid-cols-7 @3xl:gap-2 @3xl:overflow-visible @3xl:px-0"
    >
      {dias.map((d, j) => (
        <section
          key={d.chave}
          aria-label={d.rotulo}
          className={`flex w-[85%] shrink-0 snap-start flex-col gap-2 rounded-lg p-1.5 transition @3xl:w-auto @3xl:min-w-0 ${d.hoje ? 'bg-marca/10' : 'bg-superficie/40'} ${
            j === ativo ? 'ring-2 ring-marca' : d.hoje ? 'ring-1 ring-marca/40' : ''
          }`}
        >
          <h2 className="flex items-baseline justify-between gap-1 px-1 pb-1 pt-0.5">
            <span className={`text-[15px] font-bold ${d.hoje ? 'text-marca-texto' : 'text-texto-forte'}`}>{d.rotulo}</span>
            <span className="text-[12px] text-texto-suave">{dataCurta(d)}</span>
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
  );
}

// ---------- a página ----------

export function Final({ dias, comFaixa, vista, mudarVista }: { dias: Dia[]; comFaixa: boolean; vista: Vista; mudarVista(v: Vista): void }) {
  const [ativo, setAtivo] = useState(0);
  const faixa = useRef<HTMLDivElement>(null);
  const secoes = useRef<(HTMLElement | null)[]>([]);
  const trilho = useRef<HTMLDivElement>(null);
  const travado = useRef(0); // rolagem programada em curso: não deixa o chip "passear" pelos dias do meio

  const travar = () => {
    travado.current = Date.now() + 700;
  };

  // Agenda: o chip ativo acompanha a rolagem da página.
  useEffect(() => {
    if (!comFaixa || vista !== 'agenda') return;
    const f = () => {
      if (Date.now() < travado.current) return;
      const lim = (faixa.current?.getBoundingClientRect().bottom ?? 72) + 24;
      let a = 0;
      secoes.current.forEach((s, i) => {
        if (s && s.getBoundingClientRect().top <= lim) a = i;
      });
      setAtivo(a);
    };
    addEventListener('scroll', f, { passive: true });
    return () => removeEventListener('scroll', f);
  }, [comFaixa, vista]);

  const rolando = () => {
    const t = trilho.current;
    if (!t || t.scrollWidth <= t.clientWidth || Date.now() < travado.current) return;
    const cols = [...t.children] as HTMLElement[];
    let a = 0;
    cols.forEach((c, i) => {
      if (c.offsetLeft - t.scrollLeft <= t.clientWidth / 3) a = i;
    });
    setAtivo(a);
  };

  const ir = (i: number) => {
    setAtivo(i);
    travar();
    if (vista === 'agenda') {
      secoes.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const t = trilho.current;
      const c = t?.children[i] as HTMLElement | undefined;
      if (t && c && t.scrollWidth > t.clientWidth) t.scrollTo({ left: c.offsetLeft - 16, behavior: 'smooth' });
    }
  };

  const mudar = (v: Vista) => {
    setAtivo(0);
    mudarVista(v);
  };

  return (
    <div className={`mx-auto flex w-full flex-col gap-4 ${vista === 'agenda' ? 'max-w-[760px]' : ''}`}>
      <ASeguir />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <FiltroMeus />
        <Alternador vista={vista} mudar={mudar} />
        <NotaHorario className="w-full @2xl:ml-auto @2xl:w-auto" />
      </div>
      {comFaixa ? <Faixa ref={faixa} dias={dias} ativo={ativo} ir={ir} /> : null}
      {vista === 'agenda' ? (
        <Agenda dias={dias} secoes={secoes} comFaixa={comFaixa} />
      ) : (
        <Semana dias={dias} ativo={comFaixa ? ativo : null} trilho={trilho} aoRolar={rolando} />
      )}
    </div>
  );
}
