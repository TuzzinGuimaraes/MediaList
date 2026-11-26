// PROTÓTIPO (ticket 50), variante D: pôsteres. Grade de capas grandes agrupadas por dia, com
// horário e "Ep. N" sobre a capa; o que já foi ao ar em cinza.
import { AcaoLista, Controles, DiaVazio } from './Comum';
import { useAcoes } from './contexto';
import { capaGrande, type Dia, hora } from './dados';

function Poster({ e }: { e: Dia['episodios'][number] }) {
  const { abrir, lista } = useAcoes();
  return (
    <li className="flex flex-col gap-1.5">
      <button type="button" onClick={() => abrir(e)} className="group/card flex flex-col gap-1.5 text-left">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-superficie-alta transition motion-safe:group-hover/card:-translate-y-1 group-hover/card:shadow-lg">
          <img src={capaGrande(e.capa)} alt="" loading="lazy" className={`h-full w-full object-cover ${e.foi ? 'grayscale opacity-60' : ''}`} />
          <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[14px] font-bold tabular-nums text-white">{hora(e.quando)}</span>
          {lista[e.id_midia] ? <span className="absolute right-1.5 top-1.5 rounded-sm bg-marca px-1.5 text-[11px] font-bold leading-[18px] text-sobre-marca">Na Lista</span> : null}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-8 text-white">
            <span className="text-[13px] font-bold">Ep. {e.episodio}</span>
            {e.foi ? <span className="text-[11px] font-semibold opacity-90">foi ao ar</span> : null}
          </div>
        </div>
        <span className="line-clamp-2 text-[13px] leading-tight text-texto group-hover/card:text-texto-forte">{e.titulo}</span>
      </button>
      {lista[e.id_midia] ? null : <AcaoLista id={e.id_midia} titulo={e.titulo} compacto />}
    </li>
  );
}

export function VarianteD({ dias }: { dias: Dia[] }) {
  return (
    <div className="flex flex-col gap-8">
      <Controles />
      {dias.map((d) => (
        <section key={d.chave} aria-label={d.rotulo} className="flex flex-col gap-3">
          <h2 className="flex items-baseline gap-3 border-b border-borda pb-2">
            <span className={`text-[22px] font-bold ${d.hoje ? 'text-marca-texto' : 'text-texto-forte'}`}>{d.rotulo}</span>
            <span className="text-[14px] text-texto-suave">{d.subtitulo}</span>
            <span className="ml-auto text-[13px] text-texto-suave">
              {d.episodios.length === 1 ? '1 episódio' : d.episodios.length ? `${d.episodios.length} episódios` : ''}
            </span>
          </h2>
          {d.episodios.length === 0 ? (
            <DiaVazio />
          ) : (
            <ul className="grid grid-cols-3 gap-x-3 gap-y-5 @2xl:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] @2xl:gap-x-4">
              {d.episodios.map((e) => (
                <Poster key={e.id_midia + e.episodio} e={e} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
