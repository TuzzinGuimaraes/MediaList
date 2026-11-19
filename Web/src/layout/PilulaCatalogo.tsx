import { NOMES_RECORTE, RECORTES, useCatalogo } from '../catalogo/CatalogoContext';

/** Troca do catálogo na nav. O leitor de tela diz "Catálogo"; a palavra Recorte não aparece. */
export function PilulaCatalogo({ sobreImagem }: { sobreImagem: boolean }) {
  const { recorte, trocar } = useCatalogo();
  return (
    <div
      role="group"
      aria-label="Catálogo"
      className={`flex rounded-full p-0.5 text-[13px] ${sobreImagem ? 'bg-black/35 backdrop-blur' : 'bg-superficie-alta'}`}
    >
      {RECORTES.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={r === recorte}
          onClick={() => trocar(r)}
          className={`min-h-9 rounded-full px-3.5 font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-marca-texto ${
            r === recorte
              ? 'bg-marca text-sobre-marca'
              : sobreImagem
                ? 'text-white/80 hover:text-white'
                : 'text-texto-suave hover:text-texto-forte'
          }`}
        >
          {NOMES_RECORTE[r]}
        </button>
      ))}
    </div>
  );
}
