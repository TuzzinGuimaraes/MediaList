// Calendário da semana (ticket 50 da revisão), a aba da Temporada atual: os episódios dos
// próximos 7 dias, de Hoje em diante, na hora do fuso do navegador. De cima para baixo:
// "A seguir dos seus"; o filtro "Só os meus", o alternador Agenda | Semana (guardado no
// navegador, estado de interface) e a nota do horário; a faixa de dias (fora da Semana do
// desktop, onde as colunas já são os dias); e a visualização. Janela, dias, filtro e o padrão
// dele, "foi ao ar" e "A seguir dos seus" vêm de `@dominio/calendario`, os mesmos do app.
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Fragment, type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import {
  aSeguirDosSeus,
  type ASeguir,
  consultaDoCalendario,
  type DiaDoCalendario,
  diasDoCalendario,
  type EpisodioDoCalendario,
  type EpisodioNoDia,
  type ItemDoCalendario,
  NOTA_DO_HORARIO,
  soOsMeusPorPadrao,
} from '@dominio/calendario';
import { tituloDaMidia } from '@dominio/midia';

import { chaves } from '../../api/chaves';
import { exigir } from '../../api/cliente';
import { mensagemDeErro } from '../../api/erros';
import { Botao } from '../../componentes/Botao';
import { Carregando, ErroTela, Vazio } from '../../componentes/Estados';
import { Icone } from '../../componentes/Icone';
import { Monograma } from '../../componentes/Monograma';
import { ALTURA_NAV } from '../../layout/Casca';
import { useTelaLarga } from '../../layout/telaLarga';
import { useApi } from '../../sessao/SessaoContext';
import { useAdicionarComoPlanejado, useLista } from '../lista/api';

type Dia = DiaDoCalendario<EpisodioDoCalendario>;
type NoDia = EpisodioNoDia<EpisodioDoCalendario>;
type Vista = 'agenda' | 'semana';

const CHAVE_VISTA = 'medialist.calendario.vista';
const MINUTO = 60_000;
/** Depois de tocar num dia, a rolagem programada não mexe no dia ativo por este tempo. */
const TRAVA_DA_ROLAGEM = 700;

function lerVista(): Vista {
  try {
    return localStorage.getItem(CHAVE_VISTA) === 'semana' ? 'semana' : 'agenda';
  } catch {
    return 'agenda';
  }
}

function useVista(): [Vista, (vista: Vista) => void] {
  const [vista, setVista] = useState(lerVista);
  const mudar = useCallback((nova: Vista) => {
    setVista(nova);
    try {
      localStorage.setItem(CHAVE_VISTA, nova);
    } catch {
      // Sem armazenamento, vale até recarregar.
    }
  }, []);
  return [vista, mudar];
}

/** O instante de agora, renovado a cada minuto ("foi ao ar", o marcador "agora", a virada do dia). */
function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), MINUTO);
    return () => clearInterval(id);
  }, []);
  return agora;
}

const FUSO = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "Horário Padrão de Brasília", ou null se o navegador não souber dizer. */
function nomeDoFuso(agora: Date): string | null {
  try {
    const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, timeZoneName: 'longGeneric' }).formatToParts(agora);
    return partes.find((p) => p.type === 'timeZoneName')?.value ?? null;
  } catch {
    return null;
  }
}

