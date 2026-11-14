import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Text, useWindowDimensions, View } from 'react-native';

import type { CartaoMidia, Midia } from '../api/tipos';
import { notasDaMidia, ROTULO_NOTA_MEDIA, tituloDaMidia } from '../dominio/midia';
import { FioProgresso } from '../prototipo/PrototipoAssinatura';
import { useEixo, usePaleta } from '../prototipo/PrototipoContext';
import { ToqueAnimado } from '../prototipo/PrototipoMovimento';
import { SeloStatus, SelosSobrePoster, useSelos } from '../prototipo/PrototipoSelos';
import { nomeDoTipo, SeloTipo } from './SeloTipo';

/**
 * Onde o card está. PROTÓTIPO (ticket 29): o eixo `card` escolhe o estilo pelo papel.
 * - "Por contexto": C no Continuar, A nos outros carrosséis e nas grades.
 * - "C compacto": C compacto (~70% da largura da tela) em todos os carrosséis; A nas grades.
 * - "C": o C horizontal em todos (controle).
 */
export type PapelCard = 'continuar' | 'carrossel' | 'grade';

type Props = {
  midia: CartaoMidia & Partial<Midia>;
  /** Largura fixa (carrossel) ou ocupando a coluna (grade). */
  largura?: number;
  papel?: PapelCard;
};

const RAIO = 6;

function Poster({ midia }: { midia: CartaoMidia }) {
  return midia.poster_url ? (
    <Image
      source={midia.poster_url}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      cachePolicy="disk"
      transition={150}
      recyclingKey={midia.id_midia}
      accessibilityIgnoresInvertColors
    />
  ) : null;
}

/** Estilo efetivo do card para o eixo e o papel. */
export function useEstiloCard(papel: PapelCard): 'a' | 'c' | 'compacto' {
  const eixo = useEixo('card');
  if (eixo === 'c') return 'c';
  if (eixo === 'compacto') return papel === 'grade' ? 'a' : 'compacto';
  return papel === 'continuar' ? 'c' : 'a';
}

/** Largura que o card ocupa no carrossel (o C e o compacto são mais largos que o A). */
export function useLarguraCard(papel: PapelCard, larguraA: number): number {
  const estilo = useEstiloCard(papel);
  const { width } = useWindowDimensions();
  if (estilo === 'compacto') return Math.round(width * 0.7);
  if (estilo === 'c') return Math.min(Math.round(larguraA * 2.4), Math.round(width * 0.86));
  return larguraA;
}

/**
 * Card de Mídia, com os selos e o fio de progresso (assinatura). Tocar abre o detalhe.
 * As notas vão no valor de acessibilidade, para o leitor de tela anunciá-las depois do título.
 */
export function CardMidia({ midia, largura, papel = 'grade' }: Props) {
  const estilo = useEstiloCard(papel);
  const larguraEfetiva = useLarguraCard(papel, largura ?? 0);
  const paleta = usePaleta();
  const router = useRouter();
  const titulo = tituloDaMidia(midia);
  const notas = notasDaMidia(midia);

  const abrir = () => router.push({ pathname: '/midia/[id]', params: { id: midia.id_midia } });
  const caixa = largura ? { width: larguraEfetiva } : { flex: 1 };

  const a11y = {
    accessibilityRole: 'link' as const,
    accessibilityLabel: `${titulo}, ${nomeDoTipo(midia.tipo)}`,
    accessibilityValue: notas.length ? { text: notas.map((n) => `${n.rotulo} ${n.valor}`).join(', ') } : undefined,
  };

  const estrelas = () =>
    notas.map((n) => (
      <View key={n.rotulo} className="flex-row items-center gap-1">
        <Ionicons name={n.rotulo === ROTULO_NOTA_MEDIA ? 'star' : 'star-outline'} size={12} color={paleta.nota} />
        <Text className="text-legenda font-bold text-nota">{n.valor}</Text>
        <Text numberOfLines={1} className="text-legenda text-texto-suave">
          {n.curto}
        </Text>
      </View>
    ));

  if (estilo === 'c' || estilo === 'compacto') {
    // C: horizontal, banner (ou pôster desfocado) ao fundo, pôster pequeno e metadados.
    // Compacto: mais baixo, só título, Status e a primeira nota.
    const compacto = estilo === 'compacto';
    const banner = midia.banner_url ?? midia.poster_url;
    return (
      <ToqueAnimado {...a11y} onPress={abrir} caixa={caixa}>
        <View className={`${compacto ? 'h-[104px]' : 'h-[150px]'} flex-row overflow-hidden bg-superficie`} style={{ borderRadius: RAIO + 2 }}>
          {banner ? (
            <Image
              source={banner}
              style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.45 }}
              contentFit="cover"
              blurRadius={midia.banner_url ? 0 : 12}
              cachePolicy="disk"
              recyclingKey={`${midia.id_midia}-banner`}
            />
          ) : null}
          <LinearGradient
            colors={[`${paleta.superficie}F2`, `${paleta.superficie}99`, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <View className={`${compacto ? 'm-2 w-[56px]' : 'm-2.5 w-[86px]'} overflow-hidden`} style={{ borderRadius: RAIO }}>
            <View className="flex-1 bg-superficie-alta">
              <Poster midia={midia} />
              {compacto ? null : <SelosSobrePoster midia={midia} tipo={false} status={false} />}
            </View>
          </View>
          <View className="flex-1 justify-center gap-1 py-2 pr-3">
            {compacto ? null : <SeloTipo tipo={midia.tipo} />}
            <Text numberOfLines={2} className={`${compacto ? 'text-legenda' : 'text-corpo'} font-bold text-texto-forte`}>
              {titulo}
            </Text>
            {compacto ? estrelas().slice(0, 1) : estrelas()}
            <SeloStatusDoCard midia={midia} />
          </View>
          <FioProgresso idMidia={midia.id_midia} />
        </View>
      </ToqueAnimado>
    );
  }

  // A: pôster vertical limpo (selos só sobre a imagem) e o texto abaixo.
  return (
    <ToqueAnimado {...a11y} onPress={abrir} className="gap-1.5" caixa={caixa}>
      <View className="aspect-[2/3] w-full overflow-hidden bg-superficie-alta" style={{ borderRadius: RAIO }}>
        <Poster midia={midia} />
        <SelosSobrePoster midia={midia} tipo={false} />
        <FioProgresso idMidia={midia.id_midia} />
      </View>
      <Text numberOfLines={2} className="text-legenda text-texto">
        {titulo}
      </Text>
      <SeloTipo tipo={midia.tipo} />
      {estrelas()}
    </ToqueAnimado>
  );
}

function SeloStatusDoCard({ midia }: { midia: CartaoMidia & Partial<Midia> }) {
  const { estado } = useSelos(midia);
  return estado ? <SeloStatus estado={estado} sobreImagem /> : null;
}
