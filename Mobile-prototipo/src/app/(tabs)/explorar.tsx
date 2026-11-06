import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { Chip, Poster, RecorteSeletor, abrirDetalhe, est } from '@/proto/componentes';
import { MIDIAS } from '@/proto/dados';
import { NOME_TIPO, tiposDoRecorte, type Tipo } from '@/proto/dominio';
import { useProto } from '@/proto/estado';
import { cores } from '@/proto/tema';

export default function Explorar() {
  const { recorte } = useProto();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const tipos = tiposDoRecorte(recorte);
  const res = MIDIAS.filter(
    (m) => tipos.includes(m.tipo) && (!tipo || m.tipo === tipo) && m.titulo.toLowerCase().includes(busca.toLowerCase()),
  );
  return (
    <View style={est.tela}>
      <RecorteSeletor />
      <TextInput
        value={busca}
        onChangeText={setBusca}
        placeholder="Buscar por título"
        placeholderTextColor={cores.textoSec}
        style={{ marginHorizontal: 12, backgroundColor: cores.superficie, color: cores.texto, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: cores.borda }}
      />
      {tipos.length > 1 && (
        <View style={{ flexDirection: 'row', margin: 12, marginBottom: 0 }}>
          <Chip texto="Todos" ativo={!tipo} onPress={() => setTipo(null)} />
          {tipos.map((t) => <Chip key={t} texto={NOME_TIPO[t]} ativo={tipo === t} onPress={() => setTipo(t)} />)}
        </View>
      )}
      <FlatList
        data={res}
        numColumns={3}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 12 }}
        columnWrapperStyle={{ gap: 10 }}
        ListEmptyComponent={<Text style={est.sec}>Nenhuma Mídia encontrada.</Text>}
        renderItem={({ item: m }) => (
          <Pressable onPress={() => abrirDetalhe(m.id)} style={{ flex: 1 / 3, marginBottom: 12 }}>
            <Poster midia={m} w={100} h={145} />
            <Text style={est.cardTitulo} numberOfLines={2}>{m.titulo}</Text>
            <Text style={est.cardSub}>{NOME_TIPO[m.tipo]} · {m.ano}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
