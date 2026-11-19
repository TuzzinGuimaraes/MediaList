// PROTÓTIPO, mapa de atividade do detalhe (Q75): grade de contribuições estilo GitHub, 52 semanas ×
// 7 dias, carmesim em 4 intensidades mais o vazio. A rota `GET /midias/<id>/atividade` ainda não
// existe, então os números são SIMULADOS: determinísticos a partir do id da Mídia, com pico perto do
// lançamento (quando cai na janela) e alguns surtos. No web real, troque `simular` pela consulta.
import { useMemo, useState } from 'react';

import { TituloSecao } from '../componentes';
import type { MidiaDetalhe } from '../dominio';

const SEMANAS = 52;
const DIA_MS = 86_400_000;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['', 'Seg', '', 'Qua', '', 'Sex', ''];
const CELULA = 11;
const VAO = 3;

/** Nível 0 é o vazio; 1 a 4 são o carmesim (marca-forte) misturado à superfície. */
const CORES = [
  'var(--cor-superficie-alta)',
  'color-mix(in srgb, var(--cor-marca-forte) 32%, var(--cor-superficie-alta))',
  'color-mix(in srgb, var(--cor-marca-forte) 56%, var(--cor-superficie-alta))',
  'color-mix(in srgb, var(--cor-marca-forte) 80%, var(--cor-superficie-alta))',
  'var(--cor-marca-forte)',
];

type Dia = { data: Date; total: number; nivel: number; futuro: boolean };

// ---------------------------------------------------------------- PROTÓTIPO: dados simulados

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** PRNG pequeno (mulberry32): mesma semente, mesma sequência. */
function aleatorio(semente: number) {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, r: () => number): number {
  const limite = Math.exp(-lambda);
  let k = 0;
  let p = r();
  while (p > limite && k < 60) {
    k++;
    p *= r();
  }
  return k;
}

function simular(midia: MidiaDetalhe, dias: Date[]): number[] {
  const r = aleatorio(hash(midia.id_midia));
  const escala = 0.4 + Math.log10(1 + (midia.total_usuarios ?? 0)) * 0.5 + r() * 0.5;
  const lancamento = midia.data_lancamento ? new Date(`${midia.data_lancamento.slice(0, 10)}T00:00:00`).getTime() : null;
  // Surtos: novo episódio, anúncio, promoção… em dias sorteados da janela.
  const surtos = Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({
    centro: Math.floor(r() * dias.length),
    altura: 1.5 + r() * 4,
    largura: 2 + r() * 5,
  }));
  return dias.map((d, i) => {
    let base = 0.35;
    if (lancamento !== null) {
      const t = (d.getTime() - lancamento) / DIA_MS;
      if (t < -21) base *= 0.15; // antes do lançamento quase ninguém mexe
      else if (t < 0) base += 1.6 * Math.exp(t / 7); // expectativa
      else base += 10 * Math.exp(-t / 18); // pico do lançamento
    }
    for (const s of surtos) base += s.altura * Math.exp(-(((i - s.centro) / s.largura) ** 2));
    const fimDeSemana = d.getDay() === 0 || d.getDay() === 6 ? 1.35 : 1;
    return poisson(Math.min(40, escala * base * fimDeSemana), r);
  });
}

// ---------------------------------------------------------------- grade

/** Níveis pelos quartis dos dias com atividade, como no GitHub. */
function niveis(totais: number[]): number[] {
  const comAtividade = totais.filter((t) => t > 0).sort((a, b) => a - b);
  if (!comAtividade.length) return totais.map(() => 0);
  const q = (p: number) => comAtividade[Math.min(comAtividade.length - 1, Math.floor(p * comAtividade.length))]!;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  return totais.map((t) => (t === 0 ? 0 : t <= q1 ? 1 : t <= q2 ? 2 : t <= q3 ? 3 : 4));
}

