// Variações da Lista pessoal alternadas pela barra flutuante (BarraPrototipo).
import { View } from 'react-native';

import { BarraPrototipo } from '@/proto/barra-prototipo';
import { RecorteSeletor, est } from '@/proto/componentes';
import { useProto } from '@/proto/estado';
import { ListaAbas, ListaSecoes } from '@/proto/lista-variantes';

export default function Lista() {
  const { variantes } = useProto();
  return (
    <View style={est.tela}>
      <RecorteSeletor />
      {variantes.lista === 'secoes' ? <ListaSecoes /> : <ListaAbas />}
      <BarraPrototipo />
    </View>
  );
}
