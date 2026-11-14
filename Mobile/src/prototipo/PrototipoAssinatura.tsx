// PROTÓTIPO (ticket 29), descartável. As assinaturas (elemento-diferencial) do eixo `assinatura`:
// - Fio de progresso: barra carmesim de 3 px na base dos cards/destaques com Item na Lista,
//   lida do cache do TanStack Query (como os selos), sem rota nova.
// - Corte diagonal: a borda de baixo dos banners vira uma diagonal com um filete carmesim.
//   Sem SVG: uma faixa na cor do fundo, girada, cobre a base do banner (o pai corta o excesso).
// - Cor ambiente: um brilho na cor dominante do pôster. O banco não guarda essa cor; SÓ NO
//   PROTÓTIPO, com id do AniList a cor vem de `coverImage.color` direto da API pública do
//   AniList (cache em memória). Sem id (jogos) ou sem resposta, uma cor derivada do título.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { RespostaLista } from '../api/tipos';
import { estadoDe, type TipoMidia } from '../dominio/estadoConsumo';
import { totalDoItem } from '../dominio/itemLista';
import { EM_TESTE, useAssinatura, usePaleta } from './PrototipoContext';
import { useCache } from './PrototipoSelos';

// ---------- Fio de progresso ----------

/** Fio na base do pai (que precisa de overflow-hidden e position relative). */
export function FioProgresso({ idMidia }: { idMidia: string }) {
  const ligado = useAssinatura('fio');
  const paleta = usePaleta();
  const item = useCache<RespostaLista>(['lista'])?.lista.find((i) => i.id_midia === idMidia);
  if (!ligado || !item) return null;
  const estado = estadoDe(item.status_consumo, item.tipo as TipoMidia);
  const total = totalDoItem(item);
  const largura =
    estado === 'concluido' || estado === 'platinado'
      ? '100%'
      : total
        ? `${Math.min(1, (item.progresso_atual ?? 0) / total) * 100}%`
        : 14; // sem total conhecido: só um traço curto
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.45)' }}
    >
      <View style={{ height: '100%', width: largura, backgroundColor: paleta['marca-forte'] }} />
    </View>
  );
}

// ---------- Cor ambiente ----------

type ComIdAniList = {
  titulo_original: string;
  titulo_portugues: string | null;
  anime_anilist_id?: number | null;
  manga_anilist_id?: number | null;
};

const cores = new Map<number, string | null>();
const pendentes = new Map<number, Promise<string | null>>();

function buscarCorAniList(id: number): Promise<string | null> {
  const pronto = cores.get(id);
  if (pronto !== undefined) return Promise.resolve(pronto);
  let p = pendentes.get(id);
  if (!p) {
    p = fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: 'query($id:Int){Media(id:$id){coverImage{color}}}', variables: { id } }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.data?.Media?.coverImage?.color as string | null | undefined) ?? null)
      .catch(() => null)
      .then((cor) => {
        cores.set(id, cor);
        pendentes.delete(id);
        return cor;
      });
    pendentes.set(id, p);
  }
  return p;
}

function hex(n: number) {
  return Math.round(n * 255)
    .toString(16)
    .padStart(2, '0');
}

/** Hash do título -> matiz; saturação e brilho baixos, para não brigar com o carmesim. */
function corDoTitulo(titulo: string): string {
  let h = 0;
  for (let i = 0; i < titulo.length; i++) h = (h * 31 + titulo.charCodeAt(i)) >>> 0;
  const matiz = h % 360;
  const s = 0.35;
  const l = 0.32;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + matiz / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/** A cor ambiente da Mídia (#rrggbb), ou null com a assinatura desligada. */
export function useCorAmbiente(midia: ComIdAniList): string | null {
  const ligado = useAssinatura('ambiente');
  const id = midia.anime_anilist_id ?? midia.manga_anilist_id ?? null;
  const [daApi, setDaApi] = useState<string | null>(() => (id ? (cores.get(id) ?? null) : null));
  useEffect(() => {
    if (!ligado || !id || EM_TESTE) return;
    let vivo = true;
    buscarCorAniList(id).then((cor) => {
      if (vivo) setDaApi(cor);
    });
    return () => {
      vivo = false;
    };
  }, [ligado, id]);
  if (!ligado) return null;
  return daApi ?? corDoTitulo(midia.titulo_portugues || midia.titulo_original);
}

// ---------- Corte diagonal ----------

const ANGULO = 5; // graus

/** Faixa na cor do fundo girada sobre a base do banner, com o filete carmesim na borda. */
function Corte({ largura, altura }: { largura: number; altura: number }) {
  const paleta = usePaleta();
  const subida = Math.tan((ANGULO * Math.PI) / 180) * largura;
  const L = largura * 1.3;
  const H = subida * 2 + 60;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: largura / 2 - L / 2,
        top: altura - subida / 2 - 2,
        width: L,
        height: H,
        backgroundColor: paleta.fundo,
        transform: [{ rotate: `-${ANGULO}deg` }],
      }}
    >
      <View style={{ height: 2, backgroundColor: paleta.marca }} />
    </View>
  );
}

/** Altura que o corte diagonal come da base do banner (para afastar o texto). */
export function alturaDoCorte(largura: number): number {
  return Math.tan((ANGULO * Math.PI) / 180) * largura;
}

// ---------- Banner com as assinaturas ----------

type PropsBanner = {
  midia: ComIdAniList;
  largura: number;
  altura: number;
  imagem: string | null;
  desfocar?: boolean;
  /** detalhe: escurece o topo (botão voltar) e funde a base no fundo. destaque: só a base. */
  estilo: 'detalhe' | 'destaque';
  /** Brilho que vaza abaixo do banner (detalhe). */
  halo?: boolean;
  children?: React.ReactNode;
};

/** Banner do Início (destaques) e do detalhe, com cor ambiente e corte diagonal se ligados. */
export function BannerAssinado({ midia, largura, altura, imagem, desfocar = false, estilo, halo = false, children }: PropsBanner) {
  const paleta = usePaleta();
  const cor = useCorAmbiente(midia);
  const diagonal = useAssinatura('diagonal');
  const meio = cor ? `${cor}99` : `${paleta.fundo}99`;
  const gradiente =
    estilo === 'detalhe'
      ? { colors: ['rgba(0,0,0,0.3)', 'transparent', cor ? `${cor}66` : 'transparent', paleta.fundo] as const, locations: [0, 0.35, 0.7, 1] as const }
      : { colors: ['transparent', meio, paleta.fundo] as const, locations: [0.3, 0.72, 1] as const };
  return (
    <View style={{ width: largura, height: altura }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden', backgroundColor: cor ?? paleta.superficie }}>
        {imagem ? (
          <Image
            source={imagem}
            style={{ position: 'absolute', width: '100%', height: '100%', opacity: cor ? 0.82 : 1 }}
            contentFit="cover"
            blurRadius={desfocar ? 18 : 0}
            cachePolicy="disk"
            transition={200}
          />
        ) : null}
        <LinearGradient {...gradiente} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
        {cor ? (
          // O brilho: a cor sobe do canto de baixo, como luz atrás da imagem.
          <LinearGradient
            colors={[`${cor}00`, `${cor}55`]}
            start={{ x: 0.5, y: 0.2 }}
            end={{ x: 0.1, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
        ) : null}
        {diagonal ? <Corte largura={largura} altura={altura} /> : null}
        {children}
      </View>
      {cor && halo ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${cor}50`, `${cor}00`]}
          style={{ position: 'absolute', left: 0, right: 0, top: altura - 90, height: 300 }}
        />
      ) : null}
    </View>
  );
}
