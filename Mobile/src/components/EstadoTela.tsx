import { ActivityIndicator, Text, View } from 'react-native';

import { ErroRede, mensagemDeErro } from '../api/erros';
import paleta from '../tema/paleta';
import { Botao } from './Botao';

export function Carregando() {
  return (
    <View className="flex-1 items-center justify-center bg-dark-primary">
      <ActivityIndicator color={paleta.accent.blue} accessibilityLabel="Carregando" />
    </View>
  );
}

export function Vazio({ mensagem }: { mensagem: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-dark-primary p-6">
      <Text className="text-center text-corpo text-text-secondary">{mensagem}</Text>
    </View>
  );
}

/** Erro numa parte da tela que não impede o resto de aparecer. */
export function FalhaParcial({ erro, tentarDeNovo }: { erro: unknown; tentarDeNovo: () => void }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="alert" className="text-corpo text-accent-red">
        {mensagemDeErro(erro)}
      </Text>
      <Botao titulo="Tentar de novo" variante="secundario" onPress={tentarDeNovo} />
    </View>
  );
}

/** Erro ou falta de conexão, sempre com "Tentar de novo". */
export function Falha({ erro, tentarDeNovo }: { erro: unknown; tentarDeNovo: () => void }) {
  const offline = erro instanceof ErroRede;
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-dark-primary p-6">
      <Text accessibilityRole="alert" className="text-center text-corpo text-text-bright">
        {offline ? 'Sem conexão com o servidor.' : mensagemDeErro(erro)}
      </Text>
      {offline ? (
        <Text className="text-center text-corpo text-text-secondary">Verifique a internet e tente de novo.</Text>
      ) : null}
      <Botao titulo="Tentar de novo" variante="secundario" onPress={tentarDeNovo} />
    </View>
  );
}
