// Distribuição das notas de todas as Avaliações (GET /midias/<id>/notas): as 10 faixas.
import { ErroTela } from '../../componentes/Estados';
import { TituloSecao } from '../../componentes/Fileira';
import { useNotas } from './consultas';

const ALTURA = 64;
const avaliacoes = (n: number) => `${n} ${n === 1 ? 'avaliação' : 'avaliações'}`;

export function DistribuicaoNotas({ idMidia }: { idMidia: string }) {
  const notas = useNotas(idMidia);
  const faixas = notas.data?.distribuicao ?? [];
  const maior = Math.max(0, ...faixas.map((f) => f.total));

  return (
    <section aria-labelledby="titulo-notas">
      <TituloSecao>
        <span id="titulo-notas">Distribuição das notas</span>
      </TituloSecao>
      {notas.isError ? (
        <ErroTela erro={notas.error} tentarDeNovo={() => void notas.refetch()} />
      ) : !notas.data ? (
        <div className="rounded-md bg-superficie motion-safe:animate-pulse" style={{ height: ALTURA + 18 }} />
      ) : maior === 0 ? (
        <p className="text-texto-suave">Ainda sem Avaliações.</p>
      ) : (
        <div className="flex max-w-xl items-end gap-1.5">
          {faixas.map((f) => (
            <div key={f.nota} role="img" aria-label={`Nota ${f.nota}: ${avaliacoes(f.total)}`} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-marca/70"
                style={{ height: Math.max(2, (f.total / maior) * ALTURA) }}
                title={avaliacoes(f.total)}
              />
              <span aria-hidden className="text-[11px] text-texto-suave">
                {f.nota}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
