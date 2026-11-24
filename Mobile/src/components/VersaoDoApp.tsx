import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Botao } from './Botao';

const textos = {
  versao: 'Versão do app',
  embutido: 'embutido',
  update: 'update',
  atualizar: 'Atualizar agora',
};

/** O id do update é um UUID; os 8 primeiros caracteres bastam para reconhecê-lo. */
function idCurto(updateId: string): string {
  return updateId.slice(0, 8);
}

/**
 * Versão do app e o que está rodando: o JS embutido no APK ou um update do EAS Update.
 * Fora de build (dev, Expo Go) o expo-updates fica desligado e só a versão aparece.
 * Com um update já baixado, "Atualizar agora" aplica na hora em vez de esperar a próxima abertura.
 */
export function VersaoDoApp() {
  const { currentlyRunning, isUpdatePending } = Updates.useUpdates();
  const [recarregando, setRecarregando] = useState(false);
  const versao = Constants.expoConfig?.version ?? '—';

  let valor = versao;
  if (Updates.isEnabled) {
    const { updateId, isEmbeddedLaunch } = currentlyRunning;
    valor =
      isEmbeddedLaunch || !updateId
        ? `${versao} · ${textos.embutido}`
        : `${versao} · ${textos.update} ${idCurto(updateId)}`;
  }

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-legenda text-texto-suave">{textos.versao}</Text>
        <Text className="text-corpo text-texto-forte">{valor}</Text>
      </View>
      {Updates.isEnabled && isUpdatePending ? (
        <Botao
          titulo={textos.atualizar}
          icone="refresh"
          carregando={recarregando}
          onPress={() => {
            setRecarregando(true);
            Updates.reloadAsync().catch(() => setRecarregando(false));
          }}
        />
      ) : null}
    </View>
  );
}
