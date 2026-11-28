// "Conquistas em destaque" no Perfil (spec `conquistas-steam`, ticket 03): até 6 conquistas obtidas,
// já escolhidas e ordenadas pela API (as escolhidas, ou as mais raras com a dica), e o total. Sem
// nenhuma obtida, a seção não aparece. Destacar e tirar ficam na tela de conquistas do jogo.
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { useDestaques } from '../api/conquistas';
import type { ConquistaEmDestaque } from '../api/tipos';
import {
  descricaoDoDestaque,
  eRara,
  mostraDestaquesNoPerfil,
  TEXTOS_DAS_CONQUISTAS,
  textoDaObtencao,
  textoDaRaridade,
  textoDoTotal,
} from '@dominio/conquistas';
import { FalhaParcial } from './EstadoTela';
import { Secao } from './Secao';
import { Selo } from './Selo';

export function ConquistasPerfil() {
  const destaques = useDestaques();
  if (destaques.isError && !destaques.data) {
    return (
      <Secao titulo={TEXTOS_DAS_CONQUISTAS.emDestaque}>
        <FalhaParcial erro={destaques.error} tentarDeNovo={() => void destaques.refetch()} />
      </Secao>
    );
  }
  if (!destaques.data || !mostraDestaquesNoPerfil(destaques.data)) return null;
  const { destaques: lista, automaticos, total } = destaques.data;
  return (
    <Secao titulo={TEXTOS_DAS_CONQUISTAS.emDestaque}>
      {/* O botão "Escolher destaques" (ticket 04) entra junto do total. */}
      <Text className="text-corpo text-texto-suave">{textoDoTotal(total)}</Text>
      {automaticos ? <Text className="text-corpo text-texto">{TEXTOS_DAS_CONQUISTAS.dicaAutomaticos}</Text> : null}
      <View className="gap-3">
        {lista.map((d) => (
          <CartaoDoDestaque key={`${d.id_lista}/${d.codigo}`} destaque={d} />
        ))}
      </View>
    </Secao>
  );
}

function CartaoDoDestaque({ destaque }: { destaque: ConquistaEmDestaque }) {
  const raridade = textoDaRaridade(destaque.raridade);
  const obtencao = textoDaObtencao({ obtida: true, obtida_em: destaque.obtida_em });
  return (
    <View accessible accessibilityLabel={descricaoDoDestaque(destaque)} className="flex-row items-start gap-3">
      <View className="h-12 w-12 overflow-hidden rounded bg-superficie-alta">
        {destaque.icone ? (
          <Image
            source={destaque.icone}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="disk"
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Text className="text-corpo font-semibold text-texto-forte">{destaque.nome}</Text>
          {eRara(destaque.raridade) ? <Selo texto={TEXTOS_DAS_CONQUISTAS.rara} tom="marca" /> : null}
        </View>
        <Text numberOfLines={1} className="text-corpo text-texto">
          {destaque.jogo}
        </Text>
        <View className="flex-row flex-wrap gap-x-3">
          {obtencao ? <Text className="text-legenda text-texto-suave">{obtencao}</Text> : null}
          {raridade ? <Text className="text-legenda text-texto-suave">{raridade}</Text> : null}
        </View>
      </View>
    </View>
  );
}
