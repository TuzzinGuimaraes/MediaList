import { ScrollView, Text, View } from 'react-native';

import { CardMidia, RecorteSeletor, est } from '@/proto/componentes';
import { MIDIAS, type Midia } from '@/proto/dados';
import { tiposDoRecorte } from '@/proto/dominio';
import { useProto } from '@/proto/estado';

function Faixa({ titulo, midias, extra }: { titulo: string; midias: Midia[]; extra: (m: Midia) => string }) {
  return (
    <View>
      <Text style={[est.h2, { marginHorizontal: 12 }]}>{titulo}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {midias.map((m) => <CardMidia key={m.id} midia={m} extra={extra(m)} />)}
      </ScrollView>
    </View>
  );
}

export default function Inicio() {
  const { recorte } = useProto();
  const doRecorte = MIDIAS.filter((m) => tiposDoRecorte(recorte).includes(m.tipo));
  return (
    <ScrollView style={est.tela} contentContainerStyle={{ paddingBottom: 24 }}>
      <RecorteSeletor />
      <Faixa titulo="Em alta" midias={[...doRecorte].sort((a, b) => a.emAlta - b.emAlta)} extra={(m) => `#${m.emAlta} em alta`} />
      <Faixa titulo="Mais bem avaliadas" midias={doRecorte.filter((m) => m.notaMedia !== null).sort((a, b) => b.notaMedia! - a.notaMedia!)} extra={(m) => `★ ${m.notaMedia}`} />
      <Faixa titulo="Mais populares" midias={[...doRecorte].sort((a, b) => b.popularidade - a.popularidade)} extra={(m) => `${m.popularidade} nas listas`} />
    </ScrollView>
  );
}
