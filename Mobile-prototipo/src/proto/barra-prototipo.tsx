// PROTÓTIPO: barra flutuante que alterna variações + painel com o Item atual.
// Some fora de __DEV__ para não vazar se alguém copiar isto para o app real.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { midiaPorId } from './dados';
import { NOME_ESTADO, NOME_TIPO, rotulo, unidade } from './dominio';
import { VARIANTES, useProto, type Dimensao } from './estado';

const NOME_DIM: Record<Dimensao, string> = { lista: 'Lista', editor: 'Editor', mais1: '+1' };

export function BarraPrototipo() {
  const { variantes, ciclarVariante, itemAtual, item, ultimaAcao } = useProto();
  const [aberto, setAberto] = useState(true);
  if (!__DEV__) return null;

  const m = itemAtual !== null ? midiaPorId(itemAtual) : null;
  const i = itemAtual !== null ? item(itemAtual) : undefined;

  return (
    <View style={b.caixa} pointerEvents="box-none">
      <Pressable onPress={() => setAberto(!aberto)}>
        <Text style={b.titulo}>PROTÓTIPO {aberto ? '▾' : '▸'}</Text>
      </Pressable>
      {aberto && (
        <View style={b.painel}>
          <Text style={b.linhaFort}>Item atual: {m ? `${m.titulo} (${NOME_TIPO[m.tipo]})` : '—'}</Text>
          {m && i && (
            <Text style={b.linha}>
              Estado: {NOME_ESTADO[i.estado]} · rótulo “{rotulo(m.tipo, i.estado)}” ·{' '}
              {m.tipo === 'jogo' ? `${i.horas} h (sem Progresso)` : `Progresso ${i.progresso}/${m.total ?? '?'} ${unidade(m.tipo)}`}
              {' '}· nota {i.nota ?? '—'}{i.favorito ? ' · fav' : ''}{i.privado ? ' · privado' : ''} · recontagem {i.recontagem}
            </Text>
          )}
          {m && !i && <Text style={b.linha}>Fora da Lista pessoal</Text>}
          <Text style={b.linha}>Última ação: {ultimaAcao}</Text>
        </View>
      )}
      {(Object.keys(VARIANTES) as Dimensao[]).map((d) => {
        const op = VARIANTES[d].find((o) => o.chave === variantes[d])!;
        return (
          <View key={d} style={b.pilula}>
            <Pressable onPress={() => ciclarVariante(d, -1)} style={b.seta}><Text style={b.setaTxt}>◀</Text></Pressable>
            <Text style={b.rotulo} numberOfLines={1}>{NOME_DIM[d]}: {op.chave} ({op.nome})</Text>
            <Pressable onPress={() => ciclarVariante(d, 1)} style={b.seta}><Text style={b.setaTxt}>▶</Text></Pressable>
          </View>
        );
      })}
    </View>
  );
}

const b = StyleSheet.create({
  caixa: { position: 'absolute', left: 8, right: 8, bottom: 8, alignItems: 'center', gap: 4 },
  titulo: { color: '#000', backgroundColor: '#ffeb3b', fontWeight: '900', fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  painel: { backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 8, padding: 8, alignSelf: 'stretch', borderWidth: 1, borderColor: '#ffeb3b' },
  linhaFort: { color: '#fff', fontWeight: '700', fontSize: 12 },
  linha: { color: '#ddd', fontSize: 11 },
  pilula: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, alignSelf: 'stretch', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 6, elevation: 8 },
  seta: { paddingHorizontal: 14, paddingVertical: 6 },
  setaTxt: { color: '#000', fontWeight: '900' },
  rotulo: { flex: 1, textAlign: 'center', color: '#000', fontWeight: '700', fontSize: 12 },
});
