import { ScrollView, Text, View } from 'react-native';

import { est } from '@/proto/componentes';
import { midiaPorId } from '@/proto/dados';
import { NOME_ESTADO, NOME_TIPO, contaComo, type Estado, type Tipo } from '@/proto/dominio';
import { useProto } from '@/proto/estado';
import { cores } from '@/proto/tema';

function Barra({ rotulo, n, max }: { rotulo: string; n: number; max: number }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={est.txt}>{rotulo} · {n}</Text>
      <View style={{ height: 8, backgroundColor: cores.borda, borderRadius: 4 }}>
        <View style={{ height: 8, width: `${max ? (n / max) * 100 : 0}%`, backgroundColor: cores.azul, borderRadius: 4 }} />
      </View>
    </View>
  );
}

export default function Perfil() {
  const { itens } = useProto();
  const estados: Estado[] = ['em_progresso', 'planejado', 'pausado', 'concluido', 'abandonado'];
  const porEstado = estados.map((e) => ({ e, n: itens.filter((i) => contaComo(i.estado) === e).length }));
  const plat = itens.filter((i) => i.estado === 'platinado').length;
  const tipos: Tipo[] = ['anime', 'manga', 'jogo'];
  const notas = itens.map((i) => i.nota).filter((n): n is number => n !== null);
  return (
    <ScrollView style={est.tela} contentContainerStyle={{ padding: 12 }}>
      <Text style={est.h1}>Artur</Text>
      <Text style={est.sec}>artur@exemplo.com · usuario</Text>
      <Text style={est.h2}>Por Estado de consumo</Text>
      {porEstado.map(({ e, n }) => (
        <Barra key={e} rotulo={e === 'concluido' && plat ? `${NOME_ESTADO[e]} (inclui ${plat} platinado)` : NOME_ESTADO[e]} n={n} max={itens.length} />
      ))}
      <Text style={est.h2}>Por Tipo de mídia</Text>
      {tipos.map((t) => (
        <Barra key={t} rotulo={NOME_TIPO[t]} n={itens.filter((i) => midiaPorId(i.idMidia).tipo === t).length} max={itens.length} />
      ))}
      <Text style={est.h2}>Média das Notas pessoais</Text>
      <Text style={est.txt}>{notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : '—'}</Text>
    </ScrollView>
  );
}
