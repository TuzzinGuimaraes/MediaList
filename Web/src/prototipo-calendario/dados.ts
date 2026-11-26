// PROTÓTIPO (ticket 50): dados fixos (77 episódios reais de produção), "agora" e fuso da URL,
// a janela de 7 dias, o agrupamento por dia local e a Lista sorteada com semente fixa.
import bruto from './episodios-prod.json';

export type Episodio = {
  id_midia: string;
  titulo: string;
  titulo_original: string;
  capa: string;
  estudio: string | null;
  total: number | null;
  episodio: number;
  instante: string;
};

export type EstadoItem = 'em_progresso' | 'planejado' | 'pausado';
export type Item = { estado: EstadoItem; favorito: boolean };
export type Lista = Record<string, Item>;

export const NOME_ESTADO: Record<EstadoItem, string> = { em_progresso: 'Assistindo', planejado: 'Planejado', pausado: 'Pausado' };

const params = new URLSearchParams(location.search);
export const AGORA = new Date(params.get('agora') ?? '2026-11-26T19:45:00Z');
export const FUSO = params.get('fuso') ?? 'America/Sao_Paulo';

const EPISODIOS = bruto as Episodio[];

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });

export const chaveDoDia = (d: Date) => fmtDia.format(d);
export const hora = (d: Date) => fmtHora.format(d);

/** Capa maior do AniList (o JSON traz a "medium"). */
export const capaGrande = (url: string) => url.replace('/cover/medium/', '/cover/large/');

export type Dia = { chave: string; rotulo: string; subtitulo: string; curto: string; hoje: boolean; episodios: (Episodio & { quando: Date; foi: boolean })[] };

function diasDaJanela(): Omit<Dia, 'episodios'>[] {
  const [a, m, d] = chaveDoDia(AGORA).split('-').map(Number) as [number, number, number];
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(Date.UTC(a, m - 1, d + i, 12));
    const semana = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' }).format(dt);
    const curtoSemana = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' }).format(dt).replace('.', '');
    const data = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(dt).replace('.', '');
    const rotulo = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : semana.charAt(0).toUpperCase() + semana.slice(1);
    return {
      chave: dt.toISOString().slice(0, 10),
      rotulo,
      subtitulo: i < 2 ? `${semana}, ${data}` : data,
      curto: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : curtoSemana,
      hoje: i === 0,
    };
  });
}

/** Itens da Lista sorteados (semente fixa): 1 de hoje e 7 do resto da semana. */
function sortearLista(): Lista {
  let s = 50;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hoje = chaveDoDia(AGORA);
  const ids = [...new Set(EPISODIOS.map((e) => e.id_midia))];
  const deHoje = ids.filter((id) => EPISODIOS.some((e) => e.id_midia === id && chaveDoDia(new Date(e.instante)) === hoje));
  const resto = ids.filter((id) => !deHoje.includes(id)).sort(() => rnd() - 0.5);
  const escolhidos = [deHoje[Math.floor(rnd() * deHoje.length)], ...resto.slice(0, 7)].filter(Boolean) as string[];
  const papeis: Item[] = [
    { estado: 'em_progresso', favorito: false },
    { estado: 'em_progresso', favorito: false },
    { estado: 'em_progresso', favorito: false },
    { estado: 'planejado', favorito: false },
    { estado: 'planejado', favorito: false },
    { estado: 'pausado', favorito: true },
    { estado: 'pausado', favorito: false },
    { estado: 'pausado', favorito: false },
  ];
  return Object.fromEntries(escolhidos.map((id, i) => [id, papeis[i]!]));
}

export const LISTA_INICIAL = sortearLista();

/** "Só os meus": Assistindo, Planejado ou favorito (Pausado e Abandonado fora). */
export const ehMeu = (item: Item | undefined) => !!item && (item.estado !== 'pausado' || item.favorito);

export function semana(lista: Lista, soOsMeus: boolean): Dia[] {
  const eps = EPISODIOS.map((e) => ({ ...e, quando: new Date(e.instante), foi: new Date(e.instante) <= AGORA }))
    .filter((e) => !soOsMeus || ehMeu(lista[e.id_midia]))
    .sort((a, b) => a.quando.getTime() - b.quando.getTime());
  return diasDaJanela().map((d) => ({ ...d, episodios: eps.filter((e) => chaveDoDia(e.quando) === d.chave) }));
}

/** "em 2 h", "em 35 min", "foi ao ar há 3 h". */
export function relativo(quando: Date): string {
  const min = Math.round((quando.getTime() - AGORA.getTime()) / 60000);
  const fmt = (m: number) => (m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} dias`);
  return min > 0 ? `em ${fmt(min)}` : `foi ao ar há ${fmt(-min)}`;
}

export const NOTA_JAPAO = 'horário da exibição no Japão';
export const NOME_FUSO = FUSO === 'America/Sao_Paulo' ? 'Brasília' : FUSO;
export const HORA_AGORA = hora(AGORA);
