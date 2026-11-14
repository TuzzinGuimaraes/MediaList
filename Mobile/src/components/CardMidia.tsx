import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { type ComponentRef, useRef } from 'react';
import { Text, View } from 'react-native';

import type { CartaoMidia, Midia } from '../api/tipos';
import { notasDaMidia, ROTULO_NOTA_MEDIA, tituloDaMidia } from '../dominio/midia';
import { useEixo, usePaleta } from '../prototipo/PrototipoContext';
import { ToqueAnimado } from '../prototipo/PrototipoMovimento';
import { SeloStatus, SelosSobrePoster, useSelos } from '../prototipo/PrototipoSelos';
import { useTransicaoPoster } from '../prototipo/PrototipoTransicaoPoster';
import { nomeDoTipo, SeloTipo } from './SeloTipo';

type Props = {
  midia: CartaoMidia & Partial<Midia>;
  /** Largura fixa (carrossel) ou ocupando a coluna (grade). */
  largura?: number;
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

/**
 * Card de Mídia. PROTÓTIPO (ticket 29): três estilos pelo eixo `card` (A pôster limpo,
 * B info sobreposta, C horizontal), todos com os selos. Tocar abre o detalhe; com a
 * animação "compartilhada", o pôster voa até o detalhe (PrototipoTransicaoPoster).
 * As notas vão no valor de acessibilidade, para o leitor de tela anunciá-las depois do título.
 */
export function CardMidia({ midia, largura }: Props) {
  const estilo = useEixo('card');
  const paleta = usePaleta();
  const router = useRouter();
  const transicao = useTransicaoPoster();
  const poster = useRef<ComponentRef<typeof View>>(null);
  const titulo = tituloDaMidia(midia);
  const notas = notasDaMidia(midia);

  const abrir = () => {
    const ir = () => router.push({ pathname: '/midia/[id]', params: { id: midia.id_midia } });
    if (!transicao.ativa || !midia.poster_url || !poster.current) return ir();
    const uri = midia.poster_url;
    poster.current.measureInWindow((x, y, w, h) => {
      transicao.partir({ id: midia.id_midia, uri, origem: { x, y, w, h }, raio: RAIO });
      ir();
    });
  };

  const a11y = {
    accessibilityRole: 'link' as const,
    accessibilityLabel: `${titulo}, ${nomeDoTipo(midia.tipo)}`,
    accessibilityValue: notas.length ? { text: notas.map((n) => `${n.rotulo} ${n.valor}`).join(', ') } : undefined,
  };

  const estrelas = (claro = false) =>
    notas.map((n) => (
      <View key={n.rotulo} className="flex-row items-center gap-1">
        <Ionicons name={n.rotulo === ROTULO_NOTA_MEDIA ? 'star' : 'star-outline'} size={12} color={paleta.nota} />
        <Text className="text-legenda font-bold text-nota">{n.valor}</Text>
        <Text numberOfLines={1} className={`text-legenda ${claro ? '' : 'text-texto-suave'}`} style={claro ? { color: '#D0D0D0' } : undefined}>
          {n.curto}
        </Text>
      </View>
    ));

  if (estilo === 'b') {
    // B: só o pôster; título, notas e selos sobrepostos num gradiente.
    return (
      <ToqueAnimado {...a11y} onPress={abrir} caixa={largura ? { width: largura } : { flex: 1 }}>
        <View
          ref={poster}
          collapsable={false}
          className="aspect-[2/3] w-full overflow-hidden bg-superficie-alta"
          style={{ borderRadius: RAIO }}
        >
          <Poster midia={midia} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
            locations={[0.35, 0.65, 1]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
          />
          <SelosSobrePoster midia={midia} status={false} />
          <View className="absolute bottom-0 left-0 right-0 gap-0.5 p-2">
            <SeloStatusDoCard midia={midia} />
            <Text numberOfLines={2} className="text-legenda font-bold" style={{ color: '#FFFFFF' }}>
              {titulo}
            </Text>
            {estrelas(true).slice(0, 1)}
          </View>
        </View>
      </ToqueAnimado>
    );
  }

  if (estilo === 'c') {
    // C: card horizontal, banner (ou pôster desfocado) ao fundo, pôster pequeno e metadados.
    const banner = midia.banner_url ?? midia.poster_url;
    return (
      <ToqueAnimado {...a11y} onPress={abrir} caixa={largura ? { width: largura * 2.4 } : { flex: 1 }}>
        <View className="h-[150px] flex-row overflow-hidden bg-superficie" style={{ borderRadius: RAIO + 2 }}>
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
          <View className="m-2.5 w-[86px] overflow-hidden" style={{ borderRadius: RAIO }}>
            <View ref={poster} collapsable={false} className="flex-1 bg-superficie-alta">
              <Poster midia={midia} />
              <SelosSobrePoster midia={midia} tipo={false} status={false} />
            </View>
          </View>
          <View className="flex-1 justify-center gap-1 py-2 pr-3">
            <SeloTipo tipo={midia.tipo} />
            <Text numberOfLines={2} className="text-corpo font-bold text-texto-forte">
              {titulo}
            </Text>
            {estrelas()}
            <SeloStatusDoCard midia={midia} />
          </View>
        </View>
      </ToqueAnimado>
    );
  }

  // A: pôster vertical limpo (selos só sobre a imagem) e o texto abaixo.
  return (
    <ToqueAnimado {...a11y} onPress={abrir} className="gap-1.5" caixa={largura ? { width: largura } : { flex: 1 }}>
      <View
        ref={poster}
        collapsable={false}
        className="aspect-[2/3] w-full overflow-hidden bg-superficie-alta"
        style={{ borderRadius: RAIO }}
      >
        <Poster midia={midia} />
        <SelosSobrePoster midia={midia} tipo={false} />
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
