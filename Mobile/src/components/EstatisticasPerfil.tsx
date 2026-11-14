import { ActivityIndicator, Text, View } from 'react-native';

import { useEstatisticasPorTipo, useItensParaEstatisticas } from '../api/estatisticas';
import {
  ESTADOS,
  NOMES_ESTADO,
  NOMES_TIPO,
  TIPOS,
  contarPorEstado,
  mediaNotasPessoais,
} from '../dominio/estadoConsumo';
import { usePaleta } from '../prototipo/PrototipoContext';
import { type Barra, Barras } from './Barras';
import { Falha } from './EstadoTela';

const textos = {
  porEstado: 'Por Status',
  porTipo: 'Por Tipo de mídia',
  media: 'Média das notas pessoais',
};

function formatarNota(nota: number | null): string {
  return nota === null ? '—' : nota.toFixed(1).replace('.', ',');
}

/** Estatísticas da Lista pessoal do Usuário, mostradas abaixo dos dados do Perfil. */
export function EstatisticasPerfil() {
  const paleta = usePaleta();
  const porTipo = useEstatisticasPorTipo();
  const itens = useItensParaEstatisticas();

  if (!porTipo.data || !itens.data) {
    if (porTipo.isError || itens.isError) {
      return (
        <Falha
          erro={porTipo.error ?? itens.error}
          tentarDeNovo={() => {
            if (porTipo.isError) porTipo.refetch();
            if (itens.isError) itens.refetch();
          }}
        />
      );
    }
    return <ActivityIndicator color={paleta.accent.blue} accessibilityLabel="Carregando estatísticas" />;
  }

  const contagem = contarPorEstado(itens.data);
  const barrasEstado: Barra[] = ESTADOS.map((estado) => ({
    rotulo: NOMES_ESTADO[estado],
    valor: contagem[estado],
    refinamento: estado === 'platinado',
  }));

  const barrasTipo: Barra[] = TIPOS.map((tipo) => {
    const linha = porTipo.data.find((l) => l.tipo === tipo);
    return { rotulo: NOMES_TIPO[tipo], valor: Number(linha?.total_midias ?? 0) };
  });

  const media = formatarNota(mediaNotasPessoais(itens.data));

  return (
    <View className="gap-6">
      <View
        accessible
        accessibilityLabel={`${textos.media}: ${media}`}
        className="items-center gap-1 rounded-md bg-dark-secondary p-4"
      >
        <Text className="text-titulo-tela font-bold text-text-bright">{media}</Text>
        <Text className="text-center text-legenda text-text-secondary">{textos.media}</Text>
      </View>
      <Barras titulo={textos.porEstado} barras={barrasEstado} />
      <Barras titulo={textos.porTipo} barras={barrasTipo} />
    </View>
  );
}
