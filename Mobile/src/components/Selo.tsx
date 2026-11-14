import { Text, View } from 'react-native';

import { type EstadoConsumo, NOMES_ESTADO, NOMES_TIPO, type TipoMidia } from '../dominio/estadoConsumo';
import type { Cores, NomeCor } from '../tema/cores';
import { useCores } from '../tema/TemaContext';

/** Token de cor de cada Status (tons dessaturados; o carmesim fica com a marca). */
const COR_DO_ESTADO: Record<EstadoConsumo, NomeCor> = {
  em_progresso: 'status-progresso',
  concluido: 'status-concluido',
  pausado: 'status-pausado',
  abandonado: 'status-abandonado',
  planejado: 'status-planejado',
  platinado: 'status-platinado',
};

export function corDoEstado(estado: EstadoConsumo, cores: Cores): string {
  return cores[COR_DO_ESTADO[estado]];
}

/** Nome do Tipo para exibir e para rótulos de acessibilidade; Tipo desconhecido passa como veio. */
export function nomeDoTipo(tipo: string): string {
  return NOMES_TIPO[tipo as TipoMidia] ?? tipo;
}

/**
 * Tom do selo: neutro (Tipo, Gênero), marca (destaque, ex. "Em exibição") ou um Status,
 * que pinta o selo com a cor dele.
 */
export type TomSelo = 'neutro' | 'marca' | EstadoConsumo;

type Props = {
  texto: string;
  tom?: TomSelo;
  /** Sobre pôster ou banner: fundo escuro translúcido, legível em qualquer imagem. */
  sobreImagem?: boolean;
};

/** Fundo escuro dos selos sobre imagem, igual nos dois temas. */
const FUNDO_SOBRE_IMAGEM = 'rgba(0,0,0,0.72)';
const TEXTO_SOBRE_IMAGEM = '#F2F2F2';

/** Selo único do app: Tipo, Status, Gênero e os destaques sobre o banner. */
export function Selo({ texto, tom = 'neutro', sobreImagem = false }: Props) {
  const cores = useCores();
  if (tom === 'marca') {
    return (
      <View className="self-start rounded-sm bg-marca px-1.5">
        <Text maxFontSizeMultiplier={1.3} className="text-legenda font-bold text-sobre-marca">
          {texto}
        </Text>
      </View>
    );
  }
  if (tom === 'neutro') {
    return (
      <View
        className={`self-start rounded-sm px-1.5 ${sobreImagem ? '' : 'border border-borda'}`}
        style={sobreImagem ? { backgroundColor: FUNDO_SOBRE_IMAGEM } : undefined}
      >
        <Text
          maxFontSizeMultiplier={1.3}
          className={`text-legenda font-semibold ${sobreImagem ? '' : 'text-texto-suave'}`}
          style={sobreImagem ? { color: TEXTO_SOBRE_IMAGEM } : undefined}
        >
          {texto}
        </Text>
      </View>
    );
  }
  // Status: ponto e borda na cor do Status; o texto também, fora da imagem.
  const cor = corDoEstado(tom, cores);
  return (
    <View
      className="flex-row items-center gap-1 self-start rounded-sm border px-1.5"
      style={{ backgroundColor: sobreImagem ? FUNDO_SOBRE_IMAGEM : `${cor}22`, borderColor: `${cor}88` }}
    >
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cor }} />
      <Text
        maxFontSizeMultiplier={1.3}
        className="text-legenda font-semibold"
        style={{ color: sobreImagem ? TEXTO_SOBRE_IMAGEM : cor }}
      >
        {texto}
      </Text>
    </View>
  );
}

export function SeloTipo({ tipo, sobreImagem }: { tipo: string; sobreImagem?: boolean }) {
  return <Selo texto={nomeDoTipo(tipo)} sobreImagem={sobreImagem} />;
}

export function SeloStatus({ estado, sobreImagem }: { estado: EstadoConsumo; sobreImagem?: boolean }) {
  return <Selo texto={NOMES_ESTADO[estado]} tom={estado} sobreImagem={sobreImagem} />;
}

/** Faixa "Top 10" no canto do pôster, com a posição em Populares. */
export function SeloTop({ posicao }: { posicao: number }) {
  return (
    <View accessible accessibilityLabel={`Top 10, número ${posicao}`} className="items-center rounded-bl-md bg-marca px-1.5 pb-0.5">
      <Text maxFontSizeMultiplier={1} className="text-[13px] font-bold leading-[15px] text-sobre-marca">
        TOP
      </Text>
      <Text maxFontSizeMultiplier={1} className="text-corpo font-bold leading-[18px] text-sobre-marca">
        {posicao}
      </Text>
    </View>
  );
}