function montar(midia: MidiaDetalhe): Dia[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  // A última coluna é a semana de hoje (domingo a sábado); os dias depois de hoje ficam em branco.
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - hoje.getDay() - (SEMANAS - 1) * 7);
  const datas = Array.from({ length: SEMANAS * 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
  const passados = datas.filter((d) => d <= hoje);
  const totais = simular(midia, passados);
  const nivel = niveis(totais);
  return datas.map((data, i) => ({ data, total: totais[i] ?? 0, nivel: nivel[i] ?? 0, futuro: data > hoje }));
}

const ddmmaaaa = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

export function MapaAtividade({ midia }: { midia: MidiaDetalhe }) {
  const dias = useMemo(() => montar(midia), [midia]);
  const [dica, setDica] = useState<{ dia: Dia; x: number; y: number } | null>(null);
  const total = dias.reduce((s, d) => s + d.total, 0);
  const semanas = Array.from({ length: SEMANAS }, (_, s) => dias.slice(s * 7, s * 7 + 7));
  // Rótulo do mês na coluna em que o mês começa.
  const meses = semanas.map((sem, s) => {
    const primeiro = sem.find((d) => d.data.getDate() === 1);
    return primeiro && s < SEMANAS - 1 ? MESES[primeiro.data.getMonth()] : s === 0 ? MESES[sem[0]!.data.getMonth()] : null;
  });
  const passo = CELULA + VAO;

  return (
    <section>
      <TituloSecao
        direita={
          <span className="rounded-sm border border-dashed border-borda px-1.5 text-[11px] uppercase tracking-wide text-texto-suave" title="A rota de atividade ainda não existe">
            dados simulados
          </span>
        }
      >
        Atividade <span className="text-[16px] font-normal text-texto-suave">· {total} no último ano</span>
      </TituloSecao>
      <div className="sem-barra -mt-6 overflow-x-auto pt-8">
        <div className="relative w-fit motion-safe:animate-[fade_500ms_ease-out]" onMouseLeave={() => setDica(null)}>
          {/* Meses */}
          <div className="relative mb-1 ml-8 h-4 text-[11px] text-texto-suave">
            {meses.map((m, s) =>
              m ? (
                <span key={s} className="absolute" style={{ left: s * passo }}>
                  {m}
                </span>
              ) : null,
            )}
          </div>
          <div className="flex">
            {/* Dias da semana */}
            <div className="mr-1 flex w-7 flex-col text-[11px] leading-none text-texto-suave" style={{ gap: VAO }}>
              {DIAS.map((d, i) => (
                <span key={i} className="flex items-center" style={{ height: CELULA }}>
                  {d}
                </span>
              ))}
            </div>
            <div className="flex" style={{ gap: VAO }} role="img" aria-label={`${total} atividades no último ano (dados simulados)`}>
              {semanas.map((sem, s) => (
                <div key={s} className="flex flex-col" style={{ gap: VAO }}>
                  {sem.map((d, i) => (
                    <span
                      key={i}
                      className="rounded-[2px]"
                      style={{
                        width: CELULA,
                        height: CELULA,
                        background: d.futuro ? 'transparent' : CORES[d.nivel],
                        outline: dica?.dia === d ? '1px solid var(--cor-texto-forte)' : undefined,
                      }}
                      onMouseEnter={() => (d.futuro ? setDica(null) : setDica({ dia: d, x: Math.min(32 + SEMANAS * passo - 90, Math.max(90, 32 + s * passo + CELULA / 2)), y: 20 + i * passo }))}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          {dica ? (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-texto-forte px-2 py-1 text-[12px] font-semibold text-fundo shadow-lg"
              style={{ left: dica.x, top: dica.y - 6 }}
            >
              {dica.dia.total === 1 ? '1 atividade' : `${dica.dia.total} atividades`} em {ddmmaaaa(dica.dia.data)}
            </div>
          ) : null}
          {/* Legenda */}
          <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-texto-suave">
            Menos
            {CORES.map((c, i) => (
              <span key={i} className="rounded-[2px]" style={{ width: CELULA, height: CELULA, background: c }} />
            ))}
            Mais
          </div>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-texto-suave">Adições à Lista, Avaliações e conclusões por dia.</p>
    </section>
  );
}
