import { COR_DO_ESTADO, type EstadoConsumo } from './status';

/** Neutro (Tipo, Gênero), marca (destaque, ex. "Em exibição") ou um Status, na cor dele. */
export type TomSelo = 'neutro' | 'marca' | EstadoConsumo;

type Props = {
  texto: string;
  tom?: TomSelo;
  /** Sobre pôster ou banner: fundo escuro translúcido, legível em qualquer imagem e nos dois temas. */
  sobreImagem?: boolean;
};

const FUNDO_SOBRE_IMAGEM = 'rgba(0,0,0,0.72)';
const TEXTO_SOBRE_IMAGEM = '#F2F2F2';
const BASE = 'inline-flex w-fit items-center gap-1 rounded-sm px-1.5 text-[12px] leading-[18px] font-semibold whitespace-nowrap';

/** Selo único do web: Tipo, Status, Gênero e os destaques sobre o banner. */
export function Selo({ texto, tom = 'neutro', sobreImagem = false }: Props) {
  if (tom === 'marca') return <span className={`${BASE} bg-marca font-bold text-sobre-marca`}>{texto}</span>;
  if (tom === 'neutro') {
    return sobreImagem ? (
      <span className={BASE} style={{ background: FUNDO_SOBRE_IMAGEM, color: TEXTO_SOBRE_IMAGEM }}>
        {texto}
      </span>
    ) : (
      <span className={`${BASE} border border-borda text-texto-suave`}>{texto}</span>
    );
  }
  // Status: ponto e borda na cor do Status; o texto também, fora da imagem.
  const cor = COR_DO_ESTADO[tom];
  return (
    <span
      className={`${BASE} border`}
      style={{
        background: sobreImagem ? FUNDO_SOBRE_IMAGEM : `color-mix(in srgb, ${cor} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${cor} 55%, transparent)`,
        color: sobreImagem ? TEXTO_SOBRE_IMAGEM : cor,
      }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
      {texto}
    </span>
  );
}
