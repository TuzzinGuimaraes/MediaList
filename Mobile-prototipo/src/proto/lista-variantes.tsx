// PROTÓTIPO: variações da Lista pessoal (seções vs abas) e do +1 (botão, stepper, gesto).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, FlatList, PanResponder, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';

import { abrirDetalhe, Poster } from './componentes';
import { midiaPorId, type Item } from './dados';
import { NOME_ESTADO, contaComo, rotulo, tiposDoRecorte, unidade, type Estado } from './dominio';
import { useProto } from './estado';
import { cores } from './tema';

const GRUPOS: Estado[] = ['em_progresso', 'planejado', 'pausado', 'concluido', 'abandonado'];
const ESPACO_BARRA = 230;

function useItensDoRecorte(): Item[] {
  const { itens, recorte } = useProto();
  const tipos = tiposDoRecorte(recorte);
  return itens.filter((i) => tipos.includes(midiaPorId(i.idMidia).tipo));
}

function textoProgresso(i: Item): string {
  const m = midiaPorId(i.idMidia);
  if (m.tipo === 'jogo') return `${i.horas} h jogadas · sem Progresso`;
  return `${i.progresso} / ${m.total ?? '?'} ${unidade(m.tipo)}`;
}

function Mais1Botao({ i }: { i: Item }) {
  const { incrementar } = useProto();
  return (
    <Pressable onPress={() => incrementar(i.idMidia, 1)} style={l.mais1}>
      <Text style={l.mais1Txt}>+1</Text>
    </Pressable>
  );
}

function Mais1Stepper({ i }: { i: Item }) {
  const { incrementar } = useProto();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Pressable onPress={() => incrementar(i.idMidia, -1)} style={[l.mais1, { backgroundColor: cores.superficie2 }]}>
        <Text style={l.mais1Txt}>−</Text>
      </Pressable>
      <Pressable onPress={() => incrementar(i.idMidia, 1)} style={l.mais1}>
        <Text style={l.mais1Txt}>+</Text>
      </Pressable>
    </View>
  );
}

function Conteudo({ i, direita }: { i: Item; direita?: ReactNode }) {
  const { abrirEditor, itemAtual } = useProto();
  const m = midiaPorId(i.idMidia);
  const frac = m.tipo !== 'jogo' && m.total ? i.progresso / m.total : null;
  return (
    <View style={[l.linha, itemAtual === i.idMidia && { borderColor: cores.azul }]}>
      <Pressable onPress={() => abrirDetalhe(m.id)}>
        <Poster midia={m} w={44} h={64} />
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={() => abrirEditor(m.id)}>
        <Text style={{ color: cores.textoForte, fontWeight: '600' }} numberOfLines={1}>
          {m.titulo}{i.favorito ? ' ♥' : ''}{i.privado ? ' 🔒' : ''}
        </Text>
        <Text style={{ color: cores.textoSec, fontSize: 12 }}>
          {rotulo(m.tipo, i.estado)}{i.estado === 'platinado' ? ' 🏆' : ''} · {textoProgresso(i)}
        </Text>
        {frac !== null && (
          <View style={l.barra}><View style={[l.barraCheia, { width: `${frac * 100}%` }]} /></View>
        )}
      </Pressable>
      {m.tipo !== 'jogo' && direita}
    </View>
  );
}

function LinhaGesto({ i }: { i: Item }) {
  const { incrementar } = useProto();
  const incRef = useRef(incrementar);
  useEffect(() => {
    incRef.current = incrementar; // PanResponder é criado uma vez; evita closure velha
  });
  const x = useRef(new Animated.Value(0)).current;
  const jogo = midiaPorId(i.idMidia).tipo === 'jogo';
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !jogo && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(120, g.dx))),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 70) incRef.current(i.idMidia, 1);
        Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
    }),
  ).current;
  return (
    <View>
      {!jogo && (
        <View style={l.fundoGesto}><Text style={{ color: '#fff', fontWeight: '800' }}>+1 →</Text></View>
      )}
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        <Conteudo i={i} direita={<Text style={{ color: cores.textoSec, fontSize: 11 }}>deslize →</Text>} />
      </Animated.View>
    </View>
  );
}

