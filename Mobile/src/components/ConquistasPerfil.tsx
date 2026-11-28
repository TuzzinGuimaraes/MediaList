// "Conquistas em destaque" no Perfil (spec `conquistas-steam`, ticket 03): até 6 conquistas obtidas,
// já escolhidas e ordenadas pela API (as escolhidas, ou as mais raras com a dica), e o total. Sem
// nenhuma obtida, a seção não aparece. Destacar e tirar ficam na tela de conquistas do jogo e no
// seletor de "Escolher destaques" (app/destaques.tsx, ticket 04).
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useDestaques } from '../api/conquistas';
import { mostraDestaquesNoPerfil, TEXTOS_DAS_CONQUISTAS, textoDoTotal } from '@dominio/conquistas';
import { Botao } from './Botao';
import { LinhaDaConquista } from './Conquistas';
import { FalhaParcial } from './EstadoTela';
import { Secao } from './Secao';

export function ConquistasPerfil() {
  const destaques = useDestaques();
  const router = useRouter();
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
      <Text className="text-corpo text-texto-suave">{textoDoTotal(total)}</Text>
      <Botao
        titulo={TEXTOS_DAS_CONQUISTAS.escolherDestaques}
        variante="secundario"
        onPress={() => router.push('/destaques')}
      />
      {automaticos ? <Text className="text-corpo text-texto">{TEXTOS_DAS_CONQUISTAS.dicaAutomaticos}</Text> : null}
      <View className="gap-3">
        {lista.map((d) => (
          <LinhaDaConquista
            key={`${d.id_lista}/${d.codigo}`}
            conquista={{ ...d, obtida: true }}
            jogo={d.jogo}
            comJogo
            cartao
          />
        ))}
      </View>
    </Secao>
  );
}
