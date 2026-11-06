// PROTÓTIPO: peças pequenas compartilhadas (não é design system).
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { Midia } from './dados';
import { NOME_TIPO, type Recorte } from './dominio';
import { useProto } from './estado';
import { cores } from './tema';

export function Poster({ midia, w, h }: { midia: Midia; w: number; h: number }) {
  return (
    <View style={{ width: w, height: h, backgroundColor: midia.cor, borderRadius: 6, justifyContent: 'flex-end', padding: 4 }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: Math.max(10, w / 6) }} numberOfLines={2}>
        {midia.titulo.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

export function RecorteSeletor() {
  const { recorte, setRecorte } = useProto();
  const opcoes: { k: Recorte; t: string }[] = [
    { k: 'animanga', t: 'Anime & Mangá' },
    { k: 'jogos', t: 'Jogos' },
  ];
  return (
    <View style={est.recorte}>
      {opcoes.map((o) => (
        <Pressable key={o.k} onPress={() => setRecorte(o.k)} style={[est.recorteOpc, recorte === o.k && est.recorteAtivo]}>
          <Text style={{ color: recorte === o.k ? cores.fundo : cores.texto, fontWeight: '700' }}>{o.t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function abrirDetalhe(id: number) {
  router.push({ pathname: '/midia/[id]', params: { id: String(id) } });
}

export function CardMidia({ midia, extra }: { midia: Midia; extra?: string }) {
  return (
    <Pressable onPress={() => abrirDetalhe(midia.id)} style={{ width: 110, marginRight: 12 }}>
      <Poster midia={midia} w={110} h={160} />
      <Text style={est.cardTitulo} numberOfLines={2}>{midia.titulo}</Text>
      <Text style={est.cardSub}>{extra ?? NOME_TIPO[midia.tipo]}</Text>
    </Pressable>
  );
}

export function Botao({ titulo, onPress, cor = cores.azul, style }: { titulo: string; onPress: () => void; cor?: string; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} style={[{ backgroundColor: cor, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, alignItems: 'center' }, style]}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{titulo}</Text>
    </Pressable>
  );
}

export function Chip({ texto, ativo, onPress }: { texto: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[est.chip, ativo && { backgroundColor: cores.azul, borderColor: cores.azul }]}>
      <Text style={{ color: ativo ? cores.fundo : cores.texto, fontWeight: '600', fontSize: 13 }}>{texto}</Text>
    </Pressable>
  );
}

export const est = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  h1: { color: cores.textoForte, fontSize: 20, fontWeight: '800', marginVertical: 8 },
  h2: { color: cores.textoForte, fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  txt: { color: cores.texto },
  sec: { color: cores.textoSec, fontSize: 12 },
  recorte: { flexDirection: 'row', backgroundColor: cores.superficie, borderRadius: 8, padding: 4, margin: 12, borderWidth: 1, borderColor: cores.borda },
  recorteOpc: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  recorteAtivo: { backgroundColor: cores.azul },
  cardTitulo: { color: cores.texto, fontSize: 13, marginTop: 6, fontWeight: '600' },
  cardSub: { color: cores.textoSec, fontSize: 11 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: cores.borda, marginRight: 6, marginBottom: 6, backgroundColor: cores.superficie },
});
