import { ScrollView, Text, View } from 'react-native';

import { est } from '@/proto/componentes';
import { NOTICIAS, NOTIFICACOES } from '@/proto/dados';
import { cores } from '@/proto/tema';

export default function Noticias() {
  return (
    <ScrollView style={est.tela} contentContainerStyle={{ padding: 12 }}>
      <Text style={est.h2}>Notificações</Text>
      {NOTIFICACOES.map((n) => (
        <Text key={n.id} style={{ color: n.lida ? cores.textoSec : cores.textoForte, marginBottom: 6 }}>
          {n.lida ? '○' : '●'} {n.texto}
        </Text>
      ))}
      <Text style={est.h2}>Notícias</Text>
      {NOTICIAS.map((n) => (
        <View key={n.id} style={{ backgroundColor: cores.superficie, padding: 12, borderRadius: 8, marginBottom: 8 }}>
          <Text style={{ color: cores.textoForte, fontWeight: '700' }}>{n.titulo}</Text>
          <Text style={est.sec}>{n.data}</Text>
          <Text style={est.txt}>{n.resumo}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
