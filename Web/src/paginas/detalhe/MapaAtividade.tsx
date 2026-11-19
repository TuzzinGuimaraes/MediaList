// Mapa de atividade do detalhe: 52 semanas × 7 dias, nas 4 intensidades da marca, com os
// meses, os dias da semana, a legenda e a dica do dia sob o ponteiro.
import { useMemo, useState } from 'react';

import { ErroTela } from '../../componentes/Estados';
import { TituloSecao } from '../../componentes/Fileira';
import { formatarData } from '@dominio/datas';
import { type DiaDoMapa, montarMapa, SEMANAS } from '@dominio/atividade';
import { useAtividade } from './consultas';

const CELULA = 11;
const VAO = 3;
const PASSO = CELULA + VAO;
const LARGURA_DIAS = 32;
const DIAS_DA_SEMANA = ['', 'Seg', '', 'Qua', '', 'Sex', ''];

/** Nível 0 é o vazio; 1 a 4 misturam o carmesim à superfície. */
const CORES = [
  'var(--cor-superficie-alta)',
  'color-mix(in srgb, var(--cor-marca-forte) 32%, var(--cor-superficie-alta))',
  'color-mix(in srgb, var(--cor-marca-forte) 56%, var(--cor-superficie-alta))',
  'color-mix(in srgb, var(--cor-marca-forte) 80%, var(--cor-superficie-alta))',
  'var(--cor-marca-forte)',
];

const atividades = (n: number) => (n === 1 ? '1 atividade' : `${n} atividades`);

type Dica = { dia: DiaDoMapa; x: number; y: number };

export function MapaAtividade({ idMidia }: { idMidia: string }) {
  const consulta = useAtividade(idMidia);
  const mapa = useMemo(() => (consulta.data ? montarMapa(consulta.data) : null), [consulta.data]);
  const [dica, setDica] = useState<Dica | null>(null);

  return (
    <section aria-labelledby="titulo-atividade">
      <TituloSecao>
        <span id="titulo-atividade">
          Atividade
          {mapa ? <span className="ml-2 text-[16px] font-normal text-texto-suave">{mapa.total} no último ano</span> : null}
        </span>
      </TituloSecao>
      {consulta.isError ? (
        <ErroTela erro={consulta.error} tentarDeNovo={() => void consulta.refetch()} />
      ) : !mapa ? (
        <div className="h-[130px] rounded-md bg-superficie motion-safe:animate-pulse" />
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="relative w-fit" onMouseLeave={() => setDica(null)}>
            <div aria-hidden className="relative mb-1 h-4 text-[11px] text-texto-suave" style={{ marginLeft: LARGURA_DIAS }}>
              {mapa.meses.map((m) => (
                <span key={m.coluna} className="absolute" style={{ left: m.coluna * PASSO }}>
                  {m.nome}
                </span>
              ))}
            </div>
            <div className="flex">
              <div aria-hidden className="flex flex-col text-[11px] leading-none text-texto-suave" style={{ width: LARGURA_DIAS, gap: VAO }}>
                {DIAS_DA_SEMANA.map((d, i) => (
                  <span key={i} className="flex items-center" style={{ height: CELULA }}>
                    {d}
                  </span>
                ))}
              </div>
              <div
                role="img"
                aria-label={`${atividades(mapa.total)} nas últimas ${SEMANAS} semanas: adições à Lista, Avaliações e conclusões.`}
                className="flex"
                style={{ gap: VAO }}
              >
                {mapa.semanas.map((semana, s) => (
                  <div key={s} className="flex flex-col" style={{ gap: VAO }}>
                    {semana.map((dia, d) => (
                      <span
                        key={d}
                        className="rounded-[2px]"
                        style={{
                          width: CELULA,
                          height: CELULA,
                          background: dia ? CORES[dia.nivel] : 'transparent',
                          outline: dica && dica.dia === dia ? '1px solid var(--cor-texto-forte)' : undefined,
                        }}
                        onMouseEnter={() =>
                          setDica(dia ? { dia, x: LARGURA_DIAS + s * PASSO + CELULA / 2, y: 20 + d * PASSO } : null)
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {dica ? (
              <div
                role="tooltip"
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-texto-forte px-2 py-1 text-[12px] font-semibold text-fundo shadow-lg"
                style={{
                  left: Math.min(LARGURA_DIAS + SEMANAS * PASSO - 90, Math.max(90, dica.x)),
                  top: dica.y - 6,
                }}
              >
                {atividades(dica.dia.total)} em {formatarData(dica.dia.data)}
              </div>
            ) : null}
            <div aria-hidden className="mt-2 flex items-center justify-end gap-1 text-[11px] text-texto-suave">
              Menos
              {CORES.map((cor) => (
                <span key={cor} className="rounded-[2px]" style={{ width: CELULA, height: CELULA, background: cor }} />
              ))}
              Mais
            </div>
          </div>
        </div>
      )}
      <p className="mt-2 text-[12px] text-texto-suave">Adições à Lista, Avaliações e conclusões por dia.</p>
    </section>
  );
}