const horaDe = (agora: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(agora);

const contagem = (n: number) => (n === 0 ? 'nenhum episódio' : n === 1 ? '1 episódio' : `${n} episódios`);

export function Calendario() {
  const agora = useAgora();
  const { de, ate } = consultaDoCalendario(agora, FUSO);
  const api = useApi();
  const episodios = useQuery({
    queryKey: chaves.midias.calendario(de, ate),
    queryFn: () => exigir(api.GET('/api/midias/calendario', { params: { query: { de, ate } } })),
    select: (r) => r.episodios,
  });
  const lista = useLista();

  if (episodios.isPending || lista.isPending) return <Carregando rotulo="Buscando o Calendário" />;
  if (episodios.isError) return <ErroTela erro={episodios.error} tentarDeNovo={() => void episodios.refetch()} />;
  // Sem a Lista, o Calendário ainda mostra todos os episódios (nenhum é "dos meus").
  return <Semana7 episodios={episodios.data} itens={lista.data ?? []} agora={agora} />;
}

type PropsSemana7 = { episodios: EpisodioDoCalendario[]; itens: readonly ItemDoCalendario[]; agora: Date };

function Semana7({ episodios, itens, agora }: PropsSemana7) {
  // O padrão é lido uma vez: pôr um anime em Planejado não liga o filtro sozinho.
  const [soOsMeus, setSoOsMeus] = useState(() => soOsMeusPorPadrao(episodios, itens));
  const [vista, mudarVista] = useVista();
  const dias = diasDoCalendario(episodios, { agora, fuso: FUSO, itens, soOsMeus });
  const aSeguir = aSeguirDosSeus(episodios, { agora, fuso: FUSO, itens });
  const naLista = new Set(itens.map((i) => i.id_midia));
  const vazia = dias.every((d) => d.total === 0);
  const nome = nomeDoFuso(agora);

  return (
    <div className={`mx-auto flex w-full flex-col gap-4 ${vista === 'agenda' ? 'max-w-[760px]' : ''}`}>
      {aSeguir ? <BlocoASeguir aSeguir={aSeguir} /> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <FiltroMeus ligado={soOsMeus} mudar={setSoOsMeus} />
        <Alternador vista={vista} mudar={mudarVista} />
        <p className="w-full text-[12px] text-texto-suave md:ml-auto md:w-auto">
          {nome ? `${nome} · ` : ''}
          {NOTA_DO_HORARIO}
        </p>
      </div>
      {vazia ? (
        soOsMeus ? (
          <Vazio
            texto="Nenhum dos seus animes sai nos próximos 7 dias."
            acao={
              <Botao variante="secundario" onClick={() => setSoOsMeus(false)}>
                Ver todos os animes
              </Botao>
            }
          />
        ) : (
          <Vazio texto="Nenhum episódio nos próximos 7 dias." />
        )
      ) : (
        <Visualizacao key={vista} dias={dias} vista={vista} agora={agora} naLista={naLista} soOsMeus={soOsMeus} />
      )}
    </div>
  );
}

// ---------- os controles ----------

function BlocoASeguir({ aSeguir }: { aSeguir: ASeguir<EpisodioDoCalendario> }) {
  const { episodio, dia, hora } = aSeguir;
  return (
    <aside aria-label="A seguir dos seus" className="rounded-lg bg-gradient-to-br from-marca/25 to-superficie p-3 ring-1 ring-marca/30 md:p-4">
      <Link
        to="/midia/$id"
        params={{ id: episodio.id_midia }}
        className="flex w-full items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-marca-texto"
      >
        <Capa url={episodio.poster_url} className="aspect-[2/3] w-14 rounded-md" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[12px] font-bold uppercase tracking-wide text-marca-texto">A seguir dos seus</span>
          <span className="line-clamp-2 font-bold leading-snug text-texto-forte">{tituloDaMidia(episodio)}</span>
          <span className="text-[13px] text-texto">{`Ep. ${episodio.episodio} · ${dia}, ${hora}`}</span>
        </span>
      </Link>
    </aside>
  );
}

function FiltroMeus({ ligado, mudar }: { ligado: boolean; mudar(ligado: boolean): void }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-texto-forte">
      <input type="checkbox" className="peer sr-only" checked={ligado} onChange={(e) => mudar(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-6 w-10 rounded-full bg-superficie-alta ring-1 ring-borda transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-marca peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-marca-texto"
      />
      Só os meus
    </label>
  );
}

const VISTAS: { valor: Vista; nome: string }[] = [
  { valor: 'agenda', nome: 'Agenda' },
  { valor: 'semana', nome: 'Semana' },
];

function Alternador({ vista, mudar }: { vista: Vista; mudar(vista: Vista): void }) {
  return (
    <fieldset className="inline-flex rounded-lg border border-borda p-0.5">
      <legend className="sr-only">Visualização</legend>
      {VISTAS.map((v) => (
        <label key={v.valor} className="cursor-pointer">
          <input type="radio" name="vista-do-calendario" className="peer sr-only" checked={vista === v.valor} onChange={() => mudar(v.valor)} />
          <span className="inline-flex min-h-9 items-center rounded-md px-3 text-[13px] font-semibold text-texto-suave hover:text-texto-forte peer-checked:bg-superficie-alta peer-checked:text-texto-forte peer-focus-visible:ring-2 peer-focus-visible:ring-marca-texto">
            {v.nome}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

// ---------- a visualização: faixa de dias + Agenda ou Semana ----------

type PropsVisualizacao = { dias: Dia[]; vista: Vista; agora: Date; naLista: Set<string>; soOsMeus: boolean };

function Visualizacao({ dias, vista, agora, naLista, soOsMeus }: PropsVisualizacao) {
  const larga = useTelaLarga();
  const comFaixa = vista === 'agenda' || !larga;
  const [ativo, setAtivo] = useState(0);
  const faixa = useRef<HTMLDivElement>(null);
  const secoes = useRef<(HTMLElement | null)[]>([]);
  const trilho = useRef<HTMLDivElement>(null);
  const travadoAte = useRef(0);

  // Agenda: o dia ativo da faixa acompanha a rolagem da página.
  useEffect(() => {
    if (vista !== 'agenda') return;
    const rolou = () => {
      if (Date.now() < travadoAte.current) return;
      const limite = (faixa.current?.getBoundingClientRect().bottom ?? ALTURA_NAV) + 24;
      let dia = 0;
      secoes.current.forEach((s, i) => {
        if (s && s.getBoundingClientRect().top <= limite) dia = i;
      });
      setAtivo(dia);
    };
    addEventListener('scroll', rolou, { passive: true });
    return () => removeEventListener('scroll', rolou);
  }, [vista]);

  // Semana no celular: o dia ativo é a coluna encostada à esquerda do trilho.
  const trilhoRolou = () => {
    const t = trilho.current;
    if (!t || t.scrollWidth <= t.clientWidth || Date.now() < travadoAte.current) return;
    let dia = 0;
    Array.from(t.children).forEach((c, i) => {
      if ((c as HTMLElement).offsetLeft - t.scrollLeft <= t.clientWidth / 3) dia = i;
    });
    setAtivo(dia);
  };

  const irPara = (i: number) => {
    setAtivo(i);
    travadoAte.current = Date.now() + TRAVA_DA_ROLAGEM;
    if (vista === 'agenda') {
      secoes.current[i]?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      return;
    }
    const t = trilho.current;
    const coluna = t?.children[i] as HTMLElement | undefined;
    if (t && coluna && t.scrollWidth > t.clientWidth) t.scrollTo?.({ left: coluna.offsetLeft - 16, behavior: 'smooth' });
  };

  return (
    <>
      {comFaixa ? <Faixa dias={dias} ativo={ativo} irPara={irPara} ref={faixa} /> : null}
      {vista === 'agenda' ? (
        <Agenda dias={dias} agora={agora} naLista={naLista} soOsMeus={soOsMeus} secoes={secoes} />
      ) : (
        <Semana dias={dias} larga={larga} ativo={comFaixa ? ativo : null} naLista={naLista} soOsMeus={soOsMeus} trilho={trilho} aoRolar={trilhoRolou} />
      )}
    </>
  );
}

type PropsFaixa = { dias: Dia[]; ativo: number; irPara(i: number): void; ref: RefObject<HTMLDivElement | null> };

function Faixa({ dias, ativo, irPara, ref }: PropsFaixa) {
  const trilho = useRef<HTMLDivElement>(null);
  // Mantém o dia ativo visível quando a faixa não cabe (celular).
  useEffect(() => {
    const t = trilho.current;
    const chip = t?.children[ativo] as HTMLElement | undefined;
    if (t && chip && t.scrollWidth > t.clientWidth) {
      t.scrollTo?.({ left: chip.offsetLeft - t.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
    }
  }, [ativo]);
  return (
    <div ref={ref} className="sticky z-20 -mx-6 bg-fundo/95 py-2 backdrop-blur md:mx-0" style={{ top: ALTURA_NAV }}>
      <nav aria-label="Dias">
        <div ref={trilho} className="sem-barra flex gap-2 overflow-x-auto px-6 md:px-0">
          {dias.map((d, i) => (
            <button
              key={d.chave}
              type="button"
              aria-label={`${d.curto}, ${d.data}, ${contagem(d.total)}`}
              aria-current={i === ativo ? 'true' : undefined}
              onClick={() => irPara(i)}
              className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-2.5 py-1.5 outline-none transition focus-visible:ring-2 focus-visible:ring-marca-texto md:flex-1 ${
                i === ativo ? 'border-marca bg-marca text-sobre-marca' : `border-borda hover:bg-superficie-alta ${d.hoje ? 'text-marca-texto' : 'text-texto'}`
              }`}
            >
              <span className="text-[13px] font-bold">{d.curto}</span>
              <span className={`text-[11px] ${i === ativo ? 'opacity-90' : 'text-texto-suave'}`}>{d.data}</span>
              <span className={`mt-0.5 text-[17px] font-bold leading-none ${d.total ? '' : 'opacity-40'}`}>{d.total}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ---------- Agenda ----------

type PropsAgenda = { dias: Dia[]; agora: Date; naLista: Set<string>; soOsMeus: boolean; secoes: RefObject<(HTMLElement | null)[]> };

function Agenda({ dias, agora, naLista, soOsMeus, secoes }: PropsAgenda) {
  return (
    <div className="flex flex-col gap-6">
      {dias.map((d, j) => {
        // Em Hoje, o marcador "agora" vai antes do primeiro que ainda não foi ao ar (ou no fim).
        const antesDe = d.hoje ? d.episodios.findIndex((e) => !e.foiAoAr) : null;
        return (
          <section
            key={d.chave}
            ref={(el) => {
              secoes.current[j] = el;
            }}
            aria-label={d.rotulo}
            className="flex scroll-mt-[168px] flex-col gap-2"
          >
            <h2 className="flex items-baseline gap-2 py-2">
              <span className="text-[18px] font-bold text-texto-forte">{d.rotulo}</span>
              <span className="text-[13px] text-texto-suave">{d.data}</span>
              <span className="ml-auto text-[12px] text-texto-suave">{d.total ? contagem(d.total) : ''}</span>
            </h2>
            {d.total === 0 ? (
              <DiaVazio soOsMeus={soOsMeus} />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {d.episodios.map((e, i) => (
                  <Fragment key={`${e.episodio.id_midia}-${e.episodio.episodio}`}>
                    {i === antesDe ? <Agora agora={agora} /> : null}
                    <LinhaDaAgenda noDia={e} naLista={naLista.has(e.episodio.id_midia)} />
                  </Fragment>
                ))}
                {antesDe === -1 ? <Agora agora={agora} /> : null}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Agora({ agora }: { agora: Date }) {
  const hora = horaDe(agora);
  return (
    <li aria-label={`Agora, ${hora}`} className="flex items-center gap-3 py-1">
      <span className="w-14 shrink-0 text-right text-[12px] font-bold text-marca-texto">{hora}</span>
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-marca" />
      <span aria-hidden className="h-[2px] flex-1 rounded-full bg-marca" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-marca-texto">agora</span>
    </li>
  );
}

function LinhaDaAgenda({ noDia, naLista }: { noDia: NoDia; naLista: boolean }) {
  const { episodio, hora, foiAoAr } = noDia;
  const titulo = tituloDaMidia(episodio);
  return (
    <li className={`flex items-center gap-3 ${foiAoAr ? 'opacity-55' : ''}`}>
      <span className="w-14 shrink-0 text-right text-[15px] font-bold tabular-nums text-texto-forte">{hora}</span>
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md bg-superficie p-2 pr-3 hover:ring-1 hover:ring-borda">
        <Link
          to="/midia/$id"
          params={{ id: episodio.id_midia }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-marca-texto"
        >
          <Capa url={episodio.poster_url} className="h-14 w-10 rounded-sm" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[14px] font-semibold text-texto-forte">{titulo}</span>
            <span className="flex items-center gap-2 text-[12px] text-texto-suave">
              <span>Ep. {episodio.episodio}</span>
              {foiAoAr ? <Selinho>foi ao ar</Selinho> : null}
            </span>
          </span>
        </Link>
        <AcaoLista episodio={episodio} naLista={naLista} />
      </div>
    </li>
  );
}

// ---------- Semana ----------

type PropsSemana = {
  dias: Dia[];
  larga: boolean;
  ativo: number | null;
  naLista: Set<string>;
  soOsMeus: boolean;
  trilho: RefObject<HTMLDivElement | null>;
  aoRolar(): void;
};

function Semana({ dias, larga, ativo, naLista, soOsMeus, trilho, aoRolar }: PropsSemana) {
  return (
    <div
      ref={trilho}
      onScroll={aoRolar}
      className={
        larga
          ? 'grid grid-cols-7 items-start gap-2'
          : 'sem-barra -mx-6 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-6 px-6'
      }
    >
      {dias.map((d, j) => (
        <section
          key={d.chave}
          aria-label={d.rotulo}
          className={`flex min-w-0 flex-col gap-2 rounded-lg p-1.5 transition ${larga ? '' : 'w-[85%] shrink-0 snap-start'} ${
            d.hoje ? 'bg-marca/10' : 'bg-superficie/40'
          } ${j === ativo ? 'ring-2 ring-marca' : d.hoje ? 'ring-1 ring-marca/40' : ''}`}
        >
          <h2 className="flex items-baseline justify-between gap-1 px-1 pb-1 pt-0.5">
            <span className={`text-[15px] font-bold ${d.hoje ? 'text-marca-texto' : 'text-texto-forte'}`}>
              {d.rotulo}
              {larga && d.total ? ` · ${d.total}` : ''}
            </span>
            <span className="text-[12px] text-texto-suave">{d.data}</span>
          </h2>
          {d.total === 0 ? (
            <DiaVazio soOsMeus={soOsMeus} compacto />
          ) : (
            <ul className="flex flex-col gap-2">
              {d.episodios.map((e) => (
                <BlocoDaSemana key={`${e.episodio.id_midia}-${e.episodio.episodio}`} noDia={e} naLista={naLista.has(e.episodio.id_midia)} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function BlocoDaSemana({ noDia, naLista }: { noDia: NoDia; naLista: boolean }) {
  const { episodio, hora, foiAoAr } = noDia;
  const titulo = tituloDaMidia(episodio);
  return (
    <li
      className={`flex flex-col gap-1.5 rounded-md border-l-[3px] bg-superficie p-2 hover:ring-1 hover:ring-borda ${
        foiAoAr ? 'border-borda opacity-55' : 'border-marca'
      }`}
    >
      <Link
        to="/midia/$id"
        params={{ id: episodio.id_midia }}
        className="flex flex-col gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-marca-texto"
      >
        <span className="flex items-center gap-2">
          <Capa url={episodio.poster_url} className="h-10 w-7 rounded-sm" />
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-bold tabular-nums leading-tight text-texto-forte">{hora}</span>
            <span className="text-[12px] text-texto-suave">
              Ep. {episodio.episodio}
              {foiAoAr ? ' · foi ao ar' : ''}
            </span>
          </span>
        </span>
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-texto-forte" title={titulo}>
          {titulo}
        </span>
      </Link>
      <AcaoLista episodio={episodio} naLista={naLista} />
    </li>
  );
}

// ---------- peças do cartão ----------

function Capa({ url, className }: { url: string | null; className: string }) {
  return url ? (
    <img src={url} alt="" loading="lazy" className={`shrink-0 object-cover ${className}`} />
  ) : (
    <span aria-hidden className={`flex shrink-0 items-center justify-center bg-superficie-alta ${className}`}>
      <Monograma tamanho={20} rotulo={null} />
    </span>
  );
}

/** "Na Lista" para quem tem Item; para o resto, o botão que põe o anime em Planejado. */
function AcaoLista({ episodio, naLista }: { episodio: EpisodioDoCalendario; naLista: boolean }) {
  const planejar = useAdicionarComoPlanejado();
  if (naLista) return <span className="inline-flex min-h-8 shrink-0 items-center text-[12px] font-semibold text-texto-suave">Na Lista</span>;
  return (
    <span className="flex shrink-0 flex-col gap-1">
      <button
        type="button"
        aria-label={`Pôr ${tituloDaMidia(episodio)} em Planejado`}
        disabled={planejar.isPending}
        onClick={() => planejar.mutate({ idMidia: episodio.id_midia, tipo: episodio.tipo })}
        className="inline-flex min-h-8 w-fit items-center gap-1 rounded-md border border-borda px-2 text-[12px] font-bold text-texto-forte outline-none hover:bg-superficie-alta focus-visible:ring-2 focus-visible:ring-marca-texto disabled:opacity-60"
      >
        <Icone nome="mais" tamanho={12} /> Planejado
      </button>
      {planejar.isError ? (
        <span role="alert" className="text-[12px] text-erro">
          {mensagemDeErro(planejar.error)}
        </span>
      ) : null}
    </span>
  );
}

function DiaVazio({ soOsMeus, compacto = false }: { soOsMeus: boolean; compacto?: boolean }) {
  return (
    <p className={`rounded-md border border-dashed border-borda text-center text-[13px] text-texto-suave ${compacto ? 'px-2 py-4' : 'px-4 py-6'}`}>
      {soOsMeus ? 'Nenhum dos seus sai neste dia.' : 'Nenhum episódio neste dia.'}
    </p>
  );
}

function Selinho({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-sm border border-borda px-1.5 text-[12px] font-semibold leading-[18px] text-texto-suave">
      {children}
    </span>
  );
}
