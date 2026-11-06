import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Botao, Poster, est } from '@/proto/componentes';
import { midiaPorId } from '@/proto/dados';
import { NOME_ESTADO, NOME_TIPO, rotulo, unidade } from '@/proto/dominio';
import { useProto } from '@/proto/estado';
import { cores } from '@/proto/tema';

export default function DetalheMidia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, abrirEditor } = useProto();
  const m = midiaPorId(Number(id));
  const i = item(m.id);
  const atributos =
    m.tipo === 'anime' ? `${m.total ?? '?'} episódios`
    : m.tipo === 'manga' ? `${m.total ?? '?'} capítulos · ${m.demografia}`
    : `Plataformas: ${m.plataformas?.join(', ')}`;
  return (
    <ScrollView style={est.tela} contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: m.titulo }} />
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Poster midia={m} w={120} h={175} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={est.h1}>{m.titulo}</Text>
          <Text style={est.sec}>{NOME_TIPO[m.tipo]} · {m.ano}</Text>
          <Text style={est.txt}>{atributos}</Text>
          <Text style={est.txt}>{m.generos.join(' · ')}</Text>
          <Text style={{ color: cores.amarelo, fontWeight: '700' }}>
            {m.notaMedia !== null ? `★ ${m.notaMedia} (${m.totalAvaliacoes} avaliações)` : 'Sem Nota média ainda'}
          </Text>
        </View>
      </View>
      <View style={{ backgroundColor: cores.superficie, borderRadius: 8, padding: 12, marginTop: 16, gap: 8 }}>
        <Text style={est.txt}>
          {i
            ? `Na sua Lista: ${rotulo(m.tipo, i.estado)} (${NOME_ESTADO[i.estado]})${m.tipo === 'jogo' ? ` · ${i.horas} h` : ` · ${i.progresso}/${m.total ?? '?'} ${unidade(m.tipo)}`}`
            : 'Fora da sua Lista pessoal'}
        </Text>
        <Botao titulo={i ? 'Editar Item de lista' : 'Adicionar à Lista'} onPress={() => abrirEditor(m.id)} />
      </View>
      <Text style={est.h2}>Sinopse</Text>
      <Text style={est.txt}>{m.sinopse}</Text>
    </ScrollView>
  );
}