function Linha({ i }: { i: Item }) {
  const { variantes } = useProto();
  if (variantes.mais1 === 'gesto') return <LinhaGesto i={i} />;
  return <Conteudo i={i} direita={variantes.mais1 === 'botao' ? <Mais1Botao i={i} /> : <Mais1Stepper i={i} />} />;
}

function cabecalho(estado: Estado, xs: Item[]): string {
  const plat = xs.filter((i) => i.estado === 'platinado').length;
  return `${NOME_ESTADO[estado]} · ${xs.length}${plat ? ` (${plat} platinado)` : ''}`;
}

// Variação A: tudo numa rolagem, seções recolhíveis por Estado de consumo
export function ListaSecoes() {
  const itens = useItensDoRecorte();
  const [fechadas, setFechadas] = useState<Estado[]>([]);
  const secoes = GRUPOS.map((g) => {
    const xs = itens.filter((i) => contaComo(i.estado) === g);
    return { estado: g, total: xs, data: fechadas.includes(g) ? [] : xs };
  }).filter((s) => s.total.length > 0);
  return (
    <SectionList
      sections={secoes}
      keyExtractor={(i) => String(i.idMidia)}
      renderItem={({ item }) => <Linha i={item} />}
      stickySectionHeadersEnabled
      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: ESPACO_BARRA }}
      renderSectionHeader={({ section }) => (
        <Pressable
          onPress={() => setFechadas((f) => (f.includes(section.estado) ? f.filter((x) => x !== section.estado) : [...f, section.estado]))}
          style={l.secao}>
          <Text style={{ color: cores.textoForte, fontWeight: '700' }}>
            {fechadas.includes(section.estado) ? '▸' : '▾'} {cabecalho(section.estado, section.total)}
          </Text>
        </Pressable>
      )}
    />
  );
}

// Variação B: uma aba por Estado de consumo, só um grupo visível
export function ListaAbas() {
  const itens = useItensDoRecorte();
  const [aba, setAba] = useState<Estado>('em_progresso');
  const doGrupo = itens.filter((i) => contaComo(i.estado) === aba);
  return (
    <View style={{ flex: 1 }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {GRUPOS.map((g) => {
            const n = itens.filter((i) => contaComo(i.estado) === g).length;
            return (
              <Pressable key={g} onPress={() => setAba(g)} style={[l.aba, aba === g && l.abaAtiva]}>
                <Text style={{ color: aba === g ? cores.azul : cores.textoSec, fontWeight: '700' }}>{NOME_ESTADO[g]} {n}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <FlatList
        data={doGrupo}
        keyExtractor={(i) => String(i.idMidia)}
        renderItem={({ item }) => <Linha i={item} />}
        contentContainerStyle={{ padding: 12, paddingBottom: ESPACO_BARRA }}
        ListHeaderComponent={<Text style={{ color: cores.textoSec, marginBottom: 8 }}>{cabecalho(aba, doGrupo)}</Text>}
        ListEmptyComponent={<Text style={{ color: cores.textoSec }}>Nada neste Estado de consumo.</Text>}
      />
    </View>
  );
}

const l = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.superficie, borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: cores.borda },
  mais1: { backgroundColor: cores.azul, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10 },
  mais1Txt: { color: cores.fundo, fontWeight: '800', fontSize: 16 },
  barra: { height: 4, backgroundColor: cores.borda, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  barraCheia: { height: 4, backgroundColor: cores.azul },
  secao: { backgroundColor: cores.fundo, paddingVertical: 10 },
  aba: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 2, borderColor: 'transparent' },
  abaAtiva: { borderColor: cores.azul },
  fundoGesto: { position: 'absolute', left: 0, top: 0, bottom: 8, right: 0, backgroundColor: cores.verde, borderRadius: 8, justifyContent: 'center', paddingLeft: 16 },
});
