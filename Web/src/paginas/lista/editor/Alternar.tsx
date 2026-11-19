import { Icone } from '../../../componentes/Icone';

/** Interruptor em pílula (Favorito, Privado). */
export function Alternar({ rotulo, icone, ativo, mudar }: { rotulo: string; icone: 'coracao' | 'escudo'; ativo: boolean; mudar(): void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      onClick={mudar}
      className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-marca-texto ${
        ativo ? 'border-marca-texto text-texto-forte' : 'border-borda text-texto-suave hover:text-texto-forte'
      }`}
    >
      <Icone nome={icone} tamanho={16} cheio={ativo} className={ativo ? 'text-marca-texto' : ''} />
      {rotulo}
    </button>
  );
}
