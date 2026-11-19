import { ANO_MAXIMO, ANO_MINIMO, anosInvertidos, type BuscaExplorar } from '../busca';
import { CampoAtrasado } from '../CampoAtrasado';

const ESTILO_CAMPO =
  'w-full rounded-md border border-borda bg-superficie-alta px-3 py-2 text-[14px] text-texto-forte outline-none placeholder:text-texto-suave focus:border-marca-texto';

const anoValido = (v: string) => v === '' || (/^\d+$/.test(v) && Number(v) >= ANO_MINIMO && Number(v) <= ANO_MAXIMO);
const paraAno = (v: string) => (v ? Number(v) : undefined);

/** "De" e "Até" do ano de lançamento; invertidos, avisa (e a busca ignora o Ano). */
export function Anos({ busca, mudar }: { busca: BuscaExplorar; mudar(parcial: Partial<BuscaExplorar>): void }) {
  const erro = anosInvertidos(busca);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CampoAtrasado
          aria-label="Ano inicial"
          placeholder="De"
          inputMode="numeric"
          valor={busca.ano_min?.toString() ?? ''}
          aceitar={anoValido}
          mudar={(v) => mudar({ ano_min: paraAno(v) })}
          aria-invalid={erro || undefined}
          className={ESTILO_CAMPO}
        />
        <span className="text-texto-suave">a</span>
        <CampoAtrasado
          aria-label="Ano final"
          placeholder="Até"
          inputMode="numeric"
          valor={busca.ano_max?.toString() ?? ''}
          aceitar={anoValido}
          mudar={(v) => mudar({ ano_max: paraAno(v) })}
          aria-invalid={erro || undefined}
          className={ESTILO_CAMPO}
        />
      </div>
      {erro ? (
        <p role="alert" className="text-[13px] text-erro">
          O ano inicial passa do final.
        </p>
      ) : null}
    </div>
  );
}
