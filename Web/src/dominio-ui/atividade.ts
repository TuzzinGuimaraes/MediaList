// Mapa de atividade do detalhe: a grade de 52 semanas × 7 dias, montada da resposta de
// GET /midias/<id>/atividade (só os dias com atividade, `fim` = hoje no fuso do banco).
// As datas são contadas em UTC, a partir das strings da API, para o horário de verão não
// pular nem repetir dias.

export const SEMANAS = 52;

/** 0 é o vazio; 1 a 4 são as intensidades da marca. */
export type NivelAtividade = 0 | 1 | 2 | 3 | 4;

export type DiaDoMapa = { data: string; total: number; nivel: NivelAtividade };

export type MapaAtividade = {
  /** Colunas de domingo a sábado; null nos dias depois de hoje. */
  semanas: (DiaDoMapa | null)[][];
  /** O nome do mês na coluna em que ele começa. */
  meses: { coluna: number; nome: string }[];
  /** Soma da janela inteira da API. */
  total: number;
};

type RespostaAtividade = { fim: string; dias: { data: string; total: number }[] };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIA_MS = 86_400_000;
/** Colunas mínimas entre dois rótulos de mês, para não sobrepor. */
const VAO_ENTRE_MESES = 3;

/** Faixa do dia: quartos do maior dia da grade (até 25% é 1, até 50% é 2...). */
export function nivelDeAtividade(total: number, maximo: number): NivelAtividade {
  if (total <= 0 || maximo <= 0) return 0;
  return Math.min(4, Math.ceil((total / maximo) * 4)) as NivelAtividade;
}

const deIso = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const paraIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function montarMapa({ fim, dias }: RespostaAtividade): MapaAtividade {
  const porDia = new Map(dias.map((d) => [d.data, d.total]));
  const hoje = deIso(fim);
  // A última coluna é a semana de hoje; a primeira, 51 semanas antes, começa num domingo.
  const comeco = hoje - (new Date(hoje).getUTCDay() + (SEMANAS - 1) * 7) * DIA_MS;

  const datas = Array.from({ length: SEMANAS * 7 }, (_, i) => comeco + i * DIA_MS);
  const maximo = Math.max(0, ...datas.filter((ms) => ms <= hoje).map((ms) => porDia.get(paraIso(ms)) ?? 0));
  const celulas = datas.map((ms): DiaDoMapa | null => {
    if (ms > hoje) return null;
    const data = paraIso(ms);
    const total = porDia.get(data) ?? 0;
    return { data, total, nivel: nivelDeAtividade(total, maximo) };
  });
  const semanas = Array.from({ length: SEMANAS }, (_, s) => celulas.slice(s * 7, s * 7 + 7));

  const inicios = datas
    .map((ms, i) => ({ coluna: Math.floor(i / 7), data: new Date(ms) }))
    .filter(({ data }) => data.getUTCDate() === 1)
    .map(({ coluna, data }) => ({ coluna, nome: MESES[data.getUTCMonth()] ?? '' }));
  // A 1ª coluna leva o mês dela, se o próximo rótulo não estiver perto demais.
  const primeiro = new Date(comeco);
  const meses =
    primeiro.getUTCDate() !== 1 && (inicios[0]?.coluna ?? SEMANAS) >= VAO_ENTRE_MESES
      ? [{ coluna: 0, nome: MESES[primeiro.getUTCMonth()] ?? '' }, ...inicios]
      : inicios;

  return { semanas, meses, total: dias.reduce((soma, d) => soma + d.total, 0) };
}
