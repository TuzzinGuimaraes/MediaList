export type Barra = {
  rotulo: string;
  valor: number;
  /** Refinamento da barra anterior (ex.: Platinado dentro de Concluído): aparece recuada. */
  refinamento?: boolean;
  /** Cor do preenchimento (ex.: a do Status); sem ela, a da marca. */
  cor?: string;
};

/** Barras horizontais com título, proporcionais ao maior valor do grupo; cada uma lida como "rótulo: valor". */
export function Barras({ titulo, barras }: { titulo: string; barras: readonly Barra[] }) {
  const maximo = Math.max(1, ...barras.map((b) => b.valor));
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[15px] font-semibold text-texto-forte">{titulo}</h3>
      <ul className="flex flex-col gap-2.5">
        {barras.map((b) => (
          <li key={b.rotulo} aria-label={`${b.rotulo}: ${b.valor}`} className={`flex flex-col gap-1 ${b.refinamento ? 'pl-4' : ''}`}>
            <div aria-hidden className="flex justify-between gap-3 text-[13px]">
              <span className="text-texto-suave">{b.refinamento ? `↳ ${b.rotulo}` : b.rotulo}</span>
              <span className="font-semibold text-texto">{b.valor}</span>
            </div>
            <div aria-hidden className="h-2 overflow-hidden rounded-full bg-superficie-alta">
              <div
                className={`h-full rounded-full ${b.cor ? '' : 'bg-marca'}`}
                style={{ width: `${(b.valor / maximo) * 100}%`, background: b.cor }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
